import atomix from "@nasriya/atomix";
import terminalIO from "../../io";
import TerminalViewport from "./viewport/viewport";
import ScreenCell from "./cells/cell";
import TerminalCell from "./cells/terminal.cell";
import EntriesManager from "./entries/entry.manager";
import type { TerminalCellOptions } from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Coordinates cell state, logical entries, and viewport rendering.
 *
 * The terminal object model (TOM) is the state-and-layout layer beneath the
 * screen engine. It creates screen cells, maintains one logical entry for each
 * cell, and connects cell lifecycle notifications to the entry manager and
 * viewport. As cell values change or disappear, TOM updates logical line
 * positions and asks the viewport to reconcile the terminal rows it owns.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITY BOUNDARY
 * ---------------------------------------------------------------------
 *
 * TOM coordinates the rendering model but does not initialize terminal I/O,
 * choose the active terminal screen, or independently parse terminal
 * dimensions. Terminal I/O owns screen selection, cursor and size queries,
 * stream readiness, and initialization state. Cell creation is valid only
 * after terminal I/O reports that initialization is complete.
 *
 * ---------------------------------------------------------------------
 * 🔷 INSTANCE STATE AND CLEARING
 * ---------------------------------------------------------------------
 *
 * Each TOM instance owns one entry manager and one viewport for its lifetime.
 * Clearing empties the manager and resets viewport bookkeeping after the
 * caller has cleared terminal output. It does not destroy previously returned
 * cell objects. Their callbacks still carry their old identities, which no
 * longer resolve in the empty manager, so they cannot recreate cleared entries.
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE SUBSCRIPTIONS
 * ---------------------------------------------------------------------
 *
 * Construction subscribes to terminal resize events and the process `exit`
 * event. Resize reflows all entries at the new width before rendering. Process
 * exit writes a final newline only when the last managed logical line contains
 * text, so the shell prompt does not follow non-empty managed output on the
 * same line.
 *
 * @internal This class is an implementation detail of the screen engine.
 * @since 1.0.0
 */
class TerminalObjectModel {
    /**
     * Ordered logical entries that back the cells created by this TOM instance.
     *
     * The manager owns stable entry identities, logical-line numbering,
     * aggregate height, and the repositioning or reflow of subsequent entries.
     * It is the source of truth for cell-backed content consumed by the
     * viewport.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_entries = new EntriesManager;

    /**
     * Maps managed logical lines to terminal rows and renders changes.
     *
     * The viewport reads directly from {@link #_entries}; it does not maintain
     * a second copy of entry content. Its row buffer avoids redundant terminal
     * writes, records which rows TOM has touched, and allows stale managed
     * output to be cleared when no logical line backs a row anymore.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_viewport: TerminalViewport;

    /**
     * Internal operations that bind cell creation and lifecycle callbacks to TOM.
     *
     * Internal and externally exposed cells use the same registration, update,
     * removal, and rendering pipeline. Only the returned cell class differs;
     * the entry identity and callbacks are allocated in the same way.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Registers the initial entry state and creates its cell callbacks.
         *
         * A supplied direct string is placed in the entry before the cell is
         * constructed, so the first viewport render can include it. A
         * template-and-parameters configuration starts with an empty entry;
         * after construction renders the template, the cell's value is sent
         * through the regular update callback. The `hasValue` result tells
         * {@link create} whether that initial synchronization is required.
         *
         * Registration precedes cell creation so initial rendering follows the
         * same callback path and stable identity model as later updates. The
         * helper first checks terminal readiness and throws before registering
         * anything when terminal I/O is not ready.
         *
         * @param config - Initial cell configuration, including error-output
         * metadata.
         * @returns The stable entry identity, its callbacks, and a flag showing
         * whether the initial value was supplied directly as a string.
         *
         * @throws Error if terminal I/O has not completed initialization.
         *
         * @internal
         * @since 1.0.0
         */
        createEntry: (config: TerminalCellOptions) => {
            if (!terminalIO.isReady) {
                throw new Error('Invatiant violation: Attempting to create a cell before terminal is ready.');
            }

            const providedValue = (() => {
                const data = config as Record<string, unknown>;
                return hasOwnProp(data, 'value') && typeof data.value === 'string' ? data.value : undefined
            })();

            const { id, height } = this.#_entries.create(
                providedValue ?? '',
                { isError: config.isError === true }
            );

            this.#_viewport.updatePosition(height, { forNewEntry: true });
            this.#_viewport.render();

