import ScreenLayout from "./layout";
import ScreenCell from "./cell";
import initialCursorPosition from "./cursor-position";
import type { SnapshotEntryData, TerminalCellOptions } from "./types";

/**
 * State-driven terminal rendering engine.
 *
 * `ScreenEngine` manages a collection of {@link ScreenCell} instances and
 * efficiently synchronizes their rendered output into the terminal using
 * snapshot-based positional diffing.
 *
 * The engine does not initialize, clear, or take ownership of the terminal
 * screen. Instead, rendering is performed relative to the terminal position
 * captured by the screen subsystem.
 *
 * Core responsibilities:
 *
 * - maintain terminal layout state
 * - track rendered row positions
 * - minimize terminal writes during updates
 * - perform cascading re-renders when layout structure changes
 * - preserve visual consistency during dynamic updates
 * - clear only the portion of terminal output owned by the engine
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Each screen cell maps to a positional snapshot entry containing:
 *
 * - rendered value
 * - visual height
 * - absolute starting row relative to the captured terminal position
 *
 * The layout snapshot determines where each entry begins and how much
 * terminal space it occupies.
 *
 * Updates are processed incrementally:
 *
 * - unchanged heights → localized rewrite
 * - changed heights → cascading reflow below the updated entry
 *
 * Before writing an updated entry, its current terminal line is always
 * cleared. This ensures stale characters are removed when the new rendered
 * value is shorter than the previous value.
 *
 * ---------------------------------------------------------------------
 * 🔷 POSITIONAL MODEL
 * ---------------------------------------------------------------------
 *
 * The engine renders relative to the terminal position captured by the
 * screen subsystem.
 *
 * The imported `position` represents the terminal location at which Zexi
 * began managing its own output. The engine does not assume that row `0`
 * represents the beginning of its managed output.
 *
 * Snapshot entry positions are therefore calculated relative to this
 * captured position, allowing Zexi to coexist with output that existed
 * before the engine became active.
 *
 * The logical end position of the rendered snapshot is calculated from:
 *
 * ```txt
 * targetRow = initialCursorPosition.row + snapshot.height - 1
 * ```
 *
 * This allows the engine to restore the cursor to the end of its managed
 * output without requiring knowledge of terminal content outside the
 * snapshot.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL UPDATES
 * ---------------------------------------------------------------------
 *
 * When an entry changes its visual height, all entries below it may shift
 * vertically.
 *
 * In this case the engine:
 *
 * - moves to the changed entry
 * - clears its current line
 * - writes the updated value
 * - clears everything below the updated entry
 * - re-renders all downstream entries using their updated positions
 *
 * When the entry height remains unchanged, only the affected entry is
 * rewritten.
 *
 * ---------------------------------------------------------------------
 * 🔷 TERMINAL OWNERSHIP
 * ---------------------------------------------------------------------
 *
 * `ScreenEngine` intentionally does not take ownership of the terminal
 * screen.
 *
 * It does not:
 *
 * - switch to an alternate screen buffer
 * - clear the terminal during construction
 * - restore the terminal screen during process shutdown
 * - modify output that exists before the engine's managed position
 *
 * This allows the engine to coexist with output produced by other libraries,
 * applications, or terminal processes.
 *
 * The engine only manipulates the region beginning at the captured
 * `position` and maintains its own layout snapshot for that region.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEARING
 * ---------------------------------------------------------------------
 *
 * Clearing the engine removes the output managed by the current snapshot.
 *
 * The cursor is first moved to the row immediately preceding the captured
 * starting position:
 *
 * ```txt
 * initialCursorPosition.row - 1
 * ```
 *
 * The current line is then cleared, followed by everything below it.
 *
 * The internal layout snapshot is cleared afterward so that subsequent
 * entries are rendered as a new managed output sequence.
 *
 * Clearing therefore affects the terminal region owned by the engine rather
 * than indiscriminately clearing the entire terminal screen.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `ScreenEngine` acts as the rendering layer between mutable
 * {@link ScreenCell} instances and the terminal.
 *
 * `ScreenCell` owns the state of an individual rendered value, while
 * `ScreenLayout` tracks the spatial arrangement of all rendered cells.
 * `ScreenEngine` coordinates both components and translates their state into
 * terminal cursor movement and output operations.
 *
 * The architecture behaves similarly to a virtualized terminal DOM:
 *
 * ```txt
 * ScreenCell
 *      │
 *      ▼
 * ScreenLayout
 *      │
 *      ▼
 * ScreenEngine
 *      │
 *      ▼
 * Terminal
 * ```
 *
 * @since 1.0.0
 */
