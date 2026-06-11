import ScreenLayout from "./layout";
import ScreenCell from "./cell";
import type { SnapshotEntryData, TerminalCellOptions } from "./types";

/**
 * Indicates whether the terminal screen subsystem has already been initialized.
 *
 * Prevents duplicate alternate-screen setup and duplicate process listener
 * registration.
 *
 * @since 1.0.0
 */
let initialized = false;

/**
 * Restores the terminal back to the primary screen buffer.
 *
 * This function is invoked during process shutdown to ensure the terminal
 * exits cleanly from alternate-screen mode.
 *
 * A small delay is intentionally introduced to allow pending stdout writes
 * to flush before restoration occurs.
 *
 * @returns Promise resolved after cleanup completes
 *
 * @since 1.0.0
 */
const cleanup = async () => {
    await new Promise<void>((resolve) => {
        setTimeout(resolve, 200);
    });

    process.stdout.write('\x1b[?1049l');
}

/**
 * Initializes the terminal rendering environment.
 *
 * Responsibilities:
 *
 * - switches the terminal into alternate-screen mode
 * - registers process cleanup handlers
 * - guarantees one-time initialization semantics
 *
 * This function is idempotent.
 *
 * @since 1.0.0
 */
const initialize = () => {
    if (initialized) { return }

    process.stdout.write('\x1b[?1049h');

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

/**
 * State-driven terminal rendering engine.
 *
 * `ScreenEngine` manages a collection of {@link ScreenCell} instances and
 * efficiently synchronizes their rendered output into the terminal using
 * snapshot-based positional diffing.
 *
 * Core responsibilities:
 *
 * - maintain terminal layout state
 * - track rendered line positions
 * - minimize terminal writes during updates
 * - perform cascading re-renders when layout structure changes
 * - preserve visual consistency during dynamic updates
 *
 * ## Rendering model
 *
 * Each screen cell maps to a positional snapshot entry containing:
 *
 * - rendered value
 * - visual height
 * - absolute starting row
 *
 * Updates are processed incrementally:
 *
 * - unchanged heights → localized rewrite
 * - changed heights → cascading reflow below the updated entry
 *
 * This architecture behaves similarly to a virtualized terminal DOM.
 *
 * @since 1.0.0
 */
class ScreenEngine {
    /**
     * Internal positional screen layout snapshot.
     *
     * Tracks rendered entries, heights, and absolute terminal positions.
     *
     * @since 1.0.0
     */
    readonly #_snapshot = new ScreenLayout();

    /**
     * Internal rendering and update helper utilities.
     *
     * These helpers encapsulate low-level rendering mechanics and are not part
     * of the public API surface.
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
         * - trigger rendering pipeline
         *
         * Cascade rendering becomes necessary when the visual height changes,
         * because all subsequent entries shift vertically.
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
         * Rendering strategy depends on whether layout structure changed:
         *
         * ## Non-structural update
         *
         * - move cursor to entry start
         * - clear current line
         * - rewrite entry only
         *
         * ## Structural update
         *
         * - clear everything below the updated entry
         * - rewrite updated entry
         * - re-render all downstream entries
         *
         * After rendering completes, the cursor is restored to the logical end
         * of the screen output.
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

            // If height didn't change, clear only the current line
            if (!cascade.required) {
                process.stdout.clearLine(1);
            }

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
            process.stdout.cursorTo(0, snapshot.height);
        }
    }

    /**
     * Creates a new screen rendering engine.
     *
     * Automatically initializes the terminal rendering subsystem.
     *
     * @since 1.0.0
     */
    constructor() {
        initialize();
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
     * @since 1.0.0
     */
    newLine() {
        this.create({ value: '', final: true });
    }

    /**
     * Clears the entire rendered screen state.
     *
     * Responsibilities:
     *
     * - reset cursor position
     * - clear visible terminal output
     * - reset internal layout snapshot
     *
     * @since 1.0.0
     */
    clear() {
        process.stdout.cursorTo(0, 0);
        process.stdout.clearScreenDown();
        this.#_snapshot.clear();
    }
}

export default ScreenEngine;