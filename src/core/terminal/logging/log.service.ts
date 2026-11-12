import buildStack from "../pipeline/1-graphing/helpers/build.stack";
import TOKENS from "../pipeline/3-tokenization/tokens";
import DefaultTokenizer from "../pipeline/3-tokenization/tokenizers/default.tokenizer";
import JSONTokenizer from "../pipeline/3-tokenization/tokenizers/json.tokenizer";
import DebugRenderer from "../pipeline/4-rendering/renderers/debug/renderer";
import JSONRenderer from "../pipeline/4-rendering/renderers/json/renderer";

import ZexiTerminalControllerInstance from "../controller/controller";
import consoleStyler from "../styling/styler";
import atomix from "@nasriya/atomix";

import { ZEXI_LOG_LEVELS, ZexiTerminalConfigs, type TerminalLogOptions, type ZexiLogLevel } from "../types";
import type { TerminalEventName, TerminalLogEvent } from "../events/types";
import type { JsonOptions } from "../pipeline/4-rendering/renderers/json/types";
import type { DebugOptions } from "../pipeline/4-rendering/renderers/debug/types";

const ct = ZexiTerminalControllerInstance;

/**
 * Implements the log-event processing and output service composed into
 * `ZexiTerminal`.
 *
 * `TerminalLogService` prepares log values and events, dispatches those events
 * through the shared terminal event system, and optionally schedules their
 * printable representations on the shared terminal task queue. It does not
 * own a screen or event emitter of its own.
 *
 * Each instance receives its own {@link ZexiTerminalConfigs}. Its configured
 * log level and metadata preference affect only whether and how that instance
 * prints a log event; they do not affect event creation or event delivery.
 * The owning terminal supplies a screen-initialization callback so printing
 * can preserve the terminal's initialization ordering without making the
 * service responsible for terminal lifecycle management.
 *
 * ---------------------------------------------------------------------
 * 🔷 LOGGING
 * ---------------------------------------------------------------------
 *
 * The service supports the `debug`, `info`, `warn`, `error`, and `fatal`
 * levels. Each logging method accepts any value and optional
 * {@link TerminalLogOptions}.
 *
 * A log operation:
 *
 * 1. Clones the supplied value so the event represents the value as it was
 *    passed to the service.
 * 2. Produces a canonical JSON representation and a printable representation.
 *    The printable representation uses the selected `target` renderer, or
 *    defaults to the debug renderer for `debug()` and the JSON renderer for
 *    other levels.
 * 3. Creates a log event with a unique identifier, timestamp, level, and
 *    representations of the value. If `trace` is enabled, the event also
 *    contains the caller's stack trace.
 * 4. Starts delivery through the level-specific `log.<level>` event followed
 *    by the general `log` event. Both events receive the same deeply frozen
 *    event object.
 * 5. When `print` is enabled and the event meets this instance's configured
 *    log level, schedules its printable representation on the shared terminal
 *    task queue.
 *
 * Event delivery is independent of terminal printing. Events are still
 * dispatched when printing is disabled with `print: false` or when the event
 * is below the configured log level. Printing is queued and is not completed
 * synchronously by the logging method.
 *
 * ---------------------------------------------------------------------
 * 🔷 PRINTING
 * ---------------------------------------------------------------------
 *
 * The configured log level is a minimum severity: this service prints events
 * at that level and above. It never uses the print threshold to filter event
 * creation or event delivery.
 *
 * When metadata is enabled, the printed line includes the event timestamp and
 * uppercase level. Primitive values are styled for their severity; structured
 * values use their rendered representation. An included stack trace is
 * appended to the printed output.
 *
 * The `ansi` option controls ANSI handling during rendering. If it is omitted,
 * the default is selected from the log level and value: it is enabled for
 * `debug` and `info` messages, and for non-primitive values; otherwise it is
 * disabled.
 *
 * This option controls the rendered value stored in `event.value.printable`.
 * The print path adds severity colors separately to primitive values and
 * metadata, and trace text is currently rendered with ANSI enabled regardless
 * of this option. Consequently, `ansi: false` does not guarantee that the
 * complete queued terminal line is free of ANSI sequences.
 *
 * @example
 * ```ts
 * terminal.info({ status: "ready" });
 *
 * // Still dispatches log.info and log when terminal printing is suppressed.
 * terminal.info("Ready", { print: false });
 *
 * // Includes a caller trace in the emitted event and printed output.
 * terminal.error(new Error("Request failed"), { trace: true });
 * ```
 *
 * @internal
 * @since 1.0.0
 */