class ScreenEngine {
    /**
     * Internal positional screen layout snapshot.
     *
     * Tracks rendered entries, their visual heights, and their absolute
     * starting rows within the engine's managed terminal region.
     *
     * The snapshot represents the latest known rendered state of the engine
     * and is used to determine which terminal regions must be rewritten after
     * an update.
     *
     * @since 1.0.0
     */
    readonly #_snapshot = new ScreenLayout();

    /**
     * Internal rendering and update helper utilities.
     *
     * These helpers encapsulate the low-level mechanics required to synchronize
     * the screen layout with the terminal.
     *
     * They are responsible for:
     *
     * - processing screen cell updates
     * - determining whether cascading rendering is required
     * - positioning the terminal cursor
     * - clearing stale output
     * - rendering updated entries
     * - restoring the cursor to the logical end of the snapshot
     *
     * These helpers are implementation details and are not part of the public
     * API surface.
     *
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Processes an update for a specific screen cell.
         *
         * Responsibilities:
         *
         * - compare against previous snapshot state
         * - update layout metadata
         * - determine whether cascade rendering is required
         * - trigger the rendering pipeline
         *
         * Cascade rendering becomes necessary when the visual height changes,
         * because all subsequent entries shift vertically.
         *
         * If only the rendered value changes while its height remains stable,
         * the update can be performed locally without recalculating or
         * re-rendering downstream entries.
         *
         * @param index - Snapshot entry index
         * @param dataToUpdate - Updated rendered state
         *
         * @throws Error if the snapshot entry does not exist
         *
         * @since 1.0.0
         */
        update: (index: number, dataToUpdate: SnapshotEntryData) => {
            const snapshot = this.#_snapshot;

            const prevEntry = snapshot.get(index);
            if (!prevEntry) {
                throw new Error(`Invariant violation: snapshot entry ${index} does not exist`);
            }

            // Skip if no visible change
            if (prevEntry.value === dataToUpdate.value) { return }

            // Apply update to snapshot
            snapshot.update(index, dataToUpdate);

            const cascade = {
                required: prevEntry.height !== dataToUpdate.height,
                startFrom: index + 1
            }

            this.#_helpers.render(index, cascade);
        },