            const events = {
                /**
                 * Applies the cell's complete rendered content to its TOM entry.
                 *
                 * The manager replaces the full entry content and returns
                 * `null` when the identity is no longer managed, such as after
                 * a clear or removal. Missing entries are ignored. Existing
                 * entries update their logical lines, adjust viewport position
                 * by the entry's height delta, and trigger reconciliation even
                 * when the content change did not alter height.
                 *
                 * @param content - Complete rendered cell content.
                 * @returns Whether the entry's height changed. Returns `false`
                 * when the entry no longer exists.
                 *
                 * @internal
                 * @since 1.0.0
                 */
                onUpdate: (content: string) => {
                    const updateRange = this.#_entries.update(id, content);
                    if (!updateRange) { return false; }

                    this.#_viewport.updatePosition(updateRange.heightDelta);
                    this.#_viewport.render();

                    return updateRange.heightDelta !== 0;
                },

                /**
                 * Removes this cell's entry at most once and renders the result.
                 *
                 * The one-shot wrapper protects the entry manager from duplicate
                 * removal notifications. The return range from the manager is
                 * not needed for rendering because the viewport performs a
                 * complete reconciliation and clears rows no longer occupied.
                 *
                 * @internal
                 * @since 1.0.0
                 */
                onRemove: atomix.utils.once(() => {
                    this.#_entries.remove(id);
                    this.#_viewport.render();
                })
            }

            return {
                id,
                events,
                hasValue: providedValue !== undefined,
            };
        }
    }

    /**
     * Creates the viewport and subscribes to terminal lifecycle events.
     *
     * On resize, the entry manager reparses every retained value at the current
     * terminal width and recomputes all logical positions before the viewport
     * redraws. The process-exit listener checks only the final generated line;
     * it writes one newline if that line has non-empty text and does nothing
     * when there are no entries or the last line is empty.
     *
     * The listeners remain associated with the lifetime of this TOM instance.
     *
     * @internal
     * @since 1.0.0
     */
    constructor() {
        this.#_viewport = new TerminalViewport(this.#_entries);

        terminalIO.events.on('resize', event => {
            this.#_entries.refresh();
            this.#_viewport.render();
        });

        process.on('exit', () => {
            const lastEntry = this.#_entries.entries.at(-1);
            if (!lastEntry) { return; }

            const lastLine = lastEntry.lines.at(-1);
            if (!lastLine) { return; }

            const value = lastLine.text;

            if (value.length > 0) {
                terminalIO.output.write('\n');
            }
        })
    }

    /**
     * Creates a cell and registers it with the shared TOM rendering pipeline.
     *
     * A direct initial value is included in the entry before the cell is
     * constructed. A template-and-parameters cell is registered with an empty
     * entry, constructed so it can render its template, and then synchronized
     * through the same update callback used by later changes.
     *
     * The target selects the returned cell class, not a different rendering
     * model:
     * {@link ScreenCell} is used internally, while {@link TerminalCell}
     * includes logging support for externally exposed cells.
     *
     * @typeParam T - Selects the internal or external cell class.
     * @param config - Initial direct value or template-based cell configuration.
     * @param target - `'external'` returns a {@link TerminalCell}; omitted or
     * `'internal'` returns a {@link ScreenCell}.
     * @returns The cell registered with this TOM instance and selected by
     * `target`. The returned cell's callbacks close over the newly allocated
     * entry identity.
     *
     * @throws Error if terminal I/O is not ready.
     *
     * @internal
     * @since 1.0.0
     */
    create<T extends 'internal' | 'external'>(
        config: TerminalCellOptions,
        target?: T
    ): T extends 'external' ? TerminalCell : ScreenCell {
        const entry = this.#_helpers.createEntry(config);

        const cell = target === 'external'
            ? new TerminalCell(entry.events, config)
            : new ScreenCell(entry.events, config);

        if (!entry.hasValue) {
            // Perform initial render.
            entry.events.onUpdate(cell.value);
        }

        return cell;
    }

    /**
     * Removes all managed entries and resets the viewport's logical position
     * and row cache.
     *
     * The caller is responsible for clearing terminal output before invoking
     * this method; `clear()` itself performs no terminal write. Resetting both
     * entry state and viewport bookkeeping prevents later content from
     * inheriting stale line offsets or being mistaken for already-rendered
     * output.
     *
     * Previously returned cell objects are not destroyed or marked removed.
     * Their callbacks cannot find the cleared entry identities and therefore
     * do not recreate entries or trigger viewport rendering.
     *
     * @internal
     * @since 1.0.0
     */
    clear() {
        this.#_entries.clear();
        this.#_viewport.reset();
    }
}

export default TerminalObjectModel;