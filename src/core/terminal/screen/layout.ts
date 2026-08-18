import cursorPosition from "./cursor-position";
import type { SnapshotEntry, SnapshotEntryData } from "./types";

/**
 * Positional terminal layout tracker.
 *
 * `ScreenLayout` maintains a normalized snapshot of rendered terminal
 * output blocks and their spatial positions within terminal space.
 *
 * Each entry stores:
 *
 * - rendered output value
 * - rendered visual height
 * - absolute vertical starting position within the terminal
 *
 * The layout accounts for both the terminal position at which rendering
 * begins and the accumulated height of entries already present in the
 * snapshot.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This class acts as the structural layout layer of the rendering system.
 *
 * It is responsible for:
 *
 * - tracking terminal row allocation
 * - maintaining positional consistency
 * - calculating absolute entry positions
 * - recalculating downstream offsets
 * - enabling efficient partial re-rendering
 *
 * `ScreenLayout` does not perform terminal I/O itself. It maintains the
 * positional model consumed by the rendering engine, allowing the renderer
 * to determine where each entry must be written within the terminal.
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE MODEL
 * ---------------------------------------------------------------------
 *
 * The layout behaves similarly to a prefix-sum structure with an external
 * terminal-position offset.
 *
 * The first entry is positioned relative to the terminal cursor row:
 *
 * ```txt
 * startsAt[0] = position.row - 1
 * ```
 *
 * Each subsequent entry is positioned after the visual space occupied by
 * all preceding entries:
 *
 * ```txt
 * startsAt[i] = (position.row - 1) + Σ(height[0..i-1])
 * ```
 *
 * Therefore:
 *
 * - each entry position depends on the terminal position at which the
 *   layout is established
 * - each subsequent entry depends on the accumulated visual height of
 *   preceding entries
 * - height mutations propagate their positional effect to downstream
 *   entries
 * - stable heights avoid unnecessary cascading updates
 *
 * The `-1` adjustment converts the terminal's one-based cursor row into
 * the zero-based row coordinate used by the layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 POSITIONAL MODEL
 * ---------------------------------------------------------------------
 *
 * `startsAt` represents an absolute terminal row rather than a row that
 * is relative only to the layout snapshot.
 *
 * For example, if the terminal cursor is positioned at row `10` when the
 * first entry is added:
 *
 * ```txt
 * Terminal row:       10
 *                       │
 *                       ▼
 *                  ┌─────────┐
 *                  │ Entry 0 │ startsAt = 9
 *                  └─────────┘
 *                  ┌─────────┐
 *                  │ Entry 1 │ startsAt = 9 + height[0]
 *                  └─────────┘
 *                  ┌─────────┐
 *                  │ Entry 2 │ startsAt = 9 + height[0] + height[1]
 *                  └─────────┘
 * ```
 *
 * This allows the rendering engine to coexist with terminal content that
 * existed before the layout was created without assuming that the first
 * managed entry begins at terminal row `0`.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING PURPOSE
 * ---------------------------------------------------------------------
 *
 * The renderer uses this layout snapshot to:
 *
 * - reposition the terminal cursor
 * - determine the absolute starting row of an entry
 * - determine repaint boundaries
 * - determine whether downstream entries must be re-rendered
 * - optimize incremental rendering
 * - preserve terminal spatial correctness
 *
 * Because `startsAt` contains the entry's absolute terminal position,
 * rendering code does not need to reconstruct the position from the
 * snapshot index alone.
 *
 * ---------------------------------------------------------------------
 * 🔷 UPDATE PROPAGATION
 * ---------------------------------------------------------------------
 *
 * When an entry changes height:
 *
 * - the total layout height is updated
 * - the changed entry retains its existing starting position
 * - all subsequent entries shift vertically according to the height
 *   difference
 * - a cascading re-render may therefore be required
 *
 * When height remains unchanged:
 *
 * - only the entry's rendered content changes
 * - subsequent entry positions remain valid
 * - positional recalculation is unnecessary
 *
 * This distinction allows the rendering engine to avoid re-rendering
 * unaffected downstream entries when an update does not alter the
 * structure of the layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 HEIGHT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * An entry's `height` represents its actual visual height within the
 * terminal, rather than merely the number of newline characters contained
 * in its rendered value.
 *
 * This distinction is important because terminal output may wrap when its
 * rendered width exceeds the available terminal width.
 *
 * Consequently:
 *
 * - a single logical line may occupy multiple terminal rows
 * - `height` must account for terminal-width wrapping
 * - `startsAt` calculations depend on the resulting visual height
 *
 * Accurate height information is therefore required to keep cursor
 * positioning synchronized with the physical terminal layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 STATEFUL DESIGN
 * ---------------------------------------------------------------------
 *
 * `ScreenLayout` is intentionally mutable and stateful.
 *
 * The layout always represents the latest known terminal state snapshot,
 * including:
 *
 * - the rendered value of each entry
 * - its visual height
 * - its absolute starting position
 * - the total visual height occupied by the snapshot
 *
 * Mutations are performed incrementally so that the rendering engine can
 * determine the minimum amount of terminal output that must be rewritten
 * after an update.
 *
 * @since 1.0.0
 */