        /**
         * Renders a snapshot entry into the terminal.
         *
         * The renderer always clears the entry's current terminal line before
         * writing the new value. This prevents stale characters from
         * remaining when the new rendered value is shorter than the previous
         * value.
         *
         * ---------------------------------------------------------------------
         * 🔷 NON-STRUCTURAL UPDATE
         * ---------------------------------------------------------------------
         *
         * When the entry's visual height remains unchanged:
         *
         * - move the cursor to the entry's starting row
         * - clear the current line
         * - write the updated value
         *
         * No downstream entries need to be rendered again.
         *
         * ---------------------------------------------------------------------
         * 🔷 STRUCTURAL UPDATE
         * ---------------------------------------------------------------------
         *
         * When the entry's visual height changes:
         *
         * - move the cursor to the entry's starting row
         * - clear the current line
         * - write the updated value
         * - clear everything below the updated entry
         * - re-render all downstream entries using their updated positions
         *
         * This ensures that entries affected by the vertical shift are
         * synchronized with the updated layout snapshot.
         *
         * ---------------------------------------------------------------------
         * 🔷 CURSOR RESTORATION
         * ---------------------------------------------------------------------
         *
         * After rendering completes, the cursor is restored to the logical
         * end of the engine's managed output.
         *
         * The target row is calculated from the captured terminal position
         * and the current snapshot height:
         *
         * ```txt
         * targetRow = initialCursorPosition.row + snapshot.height - 1
         * ```
         *
         * The horizontal cursor position is reset to column `0`.
         *
         * @param entryIndex - Snapshot entry index to render
         * @param cascade - Cascade rendering metadata
         * @param cascade.required - Whether downstream re-rendering is required
         * @param cascade.startFrom - Downstream re-render start index
         *
         * @throws Error if the snapshot entry does not exist
         *
         * @since 1.0.0
         */
        render: (entryIndex: number, cascade: { required: boolean; startFrom: number }) => {
            const snapshot = this.#_snapshot;
            const entry = snapshot.get(entryIndex);
            if (!entry) {
                throw new Error(`Invariant violation: snapshot entry ${entryIndex} does not exist`);
            }

            // Move cursor to the entry's starting row
            process.stdout.cursorTo(0, entry.startsAt);
            process.stdout.clearLine(1);

            // Write updated content
            process.stdout.write(entry.value);

            // If height changed, re-render all entries below
            if (cascade.required) {
                process.stdout.clearScreenDown();

                // Write the new value of this entry AND everything below it
                for (let i = cascade.startFrom; i < snapshot.size(); i++) {
                    const e = snapshot.get(i);
                    if (!e) { continue; }

                    process.stdout.cursorTo(0, e.startsAt);
                    process.stdout.write(e.value);
                }
            }

            // Restore cursor to the end of the rendered output
            const targetRow = initialCursorPosition.row + snapshot.height - 1;
            process.stdout.cursorTo(0, targetRow);
        }
    }

    /**
     * Creates and registers a new {@link ScreenCell}.
     *
     * The created cell becomes part of the rendering pipeline immediately.
     * Any future updates to the cell automatically propagate into the
     * terminal renderer.
     *
     * Internally:
     *
     * - a snapshot entry is reserved
     * - update bindings are attached
     * - initial rendering is performed
     *
     * The cell is rendered relative to the terminal position captured by the
     * screen subsystem. Creating a cell does not initialize or clear the
     * terminal.
     *
     * @param config - Initial screen cell configuration
     * @returns Newly created screen cell
     *
     * @since 1.0.0
     */
    create(config: TerminalCellOptions) {
        /** Snapshot index assigned to the new cell. */
        const index = this.#_snapshot.size();

        /**
         * Internal update callback invoked whenever the cell mutates.
         *
         * Pushes the latest rendered state into the renderer pipeline.
         *
         * @param cell - Updated screen cell
         */
        const onUpdate = (cell: ScreenCell) => {
            this.#_helpers.update(index, {
                value: cell.value,
                height: cell.height
            });
        }

        /**
         * Register initial empty snapshot state.
         *
         * The entry intentionally starts empty so the initial render always
         * produces a visible diff.
         */
        this.#_snapshot.add({ value: '', height: 1 });

        /** Create screen cell instance. */
        const cell = new ScreenCell(onUpdate, config);

        // Perform initial render.
        onUpdate(cell);

        return cell;
    }

    /**
     * Inserts an immutable empty line into the screen.
     *
     * Useful for:
     *
     * - spacing
     * - visual grouping
     * - section separation
     *
     * The empty line becomes part of the internal layout snapshot and
     * therefore participates in subsequent positional calculations.
     *
     * @since 1.0.0
     */
    newLine() {
        this.create({ value: '', final: true });
    }

    /**
     * Clears the entire rendered state owned by the screen engine.
     *
     * The engine does not clear the terminal indiscriminately. Instead, the
     * cursor is moved to the row immediately preceding the position captured
     * when the screen subsystem began tracking terminal output.
     *
     * The clearing process then:
     *
     * - moves the cursor to `initialCursorPosition.row - 1`
     * - clears the current line
     * - clears everything below the current position
     * - resets the internal layout snapshot
     *
     * This removes the output managed by the engine while preserving terminal
     * content that exists outside its managed region.
     *
     * After clearing, the next created cell starts a new managed output
     * sequence from the captured terminal position.
     *
     * @since 1.0.0
     */
    clear() {
        process.stdout.cursorTo(0, initialCursorPosition.row - 1);
        process.stdout.clearLine(1);
        process.stdout.clearScreenDown();
        this.#_snapshot.clear();
    }
}

export default ScreenEngine;