import atomix from "@nasriya/atomix";
import ScreenLayout from "./layout";
import ScreenCell from "./cell";
import TerminalEntry from "./terminal-cell";
import cursorPosition from "./cursor-position";
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
 * targetRow = cursorPosition.row + snapshot.height - 1
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
 * cursorPosition.row - 1
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
         * The current snapshot entry is obtained as a read-only getter-based view.
         * Because the view reflects the current underlying entry state, its properties
         * must not be relied upon after the snapshot is updated when previous state is
         * required for comparison.
         *
         * The previous value and height are therefore captured before applying the
         * update. The cached height is used to determine whether the update changes
         * the
         * layout structure and requires downstream entries to be re-rendered.
         *
         * Responsibilities:
         *
         * - compare against the previous rendered state
         * - cache previous entry details before mutation
         * - update layout metadata
         * - determine whether cascading rendering is required
         * - trigger the rendering pipeline
         *
         * Cascade rendering becomes necessary when the visual height changes, because
         * all subsequent entries may shift vertically.
         *
         * If only the rendered value changes while its height remains stable, the
         * update can be performed locally without recalculating or re-rendering
         * downstream entries.
         *
         * @param index - Snapshot entry index.
         * @param dataToUpdate - Updated rendered state.
         *
         * @throws Error if the snapshot entry does not exist.
         *
         * @since 1.0.0
         */
        update: (index: number, dataToUpdate: SnapshotEntryData) => {
            const snapshot = this.#_snapshot;

            const entry = snapshot.get(index);
            if (!entry) {
                throw new Error(`Invariant violation: snapshot entry ${index} does not exist`);
            }

            // Skip the update when the rendered value has not changed.
            if (entry.value === dataToUpdate.value) { return }

            // Snapshot entries are getter-based read-only views, so their properties
            // reflect the current underlying state. Cache the previous values before
            // mutating the snapshot; otherwise, reading entry.height after update()
            // would return the new height rather than the previous height.
            const prev = {
                value: entry.value,
                height: entry.height
            }

            // Apply the new rendered state to the snapshot.
            snapshot.update(index, dataToUpdate);

            // A height change alters the positions of entries below this one and
            // therefore requires cascading re-rendering.
            const cascade = {
                required: prev.height !== dataToUpdate.height,
                startFrom: index + 1
            }

            this.#_helpers.render(index, cascade);
        },

        /**
         * Removes a registered screen entry and synchronizes the terminal.
         *
         * The entry is located using its stable snapshot identity. Its current layout
         * index is resolved immediately before removal so that structural changes that
         * occurred after registration are correctly accounted for.
         *
         * ---------------------------------------------------------------------
         * 🔷 REMOVAL
         * ---------------------------------------------------------------------
         *
         * The removal process:
         *
         * - resolves the entry's current layout index
         * - removes the entry from the screen layout
         * - determines whether downstream entries require re-rendering
         * - re-renders affected entries when necessary
         * - restores the cursor to the logical end of the rendered output
         *
         * Removing an entry may change the position of every entry below it. When
         * downstream entries remain, the renderer therefore performs a cascading
         * render beginning at the removed entry's former index.
         *
         * ---------------------------------------------------------------------
         * 🔷 NO DOWNSTREAM ENTRIES
         * ---------------------------------------------------------------------
         *
         * Rendering is skipped when there are no entries after the removed entry.
         *
         * This occurs in either of two cases:
         *
         * - the removed entry was the only entry in the snapshot, leaving the
         *   snapshot empty
         * - the removed entry was the final entry in the snapshot, leaving entries
         *   before it but no entries that require positional reflow
         *
         * In both cases, there is no downstream terminal output that needs to be
         * synchronized. Attempting to render from the removed entry's former index
         * would also be invalid because that index no longer identifies an entry
         * after removal.
         *
         * ---------------------------------------------------------------------
         * 🔷 IDENTITY
         * ---------------------------------------------------------------------
         *
         * The entry is identified by its stable snapshot identity rather than by
         * its layout index. This allows entries to be removed in any order without
         * requiring their callers to track changes to the layout.
         *
         * @param id - Stable snapshot identity of the entry to remove.
         *
         * @throws Error if the snapshot entry does not exist.
         *
         * @since 1.0.0
         */
        remove: (id: symbol) => {
            const entry = this.#_snapshot.get(id);
            if (!entry) {
                throw new Error('Invariant violation: unable to remove a snapshot entry because it does not exist');
            }

            const index = entry.index;

            this.#_snapshot.remove(index);
            const sizeAfterRemoval = this.#_snapshot.size();

            // No downstream entries remain to re-render.
            if (sizeAfterRemoval === 0 || index === sizeAfterRemoval) { return }

            this.#_helpers.render(index, { required: true, startFrom: index });
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
         * targetRow = cursorPosition.row + snapshot.height - 1
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
            const targetRow = cursorPosition.row + snapshot.height - 1;
            process.stdout.cursorTo(0, targetRow);
        }
    }

    /**
     * Creates and registers a new screen output entry.
     *
     * The created entry becomes part of the rendering pipeline immediately.
     * Any future updates or removal of the entry are automatically propagated
     * into the terminal renderer.
     *
     * By default, the method creates an internal {@link ScreenCell}. When the
     * `target` is set to `'external'`, the method creates a {@link TerminalEntry}
     * intended to be returned through the terminal's public API.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION REQUIREMENT
     * ---------------------------------------------------------------------
     *
     * The terminal cursor position must be initialized before an entry can be
     * created.
     *
     * The captured cursor position establishes the absolute origin from which
     * the screen engine positions its managed output. Without an initialized
     * cursor position, the screen engine cannot determine the correct terminal
     * coordinates for the entry.
     *
     * Attempting to create an entry before cursor initialization is therefore
     * treated as an internal invariant violation.
     *
     * ---------------------------------------------------------------------
     * 🔷 REGISTRATION
     * ---------------------------------------------------------------------
     *
     * Creating an entry performs the following operations:
     *
     * - registers an empty snapshot entry
     * - receives a stable snapshot identity
     * - attaches update and removal event handlers
     * - creates the requested entry type
     * - performs the initial render
     *
     * The snapshot entry initially contains an empty value so that the entry's
     * first update produces a visible rendering change.
     *
     * The snapshot identity remains associated with the entry for its entire
     * lifetime. The entry's current layout index is resolved dynamically from
     * this identity whenever the entry is updated or removed.
     *
     * This ensures that structural changes to the layout, such as inserting or
     * removing entries before this entry, do not invalidate its ability to locate
     * its corresponding snapshot entry.
     *
     * ---------------------------------------------------------------------
     * 🔷 UPDATE PROPAGATION
     * ---------------------------------------------------------------------
     *
     * Once registered, changes to the entry are propagated through the internal
     * update event handler.
     *
     * The handler resolves the entry's current snapshot position using its stable
     * snapshot identity and forwards the latest rendered value and visual height
     * to the screen layout and rendering pipeline.
     *
     * The layout index is therefore never retained by the entry and may change
     * throughout its lifetime.
     *
     * ---------------------------------------------------------------------
     * 🔷 REMOVAL
     * ---------------------------------------------------------------------
     *
     * The entry is associated with an internal removal event handler.
     *
     * When invoked, the handler:
     *
     * - resolves the entry's current snapshot position using its stable identity
     * - removes the corresponding snapshot entry
     * - allows the screen engine to reflow the entries below it
     *
     * The removal handler is executed at most once. Once an entry has been
     * removed, it cannot be removed from the screen again.
     *
     * ---------------------------------------------------------------------
     * 🔷 TARGET
     * ---------------------------------------------------------------------
     *
     * The optional `target` parameter determines the type of entry created:
     *
     * - `'internal'` or omitted → creates a {@link ScreenCell}
     * - `'external'` → creates a {@link TerminalEntry}
     *
     * The external target is intended for entries exposed through the terminal's
     * public API, while the default target is used internally by the screen
     * engine.
     *
     * ---------------------------------------------------------------------
     * 🔷 ENTRY LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * The created entry remains associated with its snapshot identity until it is
     * removed from the screen. Its layout index and terminal starting row are
     * derived from the current layout and may change as the layout is modified.
     *
     * @param config - Initial configuration for the entry.
     * @param target - Determines whether an internal or externally exposed entry
     * is created.
     * @returns The created screen cell or terminal entry, depending on `target`.
     *
     * @throws Error if the cursor position has not been initialized.
     *
     * @since 1.0.0
     */
    create<T extends 'internal' | 'external' = 'internal'>(
        config: TerminalCellOptions,
        target?: T
    ): T extends 'external' ? TerminalEntry : ScreenCell {
        if (!cursorPosition.initialized) {
            throw new Error('Invariant violation: Attempting to create a cell before cursor position is initialized.');
        }

        /**
         * Register initial empty snapshot state.
         *
         * The entry intentionally starts empty so the initial render always
         * produces a visible diff.
         */
        const snapshotId = this.#_snapshot.add({ value: '', height: 1 });

        const events = {
            /**
             * Internal update callback invoked whenever the cell mutates.
             *
             * Pushes the latest rendered state into the renderer pipeline.
             *
             * @param cell - Updated screen cell
             * @throws Error if the snapshot entry does not exist
             * 
             * @since 1.0.0
             */
            onUpdate: (cell: ScreenCell) => {
                const entry = this.#_snapshot.get(snapshotId);
                if (!entry) {
                    throw new Error('Invariant violation: unable to update a snapshot entry because it does not exist');
                }

                this.#_helpers.update(entry.index, {
                    value: cell.value,
                    height: cell.height
                });
            },

            /**
             * Internal removal event invoked when the screen entry is removed.
             *
             * Delegates removal to the screen engine's removal helper using the entry's
             * stable snapshot identity.
             *
             * The stable identity is used instead of retaining the entry's layout index,
             * because the index may change when other entries are inserted or removed
             * before this entry.
             *
             * The removal helper removes the entry from the layout and synchronizes the
             * affected terminal output.
             *
             * The handler is guaranteed to execute at most once.
             *
             * @since 1.0.0
             */
            onRemove: atomix.utils.once(() => this.#_helpers.remove(snapshotId))
        }

        /** Create screen cell instance. */
        const entry = target === 'external'
            ? new TerminalEntry(events, config)
            : new ScreenCell(events, config);

        // Perform initial render.
        events.onUpdate(entry);

        return entry;
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
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION REQUIREMENT
     * ---------------------------------------------------------------------
     *
     * The terminal cursor position must be initialized before the screen can
     * be cleared.
     *
     * The captured cursor position establishes the absolute origin of the
     * screen engine's managed output. Without it, the engine cannot determine
     * which portion of the terminal belongs to its rendered state.
     *
     * Attempting to clear the screen before cursor initialization is therefore
     * treated as an internal invariant violation.
     *
     * ---------------------------------------------------------------------
     * 🔷 CLEARING PROCESS
     * ---------------------------------------------------------------------
     *
     * The clearing process:
     *
     * - moves the cursor to `cursorPosition.row - 1`
     * - clears the current line
     * - clears everything below the current position
     * - resets the internal layout snapshot
     *
     * This removes the output managed by the engine while preserving terminal
     * content that exists outside its managed region.
     *
     * ---------------------------------------------------------------------
     * 🔷 SUBSEQUENT RENDERING
     * ---------------------------------------------------------------------
     *
     * After clearing, the internal layout snapshot is empty. The next created
     * cell therefore starts a new managed output sequence from the captured
     * terminal position.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANT
     * ---------------------------------------------------------------------
     *
     * Cursor-position initialization is normally guaranteed by the terminal
     * task queue before screen operations are executed. The explicit check here
     * protects the screen engine's internal contract if it is invoked outside
     * that execution path.
     *
     * @throws Error if the cursor position has not been initialized
     *
     * @since 1.0.0
     */
    clear() {
        if (!cursorPosition.initialized) {
            throw new Error('Invariant violation: Attempting to clear the screen before the cursor position has been initialized.');
        }

        process.stdout.cursorTo(0, cursorPosition.row - 1);
        process.stdout.clearLine(1);
        process.stdout.clearScreenDown();
        this.#_snapshot.clear();
    }
}

export default ScreenEngine;