class ScreenLayout {
    /**
     * Internal ordered layout entries.
     *
     * Each entry represents a rendered screen block with:
     *
     * - `value`
     *   Fully rendered terminal output string.
     *
     * - `height`
     *   Number of terminal rows occupied by the rendered output.
     *
     * - `startsAt`
     *   Absolute vertical row offset within terminal space.
     *
     * ---------------------------------------------------------------------
     * 🔷 ORDER GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Entries are always stored in visual render order.
     *
     * This ordering is critical because positional calculations depend
     * on all previous entry heights.
     *
     * @since 1.0.0
     */
    readonly #_data: SnapshotEntry[] = [];

    /**
     * Total rendered terminal height.
     *
     * Represents the combined visual height of all layout entries.
     *
     * Equivalent to:
     *
     * ```txt
     * Σ(entry.height)
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 RENDERING USAGE
     * ---------------------------------------------------------------------
     *
     * Used by the renderer to:
     *
     * - restore cursor position
     * - determine terminal bounds
     * - compute append positions
     *
     * @since 1.0.0
     */
    #_height: number = 0;

    /**
     * Returns the total rendered terminal height.
     *
     * This value represents the total number of visible terminal rows
     * currently occupied by the layout snapshot.
     *
     * @returns Total terminal row count
     *
     * @since 1.0.0
     */
    get height() {
        return this.#_height;
    }