class TerminalLogService {
    /**
     * Stateless utilities shared by all terminal instances.
     *
     * These utilities are kept separate from instance helpers because they do
     * not depend on a terminal instance's configuration or state.
     *
     * @internal
     *
     * @since 1.0.0
     */
    static #_utils = {
        /**
         * Generates a stack trace representing the caller of a terminal
         * operation.
         *
         * @returns The normalized stack trace.
         *
         * @internal
         * @since 1.0.0
         */
        generateStack: () => buildStack(new Error().stack ?? ''),

        /**
         * Determines whether a value is a JavaScript primitive.
         *
         * Functions and objects are considered non-primitive. `null` and
         * `undefined` are considered primitive for terminal formatting
         * purposes.
         *
         * @param value Value to classify.
         * @returns `true` when the value is primitive; otherwise `false`.
         *
         * @internal
         * @since 1.0.0
         */
        isPrimitive: (value: unknown): boolean => {
            return (
                value === null ||
                value === undefined ||
                typeof value !== 'object' &&
                typeof value !== 'function'
            );
        },

        /**
         * Internal rendering operations used to produce terminal output.
         *
         * These renderers are intentionally kept behind the terminal API so
         * callers do not need to interact with the rendering pipeline directly.
         *
         * @internal
         * @since 1.0.0
         */
        render: {
            /**
             * Renders a value using the canonical JSON renderer.
             *
             * @param value Value to render.
             * @param options JSON renderer options.
             * @returns The rendered JSON representation.
             *
             * @internal
             * @since 1.0.0
             */
            json: (value: unknown, options?: JsonOptions) => {
                const tokens = JSONTokenizer(value);
                return JSONRenderer.render(tokens, options ?? {});
            },

            /**
             * Renders a value using the debug renderer.
             *
             * @param value Value to render.
             * @param options Debug renderer options.
             * @returns The rendered debug representation.
             *
             * @internal
             * @since 1.0.0
             */
            debug: (value: unknown, options?: DebugOptions) => {
                const tokens = DefaultTokenizer(value, options?.cycles ?? 'mark');
                return DebugRenderer.render(tokens, options ?? {});
            }
        }
    }

    /**
     * Resolved configuration used only when deciding whether and how this
     * service prints an event.
     *
     * This is retained by reference rather than copied. `ZexiTerminal`
     * initializes and updates the shared configuration object during
     * construction; the service therefore observes the final per-instance
     * settings without maintaining a second copy. The event pipeline does not
     * consult these settings, so log events are still created and emitted when
     * a level is filtered from terminal output.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_configs: ZexiTerminalConfigs;

    /**
     * Callback supplied by the owning terminal to ensure screen initialization
     * is queued before this service schedules printable output.
     *
     * Keeping initialization in the owner avoids coupling the service to
     * terminal setup policy while preserving the ordering required for screen
     * writes.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_ensureScreenInitialized: () => void;

    /**
     * Freezes a completed log event and dispatches it to the shared event
     * emitter.
     *
     * The level-specific event is emitted first (`log.debug`, `log.info`,
     * `log.warn`, `log.error`, or `log.fatal`), followed by the general `log`
     * event. Both emissions receive the same deeply frozen object, so listeners
     * cannot mutate event data observed by later listeners or by the second
     * emission. The `await`s preserve this order and allow each emission to
     * finish before the next begins.
     *
     * The caller intentionally starts this asynchronous work without awaiting
     * it so the public logging methods remain synchronous. Consequently, event
     * listener work is not part of the public method's completion.
     *
     * @param event - Mutable draft assembled by {@link #_log}; it is frozen
     * before being exposed to listeners.
     * @returns A promise that resolves after both event emissions complete.
     *
     * @internal
     * @since 1.0.0
     */
    async #_logEvent(event: TerminalLogEvent): Promise<void> {
        const e = atomix.dataTypes.object.deepFreeze(event);
        await ct.events.emit<TerminalEventName>(`log.${e.level}`, e);
        await ct.events.emit('log', e);
    }

    /**
     * Applies this instance's print threshold and, when allowed, queues the
     * terminal representation of an event.
     *
     * The configured level is a minimum severity. Since
     * {@link ZEXI_LOG_LEVELS} is ordered from least to most severe, events
     * below the configured level return without creating terminal output.
     * This filter is deliberately limited to printing; it does not suppress
     * the event's creation or dispatch.
     *
     * For printable events, this method assembles the optional timestamp and
     * uppercase-level metadata, styles primitive values according to severity,
     * preserves the renderer's representation for structured values, and
     * appends a rendered trace when present. It then submits a logging task to
     * the shared queue. The screen cell is created by that queued task rather
     * than synchronously here.
     *
     * Severity styling is applied here independently of the log operation's
     * ANSI rendering option. Therefore primitive values and enabled metadata
     * may still contain ANSI sequences when the event's printable value is
     * plain text.
     *
     * @param event - Fully assembled log event whose printable fields are
     * used to create terminal output.
     * @returns Nothing. A below-threshold event is ignored; otherwise screen
     * output is scheduled on the shared terminal task queue.
     *
     * @internal
     * @since 1.0.0
     */
    #_print(event: TerminalLogEvent) {
        if (
            ZEXI_LOG_LEVELS.indexOf(this.#_configs.logLevel)
            > ZEXI_LOG_LEVELS.indexOf(event.level)
        ) {
            return;
        }

        const color = (() => {
            switch (event.level) {
                case 'fatal':
                case 'error':
                    return 'red';
                case 'warn':
                    return 'yellow';
                default:
                    return 'white';
            }
        })();

        const parts: string[] = [];

        if (this.#_configs.includeMetadata) {
            const tag = `[${event.time}][${event.level.toUpperCase()}]`.padEnd(33);
            parts.push(consoleStyler.color(tag, color));
        }

        if (TerminalLogService.#_utils.isPrimitive(event.value.original)) {
            parts.push(consoleStyler.color(event.value.printable, color));
        } else {
            parts.push(event.value.printable);
        }

        if (event.trace) {
            parts.push(`${event.trace.printable}\n`);
        }

        const message = parts.join(' ');

        this.#_ensureScreenInitialized();

        // Queue the screen operation; rendering the cell is owned by the task.
        ct.queue.addTask({
            priority: 1,
            type: 'logging',
            action: () => ct.screenEngine.create({ value: message, final: true })
        });
    }

    /**
     * Runs the shared processing pipeline for one log level.
     *
     * This method keeps the public level-specific methods small and ensures
     * they all produce events and terminal output consistently. Processing
     * uses a smart clone of the supplied value so subsequent caller mutation
     * does not alter the data captured in the event. It renders a canonical
     * JSON form for the event's serialized value, then selects either the JSON
     * or debug renderer for the printable value. The default target is `debug`
     * for debug-level events and `json` for all other levels.
     * The ANSI option is applied to this value representation and to
     * `event.value.printable`; it does not control the separate severity
     * styling applied by `#_print` or the ANSI-enabled trace representation.
     *
     * When trace collection is requested, the caller stack is normalized and
     * added to the event as both structured and printable data. Event
     * dispatch is initiated for every call, regardless of the `print` option
     * or the configured print threshold. The optional print path is separate:
     * `print: false` skips it, while {@link #_print} applies the threshold and
     * queues output when eligible.
     *
     * This method does not await event dispatch or terminal queue processing.
     * It therefore completes synchronously after preparing the event and
     * starting the relevant asynchronous/queued work.
     *
     * @param level - Severity assigned to the event and used for default
     * renderer and ANSI selection.
     * @param toLog - Caller-supplied value to clone, render, and include in
     * the event.
     * @param options - Per-call rendering, trace, ANSI, and printing choices.
     *
     * @internal
     * @since 1.0.0
     */
    #_log(
        level: ZexiLogLevel,
        toLog: unknown,
        options?: TerminalLogOptions
    ) {
        const ansiEnabled = options?.ansi ?? (
            level === 'debug' ||
            level === 'info' ||
            !TerminalLogService.#_utils.isPrimitive(toLog)
        );

        const value = atomix.dataTypes.object.smartClone(toLog);

        const target = options?.target ?? (level === 'debug' ? 'debug' : 'json');
        const mode = 'pretty' as const;
        const trace = options?.trace === true;
        const print = options?.print === false ? false : true;

        const baseConfigs = { mode, ansiEnabled }

        const jsonRenderer = () => TerminalLogService.#_utils.render.json(value, baseConfigs);
        const debugRenderer = () => TerminalLogService.#_utils.render.debug(value, baseConfigs);

        const json = jsonRenderer();
        const serialized = consoleStyler.strip(json).replace(/\s+/g, '');
        const printable = (() => {
            const rendered = target === 'debug' ? debugRenderer() : json;
            return ansiEnabled ? rendered : consoleStyler.strip(rendered);
        })();

        const draft: TerminalLogEvent = {
            id: crypto.randomUUID(),
            time: new Date().toISOString(),
            name: `log.${level}`,
            level: level,
            value: {
                original: value,
                serialized,
                printable
            }
        }

        if (trace) {
            const stack = TerminalLogService.#_utils.generateStack();
            const printable = DebugRenderer.render(
                [new TOKENS.StackTrace(stack)],
                { mode: 'compact', ansiEnabled: true }
            );

            draft.trace = { original: stack, printable };
        }

        void this.#_logEvent(draft);

        if (print) {
            // Print to the console if the log level is high enough
            this.#_print(draft);
        }
    }

    /**
     * Creates a log service with the resolved configuration for one terminal
     * instance.
     *
     * The configuration controls this instance's print threshold and metadata
     * display. The logger continues to use the shared terminal event system
     * and task queue.
     *
     * @param configs - Resolved logging configuration for this instance.
     * @param ensureScreenInitialized - Owner-provided hook that queues screen
     * initialization before printable output is queued.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(
        configs: ZexiTerminalConfigs,
        ensureScreenInitialized: () => void
    ) {
        this.#_configs = configs;
        this.#_ensureScreenInitialized = ensureScreenInitialized;
    }

    /**
     * Emits a value that has already been rendered for a dynamic terminal
     * entry.
     *
     * Entry updates already carry their final terminal representation, so this
     * path deliberately skips cloning, serialization, rendering, trace
     * capture, print-threshold filtering, and screen output. It validates that
     * the representation is a string, creates a log event whose original,
     * printable, and serialized fields describe that rendered value, then
     * dispatches the frozen event through the same ordered event path as
     * ordinary log operations.
     *
     * @param level - Severity assigned to the entry update event.
     * @param value - Already-rendered entry representation.
     * @throws {TypeError} If `value` is not a string.
     *
     * @internal
     * @since 1.0.0
     */
    logEntry(level: ZexiLogLevel, value: string): void {
        if (typeof value !== 'string') {
            throw new TypeError(`Expected \`value\` to be a string, received \`${typeof value}\``);
        }

        const draft: TerminalLogEvent = {
            id: crypto.randomUUID(),
            time: new Date().toISOString(),
            name: `log.${level}`,
            level,
            value: {
                original: value,
                serialized: consoleStyler.strip(value),
                printable: value
            }
        };

        void this.#_logEvent(draft);
    }

    /**
     * Logs a value at the `fatal` level.
     *
     * Fatal messages represent the highest-severity condition. The operation
     * creates and dispatches a `log.fatal` event followed by the general
     * `log` event. If printing is enabled and this instance's log-level
     * threshold allows it, the printable message is scheduled on the terminal
     * task queue.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, ANSI, and printing options.
     *
     * @see {@link TerminalLogOptions}
     *
     * @since 1.0.0
     */
    fatal(value: unknown, options?: TerminalLogOptions): void {
        return this.#_log('fatal', value, options);
    }

    /**
     * Logs a value at the `error` level.
     *
     * Error messages represent serious failures that occurred during
     * application execution. The operation creates and dispatches a
     * `log.error` event followed by the general `log` event. If printing is
     * enabled and this instance's log-level threshold allows it, the printable
     * message is scheduled on the terminal task queue.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, ANSI, and printing options.
     *
     * @see {@link TerminalLogOptions}
     *
     * @since 1.0.0
     */
    error(value: unknown, options?: TerminalLogOptions): void {
        return this.#_log('error', value, options);
    }

    /**
     * Logs a value at the `warn` level.
     *
     * Warning messages indicate potentially problematic conditions that do not
     * necessarily prevent the application from continuing. The operation
     * creates and dispatches a `log.warn` event followed by the general
     * `log` event. If printing is enabled and this instance's log-level
     * threshold allows it, the printable message is scheduled on the terminal
     * task queue.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, ANSI, and printing options.
     *
     * @see {@link TerminalLogOptions}
     *
     * @since 1.0.0
     */
    warn(value: unknown, options?: TerminalLogOptions): void {
        return this.#_log('warn', value, options);
    }

    /**
     * Logs a value at the `info` level.
     *
     * Informational messages describe normal application activity or state.
     * The operation creates and dispatches a `log.info` event followed by the
     * general `log` event. If printing is enabled and this instance's log-level
     * threshold allows it, the printable message is scheduled on the terminal
     * task queue.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, ANSI, and printing options.
     *
     * @see {@link TerminalLogOptions}
     *
     * @since 1.0.0
     */
    info(value: unknown, options?: TerminalLogOptions): void {
        return this.#_log('info', value, options);
    }

    /**
     * Logs a value at the `debug` level.
     *
     * Debug messages are intended for detailed diagnostic information. The
     * operation creates and dispatches a `log.debug` event followed by the
     * general `log` event. If printing is enabled and this instance's log-level
     * threshold allows it, the printable message is scheduled on the terminal
     * task queue.
     *
     * Unless overridden by `options.target`, debug values use the debug
     * renderer rather than the JSON renderer.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, ANSI, and printing options.
     *
     * @see {@link TerminalLogOptions}
     *
     * @since 1.0.0
     */
    debug(value: unknown, options?: TerminalLogOptions): void {
        return this.#_log('debug', value, options);
    }
}

export default TerminalLogService;