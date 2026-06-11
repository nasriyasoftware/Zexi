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
 * - absolute vertical starting position
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
 * - recalculating downstream offsets
 * - enabling efficient partial re-rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE MODEL
 * ---------------------------------------------------------------------
 *
 * The layout behaves similarly to a prefix-sum structure:
 *
 * ```txt
 * startsAt[i] = Σ(height[0..i-1])
 * ```
 *
 * Therefore:
 *
 * - each entry position depends on all previous entries
 * - height mutations propagate downward
 * - stable heights avoid cascading updates
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING PURPOSE
 * ---------------------------------------------------------------------
 *
 * The renderer uses this layout snapshot to:
 *
 * - reposition the terminal cursor
 * - determine repaint boundaries
 * - optimize incremental rendering
 * - preserve terminal spatial correctness
 *
 * ---------------------------------------------------------------------
 * 🔷 UPDATE PROPAGATION
 * ---------------------------------------------------------------------
 *
 * When an entry changes height:
 *
 * - total layout height is recalculated
 * - all subsequent `startsAt` offsets are shifted
 *
 * When height remains unchanged:
 *
 * - only content changes
 * - positional recalculation is skipped
 *
 * ---------------------------------------------------------------------
 * 🔷 STATEFUL DESIGN
 * ---------------------------------------------------------------------
 *
 * `ScreenLayout` is intentionally mutable and stateful.
 *
 * The layout always represents the latest known terminal state snapshot.
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
     * The new entry is positioned directly after the currently occupied
     * terminal space.
     *
     * ---------------------------------------------------------------------
     * 🔷 POSITIONING RULE
     * ---------------------------------------------------------------------
     *
     * The new entry receives:
     *
     * ```txt
     * startsAt = current total height
     * ```
     *
     * After insertion:
     *
     * - total height increases
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
     * @since 1.0.0
     */
    add(entry: SnapshotEntryData) {
        this.#_data.push({
            value: entry.value,
            height: entry.height,
            startsAt: this.#_height
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