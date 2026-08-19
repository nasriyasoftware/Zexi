import atomix from "@nasriya/atomix";
import ScreenCell from "./cell";
import type {
    TerminalEntryParamsUpdateOptions,
    TerminalEntryUpdateLogger,
    TerminalEntryUpdateOptions
} from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Represents a dynamic entry in the terminal output.
 *
 * A terminal entry provides a persistent region of terminal output that can
 * be updated independently after it has been created.
 *
 * Entries are useful for dynamic terminal output such as:
 *
 * - progress indicators
 * - download status
 * - build or deployment status
 * - counters and statistics
 * - long-running task status
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE
 * ---------------------------------------------------------------------
 *
 * ## Progress indicator
 *
 * ```ts
 * const download = await zexi.terminal.createEntry({
 *     template: 'Downloading package... ${value}%',
 *     params: { value: 0 }
 * });
 *
 * download.updateParams({ value: 25 });
 * download.updateParams({ value: 50 });
 * download.updateParams({ value: 75 });
 * download.updateParams({ value: 100 });
 *
 * download.update('Download complete.');
 * ```
 *
 * ## Build status
 *
 * ```ts
 * const build = await zexi.terminal.createEntry({
 *     value: 'Building project...'
 * });
 *
 * await buildProject();
 * build.update('Build complete.');
 * ```
 *
 * ## Live statistics
 *
 * ```ts
 * const stats = await zexi.terminal.createEntry({
 *     template: 'Processed: ${processed} / ${total}',
 *     params: {
 *         processed: 0,
 *         total: 1000
 *     }
 * });
 *
 * for (let processed = 0; processed <= 1000; processed += 100) {
 *     stats.updateParams({ processed });
 * }
 * ```
 *
 * An entry can be permanently finalized once its output is complete:
 *
 * ```ts
 * const task = await zexi.terminal.createEntry({
 *     value: 'Running task...'
 * });
 *
 * await runTask();
 *
 * task.update('Task complete.');
 * task.finalize();
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 LOGGING
 * ---------------------------------------------------------------------
 *
 * Entry updates do not produce log events by default.
 *
 * Logging can be explicitly requested for an individual update:
 *
 * ```ts
 * entry.update('Build complete.', {
 *     log: true,
 *     level: 'info'
 * });
 * ```
 *
 * Template parameter updates support the same logging behavior:
 *
 * ```ts
 * entry.updateParams(
 *     { status: 'Failed' },
 *     {
 *         log: true,
 *         level: 'error'
 *     }
 * );
 * ```
 *
 * When an update is logged, the resulting rendered entry value is recorded as
 * the log message.
 *
 * The initial value of an entry can also be logged when the entry is created:
 *
 * ```ts
 * const entry = await zexi.terminal.createEntry(
 *     { value: 'Server started.' },
 *     { log: true, level: 'info' }
 * );
 * ```
 *
 * Logging an entry does not cause the entry to be rendered a second time.
 *
 * @since 1.0.0
 */
class TerminalEntry extends ScreenCell {
    #_logger?: TerminalEntryUpdateLogger;

    /**
     * Creates a terminal entry from the supplied configuration.
     *
     * This constructor is used internally when creating entries through the
     * terminal API. Entries should normally be created with
     * {@link ZexiTerminal.createEntry}.
     *
     * @param args - Entry construction arguments.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(...args: ConstructorParameters<typeof ScreenCell>) {
        super(...args);
    }

    /**
     * Updates the rendered value of the terminal entry directly.
     *
     * The supplied string completely replaces the current entry output.
     * Direct updates do not modify the entry's active template or stored
     * template parameters.
     *
     * ---------------------------------------------------------------------
     * 🔷 DIRECT UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * entry.update('Downloading package...');
     * ```
     *
     * The supplied value becomes the entry's new visible output.
     *
     * ---------------------------------------------------------------------
     * 🔷 LOGGING
     * ---------------------------------------------------------------------
     *
     * Updates do not produce log events by default.
     *
     * A particular update can be logged explicitly:
     *
     * ```ts
     * entry.update('Download complete.', {
     *     log: true,
     *     level: 'info'
     * });
     * ```
     *
     * When logging is enabled, the resulting rendered entry value is recorded
     * as the log message using the specified log level.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the entry after the new value has
     * been applied.
     *
     * When `final` is `true`:
     *
     * - the value is updated
     * - the entry becomes immutable
     * - subsequent updates are rejected
     *
     * @param value - New rendered output value
     * @param options - Update and logging configuration
     *
     * @throws Error if the entry has already been finalized
     *
     * @since 1.0.0
     */
    override update(
        value: string,
        options?: TerminalEntryUpdateOptions
    ): void {
        const updateOptions: Record<string, unknown> = {};
        if (options && hasOwnProp(options, 'final')) {
            updateOptions.final = options.final;
        }

        super.update(value, updateOptions);

        this.#_logger!(this.value, {
            log: options?.log ?? false,
            level: options?.level ?? 'info'
        });
    }

    /**
     * Updates the template parameters used to render the terminal entry.
     *
     * The entry must have an active template before template parameters can be
     * updated. The supplied parameters are applied to the template and the
     * entry is re-rendered.
     *
     * ---------------------------------------------------------------------
     * 🔷 PARAMETER UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * entry.updateParams({ progress: 50 });
     * ```
     *
     * The resulting rendered value becomes the entry's new visible output.
     *
     * ---------------------------------------------------------------------
     * 🔷 TEMPLATE PATCHING
     * ---------------------------------------------------------------------
     *
     * By default, supplied parameters are merged with the parameters already
     * stored by the entry:
     *
     * ```ts
     * entry.updateParams({ progress: 50 });
     * entry.updateParams({ status: 'Downloading' });
     * ```
     *
     * Setting `patch` to `false` replaces all previously stored parameters
     * before applying the supplied values.
     *
     * ```ts
     * entry.updateParams(
     *     { progress: 100 },
     *     { patch: false }
     * );
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 LOGGING
     * ---------------------------------------------------------------------
     *
     * Parameter updates do not produce log events by default.
     *
     * A particular update can be logged explicitly:
     *
     * ```ts
     * entry.updateParams(
     *     { status: 'Failed' },
     *     {
     *         log: true,
     *         level: 'error'
     *     }
     * );
     * ```
     *
     * When logging is enabled, the resulting rendered entry value is recorded
     * as the log message using the specified log level.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the entry after the parameters have
     * been applied and the template has been rendered.
     *
     * When `final` is `true`:
     *
     * - the parameters are updated
     * - the entry is re-rendered
     * - the entry becomes immutable
     * - subsequent updates are rejected
     *
     * @param params - Template parameters to apply
     * @param options - Parameter update, finalization, and logging configuration
     *
     * @throws Error if the entry has already been finalized
     * @throws Error if no template is assigned to the entry
     *
     * @since 1.0.0
     */
    override updateParams(
        params: Record<string, unknown>,
        options?: TerminalEntryParamsUpdateOptions
    ): void {
        const updateOptions: Record<string, unknown> = {};
        if (options) {
            if (hasOwnProp(options, 'final')) {
                updateOptions.final = options.final;
            }

            if (hasOwnProp(options, 'patch')) {
                updateOptions.patch = options.patch;
            }
        }

        super.updateParams(params, updateOptions);

        this.#_logger!(this.value, {
            log: options?.log ?? false,
            level: options?.level ?? 'info'
        });
    }

    /**
     * Attaches the logging handler used by a terminal entry.
     *
     * This method is used internally by the terminal when an entry is created.
     * The handler allows entry updates to participate in the terminal's
     * logging system when logging is explicitly requested.
     *
     * @param terminal - Terminal entry receiving the logging handler.
     * @param handler - Logging handler used for entry updates.
     *
     * @throws Error if a logging handler has already been attached.
     *
     * @internal
     * @since 1.0.0
     */
    static attachLogger(
        terminal: TerminalEntry,
        handler: TerminalEntryUpdateLogger
    ) {
        if (terminal.#_logger) {
            throw new Error('Invariant violation: logger is already attached.');
        }

        terminal.#_logger = handler;
    }
}

export default TerminalEntry;