    /**
     * Appends a new entry to the layout snapshot.
     *
     * The new entry is positioned directly after the terminal space already
     * occupied by the snapshot, relative to the terminal's captured cursor row.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION REQUIREMENT
     * ---------------------------------------------------------------------
     *
     * The terminal cursor position must be initialized before an entry can be
     * added to the layout.
     *
     * The cursor position provides the absolute starting row from which the
     * layout snapshot is positioned. Without an initialized cursor position,
     * the layout cannot determine the correct terminal coordinates for the new
     * entry.
     *
     * Attempting to add an entry before cursor initialization is therefore
     * treated as an internal invariant violation.
     *
     * ---------------------------------------------------------------------
     * 🔷 POSITIONING RULE
     * ---------------------------------------------------------------------
     *
     * The new entry receives:
     *
     * ```txt
     * startsAt = current total height + initial cursor row - 1
     * ```
     *
     * Where:
     *
     * - `current total height` is the total number of rows occupied by entries
     *   already present in the snapshot.
     * - `initial cursor row` is the terminal cursor row captured when Zexi's
     *   cursor-position subsystem was initialized.
     * - `-1` converts the cursor's one-based row position into the zero-based
     *   row coordinate used by the layout.
     *
     * This allows the snapshot to be positioned correctly when Zexi begins
     * rendering below content that already exists in the terminal.
     *
     * The captured cursor position establishes the layout's absolute origin,
     * while the snapshot's accumulated height determines the relative position
     * of each subsequent entry.
     *
     * After insertion:
     *
     * - total height increases by the new entry's height
     * - ordering is preserved
     *
     * ---------------------------------------------------------------------
     * 🔷 COMPLEXITY
     * ---------------------------------------------------------------------
     *
     * Time complexity:
     *
     * ```txt
     * O(1)
     * ```
     *
     * @param entry - Rendered entry snapshot data
     *
     * @throws Error if the cursor position has not been initialized
     *
     * @since 1.0.0
     */
    add(entry: SnapshotEntryData) {
        if (!cursorPosition.initialized) {
            throw new Error("Invariant violation: Attempted to add layout entry before cursor position has been initialized.");
        }

        this.#_data.push({
            value: entry.value,
            height: entry.height,
            startsAt: this.#_height + cursorPosition.row - 1,
        });

        this.#_height += entry.height;
    }

    /**
     * Clears the entire layout snapshot.
     *
     * ---------------------------------------------------------------------
     * 🔷 EFFECTS
     * ---------------------------------------------------------------------
     *
     * - removes all layout entries
     * - resets total height to zero
     * - invalidates all previous positional state
     *
     * ---------------------------------------------------------------------
     * 🔷 RENDERER USAGE
     * ---------------------------------------------------------------------
     *
     * Typically used during:
     *
     * - full terminal clears
     * - renderer resets
     * - screen reinitialization
     *
     * @since 1.0.0
     */
    clear() {
        this.#_data.length = 0;
        this.#_height = 0;
    }

    /**
     * Updates an existing layout entry.
     *
     * ---------------------------------------------------------------------
     * 🔷 UPDATE STRATEGY
     * ---------------------------------------------------------------------
     *
     * The update process consists of:
     *
     * 1. replacing value/height
     * 2. calculating height delta
     * 3. propagating positional shifts if necessary
     *
     * ---------------------------------------------------------------------
     * 🔷 HEIGHT PROPAGATION
     * ---------------------------------------------------------------------
     *
     * If height changes:
     *
     * ```txt
     * diff = newHeight - oldHeight
     * ```
     *
     * Then:
     *
     * - total layout height is adjusted
     * - all subsequent entries shift vertically
     *
     * ---------------------------------------------------------------------
     * 🔷 OPTIMIZATION
     * ---------------------------------------------------------------------
     *
     * If the visual height remains unchanged:
     *
     * - positional recalculation is skipped
     * - only the content snapshot changes
     *
     * ---------------------------------------------------------------------
     * 🔷 INVALID INDICES
     * ---------------------------------------------------------------------
     *
     * Invalid indices are ignored silently.
     *
     * No exception is thrown.
     *
     * ---------------------------------------------------------------------
     * 🔷 COMPLEXITY
     * ---------------------------------------------------------------------
     *
     * Best case:
     *
     * ```txt
     * O(1)
     * ```
     *
     * Worst case:
     *
     * ```txt
     * O(n)
     * ```
     *
     * due to downstream propagation.
     *
     * @param index - Entry index to update
     * @param updatedEntry - New rendered snapshot data
     *
     * @since 1.0.0
     */
    update(index: number, updatedEntry: SnapshotEntryData) {
        const entry = this.#_data[index];
        if (!entry) { return }

        const diff = updatedEntry.height - entry.height;

        entry.value = updatedEntry.value;
        entry.height = updatedEntry.height;

        if (diff === 0) { return; }

        // Apply the change to the height
        this.#_height += diff;

        // Propagate the change to the rest of the entries
        if (index < this.#_data.length - 1) {
            for (let i = index + 1; i < this.#_data.length; i++) {
                this.#_data[i].startsAt += diff;
            }
        }
    }

    /**
     * Retrieves a read-only snapshot entry view.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY SAFETY
     * ---------------------------------------------------------------------
     *
     * Returned entries are shallow-cloned to prevent external mutation
     * of internal layout state.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVALID INDICES
     * ---------------------------------------------------------------------
     *
     * Returns:
     *
     * ```ts
     * null
     * ```
     *
     * when the entry does not exist.
     *
     * @param index - Layout entry index
     * @returns Cloned snapshot entry or `null`
     *
     * @since 1.0.0
     */
    get(index: number) {
        const entry = this.#_data[index];
        if (!entry) { return null }

        return { ...entry };
    }

    /**
     * Returns the total number of layout entries.
     *
     * This represents the number of independently tracked rendered
     * screen blocks currently stored in the snapshot.
     *
     * @returns Layout entry count
     *
     * @since 1.0.0
     */
    size() {
        return this.#_data.length;
    }
}

export default ScreenLayout;