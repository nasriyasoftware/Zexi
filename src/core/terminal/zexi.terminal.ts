import atomix from "@nasriya/atomix";
import buildStack from "./pipeline/1-graphing/helpers/build.stack";
import consoleStyler from "./styling/styler";
import cursorPosition from "./screen/cursor-position";

import TerminalEntry from "./screen/terminal-cell";
import TOKENS from "./pipeline/3-tokenization/tokens";
import ZexiTerminalControllerInstance from "./controller/controller";
import JSONRenderer from "./pipeline/4-rendering/renderers/json/renderer";
import DefaultRenderer from './pipeline/4-rendering/renderers/debug/renderer';
import JSONTokenizer from "./pipeline/3-tokenization/tokenizers/json.tokenizer";
import DefaultTokenizer from "./pipeline/3-tokenization/tokenizers/default.tokenizer";

import { ZEXI_LOG_LEVELS } from "./types";
import type { JsonOptions } from "./pipeline/4-rendering/renderers/json/types";
import type { DebugOptions } from "./pipeline/4-rendering/renderers/debug/types";
import type { TerminalLogOptions, ZexiLogLevel, ZexiTerminalOptions } from "./types";
import type { TerminalEventName, TerminalEvents, TerminalLogEvent, UnsubscribeHandler } from "./events/types";
import type { TerminalCellOptions, TerminalEntryCellTask, TerminalEntryLogOptions, TerminalEntryUpdateLogger } from "./screen/types";

/**
 * Stable queue task identifier used for terminal cursor-position
 * initialization.
 *
 * The identifier allows the terminal task queue to recognize an existing
 * cursor-position initialization task and prevent duplicate initialization
 * tasks from being scheduled concurrently.
 *
 * @since 1.0.0
 */
const CURSOR_INITIALIZATION_ID = 'cursor-position-initialization-id' as const;
const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Controls the Zexi terminal and provides the primary API for logging,
 * terminal events, and screen management.
 *
 * A `ZexiTerminal` instance does not directly manipulate the terminal
 * screen. All output is routed through the shared Zexi terminal controller
 * and screen engine.
 *
 * Multiple terminal instances may coexist with independent configuration,
 * such as different log levels or metadata preferences. These instances
 * share the same underlying screen engine and event system.
 *
 * ---------------------------------------------------------------------
 * 🔷 LOGGING
 * ---------------------------------------------------------------------
 *
 * The terminal provides the following logging levels:
 *
 * - `debug`
 * - `info`
 * - `warn`
 * - `error`
 * - `fatal`
 *
 * Each log operation:
 *
 * 1. Renders the supplied value into the canonical JSON representation.
 * 2. Creates an immutable log event containing the original value,
 *    serialized representation, and printable representation.
 * 3. Emits the level-specific event.
 * 4. Emits the general `log` event.
 * 5. Optionally prints the event to the terminal screen according to
 *    the terminal's configured log level.
 *
 * The printable representation may use either the JSON or debug renderer.
 * This affects terminal output only; emitted events retain their canonical
 * JSON representation.
 *
 * ---------------------------------------------------------------------
 * 🔷 EVENTS
 * ---------------------------------------------------------------------
 *
 * Events are shared by all `ZexiTerminal` instances.
 *
 * Event listeners can subscribe to:
 *
 * - individual log levels such as `log.error`
 * - the general `log` event
 * - terminal lifecycle events such as `clear`
 *
 * A log event is emitted first through its level-specific event and then
 * through the general `log` event. Both emissions reference the same
 * immutable event object.
 *
 * Event subscriptions may be registered using either {@link events.on}
 * or {@link events.once}.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCREEN MANAGEMENT
 * ---------------------------------------------------------------------
 *
 * The terminal exposes high-level screen operations rather than allowing
 * callers to manipulate screen cells directly.
 *
 * Calling {@link clear} clears the shared screen engine and emits a
 * corresponding `clear` event.
 *
 * ---------------------------------------------------------------------
 * 🔷 TERMINAL CONFIGURATION
 * ---------------------------------------------------------------------
 *
 * Each terminal instance maintains its own:
 *
 * - {@link logLevel}
 * - {@link includeMetadata}
 *
 * configuration.
 *
 * These settings affect how that particular terminal instance prints
 * events. They do not create a separate screen or event system.
 *
 * @since 1.0.0
 */
class ZexiTerminal {
    /**
     * Shared terminal controller used by every `ZexiTerminal` instance.
     *
     * The controller owns the terminal-wide resources, including the screen
     * engine and event emitter. It is intentionally shared so that creating
     * another `ZexiTerminal` does not create another terminal screen or another
     * event system.
     *
     * @internal
     * @since 1.0.0
     */
    static readonly #_ct = ZexiTerminalControllerInstance;

    /**
     * Stateless utilities shared by all terminal instances.
     *
     * These utilities are kept separate from instance helpers because they do
     * not depend on a terminal instance's configuration or state.
     *
     * @internal
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
                return DefaultRenderer.render(tokens, options ?? {});
            }
        }
    }

    /**
     * Configuration local to this terminal instance.
     *
     * These values affect how this particular instance prints events. They do
     * not create or modify a separate screen engine or event emitter.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_configs = {
        logLevel: 'debug' as ZexiLogLevel,
        includeMetadata: false
    }

    /**
     * Handles log requests produced by dynamic terminal entry updates.
     *
     * Entry updates are not logged by default. When logging is explicitly enabled,
     * the already-rendered entry value is forwarded to the terminal logging
     * pipeline using the requested log level.
     *
     * The value is passed directly to the entry logging path without being
     * serialized or rendered again.
     *
     * @param value - Already-rendered terminal entry value to log.
     * @param configs - Resolved logging configuration for the update.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_entriesLogger: TerminalEntryUpdateLogger = (value, configs) => {
        if (configs.log !== true) { return }
        this.#_helpers.logging.logEntry(configs.level, value);
    }

    /**
     * Creates a Zexi terminal interface.
     *
     * The created instance has its own logging configuration while sharing
     * the underlying screen engine and event system with other terminal
     * instances.
     *
     * @param options Optional terminal configuration.
     *
     * @throws {TypeError}
     * Thrown when `options` is provided but is not an object.
     *
     * @since 1.0.0
     */
    constructor(options?: ZexiTerminalOptions) {
        if (options !== undefined) {
            if (!atomix.valueIs.record(options)) {
                throw new TypeError(`Expected \`options\` to be an object, received \`${typeof options}\``);
            }

            if (hasOwnProp(options, 'includeMetadata')) {
                this.includeMetadata = options.includeMetadata!;
            }

            if (hasOwnProp(options, 'logLevel')) {
                this.logLevel = options.logLevel!;
            }
        }
    }

    /**
     * Instance-bound operations used to process terminal logging.
     *
     * Unlike the static utilities, these helpers operate in the context of a
     * specific terminal instance and may therefore depend on its configuration,
     * such as the configured log level and metadata settings.
     *
     * @internal
     */
    readonly #_helpers = {
        /**
         * Internal logging operations.
         *
         * @internal
         * @since 1.0.0
         */
        logging: {
            /**
             * Creates and emits a log event from an already-rendered terminal value.
             *
             * This method is intended for values that have already been converted into
             * their final terminal representation, such as values produced by dynamic
             * terminal entries. The supplied value is therefore used directly as the
             * original, serialized, and printable representation of the event.
             *
             * Unlike {@link logLevel}, this method does not serialize, render, or
             * otherwise transform the supplied value.
             *
             * The resulting event is emitted through both:
             *
             * - the level-specific `log.<level>` event
             * - the general `log` event
             *
             * @param level - Severity level of the log event.
             * @param value - Already-rendered terminal value.
             *
             * @throws TypeError if `value` is not a string.
             *
             * @internal
             * @since 1.0.0
             */
            logEntry: (level: ZexiLogLevel, value: string) => {
                if (typeof value !== 'string') {
                    throw new TypeError(`Expected \`value\` to be a string, received \`${typeof value}\``);
                }

                const draft: TerminalLogEvent = {
                    id: crypto.randomUUID(),
                    time: new Date().toISOString(),
                    name: `log.${level}`,
                    level: level,
                    value: {
                        original: value,
                        serialized: consoleStyler.strip(value),
                        printable: value
                    }
                }

                this.#_helpers.logging.logEvent(draft);
            },

            /**
             * Freezes and emits a completed terminal log event.
             *
             * The event is emitted through both:
             *
             * - the level-specific `log.<level>` event
             * - the general `log` event
             *
             * Both events receive the same immutable event object.
             *
             * This helper performs event emission only. It does not serialize, render,
             * capture stack traces, or print the event.
             *
             * @param event - Completed terminal log event to emit.
             *
             * @internal
             * @since 1.0.0
             */
            logEvent: (event: TerminalLogEvent) => {
                const e = atomix.dataTypes.object.deepFreeze(event);

                // Emit the specific log-level event
                ZexiTerminal.#_ct.events.emit<TerminalEventName>(`log.${e.level}`, e);

                // Emit the general log event
                ZexiTerminal.#_ct.events.emit('log', e);
            },

            /**
             * Processes a value and creates a log event at the specified severity level.
             *
             * This operation:
             *
             * 1. Resolves the logging and rendering options.
             * 2. Produces the canonical JSON representation.
             * 3. Produces the printable representation.
             * 4. Creates the terminal log event.
             * 5. Optionally captures the caller stack.
             * 6. Emits the completed event through {@link logEvent}.
             * 7. Optionally prints the event according to this terminal's log level.
             *
             * The configured terminal log level affects printing only. It does not
             * prevent the event from being emitted.
             *
             * Unlike {@link logEntry}, this method accepts an arbitrary value and
             * processes it through the terminal's normal serialization and rendering
             * pipeline before creating the event.
             *
             * @param level - Severity level of the log.
             * @param value - Value to log.
             * @param options - Logging and rendering options.
             *
             * @internal
             * @since 1.0.0
             */
            logLevel: (
                level: ZexiLogLevel,
                value: unknown,
                options?: TerminalLogOptions
            ): void => {
                const ansiEnabled = (() => {
                    if (level === 'debug' || level === 'info') {
                        return true;
                    }

                    if (ZexiTerminal.#_utils.isPrimitive(value)) {
                        return false;
                    }

                    return true;
                })();

                const target = options?.target ?? (level === 'debug' ? 'debug' : 'json');
                const mode = 'pretty' as const;
                const trace = options?.trace === true;
                const print = options?.print === false ? false : true;

                const baseConfigs = { mode, ansiEnabled }

                const json = ZexiTerminal.#_utils.render.json(value, baseConfigs);
                const serialized = (ansiEnabled ? consoleStyler.strip(json) : json).replace(/\s+/g, '');;

                const draft: TerminalLogEvent = {
                    id: crypto.randomUUID(),
                    time: new Date().toISOString(),
                    name: `log.${level}`,
                    level: level,
                    value: {
                        original: value,
                        serialized,
                        printable: target === 'debug' ? ZexiTerminal.#_utils.render.debug(value, { ...baseConfigs, ansiEnabled }) : json
                    }
                }

                if (trace) {
                    const stack = ZexiTerminal.#_utils.generateStack();
                    const printable = DefaultRenderer.render(
                        [new TOKENS.StackTrace(stack)],
                        { mode: 'compact', ansiEnabled: true }
                    );

                    draft.trace = { original: stack, printable };
                }

                this.#_helpers.logging.logEvent(draft);

                if (print) {
                    // Print to the console if the log level is high enough
                    this.#_helpers.printEvent(draft);
                }
            },
        },

        /**
         * Schedules a log event for rendering through the shared screen engine when
         * the event's severity meets this terminal instance's configured log level.
         *
         * The printable message is constructed synchronously, but the screen mutation
         * is deferred to the terminal task queue. This ensures that screen operations
         * are serialized with cursor-position initialization and other terminal
         * mutations.
         *
         * This operation does not emit events. Log events are emitted when the log
         * event is created, before this method is invoked.
         *
         * ---------------------------------------------------------------------
         * 🔷 LOG LEVEL FILTERING
         * ---------------------------------------------------------------------
         *
         * Events whose severity is below this terminal instance's configured
         * {@link ZexiTerminal.logLevel} are ignored and are not added to the queue.
         *
         * ---------------------------------------------------------------------
         * 🔷 MESSAGE CONSTRUCTION
         * ---------------------------------------------------------------------
         *
         * The printable message is assembled synchronously from the already-rendered
         * event value.
         *
         * The message may include:
         *
         * - timestamp and log-level metadata
         * - ANSI-colored primitive values
         * - rendered structured values
         * - a formatted stack trace
         *
         * No serialization or rendering is performed by the queued task.
         *
         * ---------------------------------------------------------------------
         * 🔷 QUEUED EXECUTION
         * ---------------------------------------------------------------------
         *
         * Before scheduling the screen operation, cursor-position initialization is
         * ensured.
         *
         * The resulting screen mutation is then added to the shared terminal queue
         * with priority `1`.
         *
         * The queued task creates the corresponding screen cell using the message
         * that was constructed synchronously.
         *
         * ---------------------------------------------------------------------
         * 🔷 SYNCHRONOUS API
         * ---------------------------------------------------------------------
         *
         * This method does not wait for the screen operation to complete.
         *
         * From the caller's perspective, the method remains synchronous. Only the
         * final mutation of the shared screen is deferred to the queue.
         *
         * @param event - Log event to print.
         *
         * @internal
         * @since 1.0.0
         */
        printEvent: (event: TerminalLogEvent): void => {
            if (ZEXI_LOG_LEVELS.indexOf(this.#_configs.logLevel) > ZEXI_LOG_LEVELS.indexOf(event.level)) {
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

            if (ZexiTerminal.#_utils.isPrimitive(event.value.original)) {
                parts.push(consoleStyler.color(event.value.printable, color));
            } else {
                parts.push(event.value.printable);
            }

            if (event.trace) {
                parts.push(`${event.trace.printable}\n`);
            }

            const message = parts.join(' ');

            this.#_helpers.ensureCursorPosition();
            ZexiTerminal.#_ct.queue.addTask({
                priority: 1,
                type: 'logging',
                action: () => {
                    if (cursorPosition.state === 'failed') {
                        console.error('Unable to print log event because terminal cursor position initialization failed.');
                        return
                    }

                    ZexiTerminal.#_ct.screenEngine.create({ value: message, final: true });
                }
            });
        },

        /**
         * Ensures that the terminal's initial cursor position is scheduled for
         * initialization before any screen operation is executed.
         *
         * Cursor-position initialization requires asynchronous communication with the
         * terminal. Since the public terminal API remains synchronous, initialization
         * is delegated to the shared task queue rather than awaited directly by the
         * caller.
         *
         * ---------------------------------------------------------------------
         * 🔷 INITIALIZATION
         * ---------------------------------------------------------------------
         *
         * If the cursor position has not yet been initialized, an initialization task
         * is added to the terminal queue.
         *
         * The initialization task waits for {@link cursorPosition} to query the
         * terminal and establish its initial cursor position.
         *
         * ---------------------------------------------------------------------
         * 🔷 DUPLICATE PREVENTION
         * ---------------------------------------------------------------------
         *
         * Multiple terminal operations may request cursor initialization before the
         * queue has had an opportunity to execute the initialization task.
         *
         * The initialization task is therefore assigned a stable identifier and
         * checked using {@link TasksQueue.hasTask} before being added.
         *
         * This guarantees that concurrent synchronous terminal operations do not
         * enqueue duplicate cursor-position initialization tasks.
         *
         * ---------------------------------------------------------------------
         * 🔷 EXECUTION ORDER
         * ---------------------------------------------------------------------
         *
         * Cursor initialization is scheduled with priority `0`, ensuring it executes
         * before queued screen operations that depend on the initialized cursor
         * position.
         *
         * ---------------------------------------------------------------------
         * 🔷 ERROR HANDLING
         * ---------------------------------------------------------------------
         *
         * If cursor-position initialization fails, the rejection handler:
         *
         * - disables automatic task-queue execution
         * - emits the initialization failure through the terminal's fatal logging
         *   pipeline
         * - reports a diagnostic message to the console
         *
         * Automatic queue execution is disabled because subsequent terminal operations
         * depend on a valid initial cursor position. Allowing queued screen operations
         * to continue executing after initialization has failed could result in an
         * invalid terminal state or incorrect screen positioning.
         *
         * The initialization error is handled asynchronously by the queue and is not
         * thrown synchronously from this method.
         *
         * ---------------------------------------------------------------------
         * 🔷 SYNCHRONOUS API
         * ---------------------------------------------------------------------
         *
         * This method does not wait for initialization to complete and does not return
         * a promise.
         *
         * It only ensures that the required initialization task exists in the queue.
         * The queue is responsible for executing the asynchronous initialization
         * before subsequent screen operations.
         *
         * If initialization fails, automatic task execution is disabled and the
         * failure is reported through the terminal's fatal logging pipeline.
         *
         * @since 1.0.0
         */
        ensureCursorPosition: () => {
            if (
                !cursorPosition.initialized &&
                !ZexiTerminal.#_ct.queue.hasTask(CURSOR_INITIALIZATION_ID)
            ) {
                ZexiTerminal.#_ct.queue.addTask({
                    id: CURSOR_INITIALIZATION_ID,
                    priority: 0,
                    type: 'initialization',
                    action: async () => {
                        await cursorPosition.initialize();
                    },
                    onReject: (err: Error) => {
                        const errMsg = [
                            '#'.repeat(80),
                            'Unable to determine terminal cursor position.',
                            'The terminal returned an unexpected response to the cursor-position query.',
                            'Please report this error to the Zexi team.',
                            '#'.repeat(80)
                        ].join('\n');

                        this.#_helpers.logging.logLevel('fatal', { message: errMsg, error: err }, { print: false });
                        console.error(errMsg);
                    }
                });
            }
        }
    }

    /**
     * Event subscription interface for the Zexi terminal.
     *
     * Event subscriptions are backed by the shared terminal event system,
     * meaning listeners registered through one `ZexiTerminal` instance can
     * receive events emitted through another instance.
     * 
     * @since 1.0.0
     */
    readonly events = {
        /**
         * Registers a persistent listener for a terminal event.
         *
         * The handler remains registered until the returned unsubscribe
         * function is called.
         *
         * @template E The terminal event name.
         *
         * @param event Name of the event to listen for.
         * @param handler Function invoked whenever the event is emitted.
         *
         * @returns A function that removes the registered handler.
         *
         * @since 1.0.0
         */
        on: <E extends TerminalEventName>(
            event: E,
            handler: TerminalEvents[E]
        ): UnsubscribeHandler => {
            ZexiTerminal.#_ct.events.on<TerminalEventName>(event, handler);
            return () => ZexiTerminal.#_ct.events.remove.handler(event, handler);
        },

        /**
         * Registers a listener that is invoked at most once.
         *
         * The listener is automatically removed after its first invocation.
         *
         * @template E The terminal event name.
         *
         * @param event Name of the event to listen for.
         * @param handler Function invoked when the event is emitted.
         *
         * @returns A function that removes the registered handler before it
         * is invoked.
         *
         * @since 1.0.0
         */
        once: <E extends TerminalEventName>(
            event: E,
            handler: TerminalEvents[E]
        ): UnsubscribeHandler => {
            ZexiTerminal.#_ct.events.on<TerminalEventName>(event, handler, { once: true });
            return () => ZexiTerminal.#_ct.events.remove.handler(event, handler);
        },

        /**
         * Retrieves the names of all events that currently have registered
         * listeners on the shared terminal event emitter.
         *
         * This does not represent all event names supported by Zexi. An event name
         * is included only while one or more handlers are registered for that
         * event.
         *
         * @since 1.0.0
         */
        get eventNames() {
            return ZexiTerminal.#_ct.events.eventNames;
        }
    }

    /**
     * Creates another terminal interface with the specified configuration.
     *
     * The returned instance has independent terminal configuration but shares
     * the same underlying screen engine and event system.
     *
     * This method is useful when different parts of an application need
     * different logging policies without creating separate terminal screens.
     *
     * @param options Optional configuration for the new terminal instance.
     *
     * @returns A new `ZexiTerminal` instance.
     *
     * @since 1.0.0
     */
    with(options?: ZexiTerminalOptions): ZexiTerminal {
        return new ZexiTerminal(options);
    }

    /**
     * Determines whether log metadata is included when printing log entries.
     *
     * When enabled, printed log entries include their timestamp and log level.
     *
     * This setting affects terminal output only and does not modify emitted
     * events.
     *
     * @defaultValue false
     *
     * @since 1.0.0
     */
    get includeMetadata(): boolean { return this.#_configs.includeMetadata; }

    /**
     * Determines whether log metadata is included when printing log entries.
     *
     * @param value Whether metadata should be included.
     *
     * @throws {TypeError}
     * Thrown when `value` is not a boolean.
     *
     * @since 1.0.0
     */
    set includeMetadata(value: boolean) {
        if (typeof value !== 'boolean') {
            throw new TypeError(`Expected \`includeMetadata\` to be a boolean, received \`${typeof value}\``);
        }

        this.#_configs.includeMetadata = value;
    }

    /**
     * Gets the minimum log level printed by this terminal instance.
     *
     * Log levels are ordered from lowest to highest severity:
     *
     * `debug < info < warn < error < fatal`
     *
     * Events are emitted regardless of this setting. The setting only
     * determines which events are printed to the terminal screen.
     *
     * @defaultValue `"debug"`
     *
     * @since 1.0.0
     */
    get logLevel(): ZexiLogLevel { return this.#_configs.logLevel; }

    /**
     * Sets the minimum log level printed by this terminal instance.
     *
     * Events below the configured level remain available to event listeners;
     * they are simply not printed by this terminal instance.
     *
     * @param value Minimum log level to print.
     *
     * @throws {Error}
     * Thrown when `value` is not a valid Zexi log level.
     *
     * @since 1.0.0
     */
    set logLevel(value: ZexiLogLevel) {
        if (!ZEXI_LOG_LEVELS.includes(value)) {
            throw new Error(`Invalid log level: ${value}`);
        }

        this.#_configs.logLevel = value;
    }

    /**
     * Clears all entries from the shared terminal screen.
     *
     * The clear operation is scheduled through the terminal task queue so that it
     * is serialized with other screen-engine operations.
     *
     * Before scheduling the clear operation, cursor-position initialization is
     * ensured. This allows the screen engine to restore and clear the terminal
     * relative to the position captured before Zexi began managing terminal
     * output.
     *
     * ---------------------------------------------------------------------
     * 🔷 QUEUED EXECUTION
     * ---------------------------------------------------------------------
     *
     * The screen is not cleared immediately when this method is called.
     *
     * Instead:
     *
     * - cursor-position initialization is ensured
     * - a clear task is added to the shared terminal queue
     * - the screen engine clears the rendered screen state
     * - a `clear` event is emitted after the screen has been cleared
     *
     * The clear task is executed with priority `3`.
     *
     * ---------------------------------------------------------------------
     * 🔷 EVENT
     * ---------------------------------------------------------------------
     *
     * Once the screen has been cleared, a `clear` event is emitted containing:
     *
     * - a unique operation identifier
     * - the timestamp at which the clear operation was executed
     * - the `clear` event name
     *
     * The emitted event is deeply frozen before being dispatched.
     *
     * ---------------------------------------------------------------------
     * 🔷 SYNCHRONOUS API
     * ---------------------------------------------------------------------
     *
     * This method does not wait for the queued operation to complete.
     *
     * Calling `clear()` therefore remains synchronous from the caller's
     * perspective, while the underlying terminal operation is serialized through
     * the internal task queue.
     *
     * @since 1.0.0
     */
    clear(): void {
        this.#_helpers.ensureCursorPosition();

        ZexiTerminal.#_ct.queue.addTask({
            priority: 3,
            type: 'clear',
            action: async () => {
                ZexiTerminal.#_ct.screenEngine.clear();
                ZexiTerminal.#_ct.events.emit('clear', atomix.dataTypes.object.deepFreeze({
                    id: crypto.randomUUID(),
                    time: new Date().toISOString(),
                    name: 'clear'
                }));
            }
        });
    }

    /**
     * Logs a message at the `fatal` level.
     *
     * Fatal messages represent the highest-severity logging level.
     *
     * @param value Value to render and log.
     * @param options Optional rendering, tracing, and printing options.
     *
     * @since 1.0.0
     */
    fatal(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('fatal', value, options);
    }

    /**
     * Logs a message at the `error` level.
     *
     * Error messages represent serious failures that occurred during
     * application execution.
     *
     * @param value Value to render and log.
     * @param options Optional rendering, tracing, and printing options.
     *
     * @since 1.0.0
     */
    error(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('error', value, options);
    }

    /**
     * Logs a message at the `warn` level.
     *
     * Warning messages indicate potentially problematic conditions that do
     * not necessarily prevent the application from continuing.
     *
     * @param value Value to render and log.
     * @param options Optional rendering, tracing, and printing options.
     *
     * @since 1.0.0
     */
    warn(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('warn', value, options);
    }

    /**
     * Logs a message at the `info` level.
     *
     * Informational messages describe normal application activity or state.
     *
     * @param value Value to render and log.
     * @param options Optional rendering, tracing, and printing options.
     *
     * @since 1.0.0
     */
    info(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('info', value, options);
    }

    /**
     * Logs a message at the `debug` level.
     *
     * Debug messages are intended for detailed diagnostic information.
     *
     * @param value Value to render and log.
     * @param options Optional rendering, tracing, and printing options.
     *
     * @since 1.0.0
     */
    debug(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('debug', value, options);
    }

    /**
     * Creates a dynamic terminal entry.
     *
     * A dynamic entry provides a persistent, independently updatable region of
     * terminal output. The returned entry can be used to modify its output after
     * it has been created.
     *
     * Unlike standard logging methods, dynamic entries are intended for output
     * whose content changes over time, such as progress indicators, status
     * displays, and other live terminal information.
     *
     * Creating or updating an entry does not emit log events unless logging is
     * explicitly enabled through the corresponding logging options.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIAL VALUE
     * ---------------------------------------------------------------------
     *
     * An entry may be initialized with either:
     *
     * - a direct string value
     * - template parameters and a template
     *
     * ```ts
     * const entry = await terminal.createEntry({
     *     value: 'Loading...'
     * });
     * ```
     *
     * Or:
     *
     * ```ts
     * const entry = await terminal.createEntry({
     *     template: 'Progress: ${value}%',
     *     params: { value: 0 }
     * });
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIAL VALUE LOGGING
     * ---------------------------------------------------------------------
     *
     * The initial rendered value can optionally be emitted as a log event when
     * the entry is created.
     *
     * ```ts
     * const entry = await terminal.createEntry(
     *     { value: 'Server started.' },
     *     { log: true, level: 'info' }
     * );
     * ```
     *
     * Logging the initial value does not change how the entry is rendered or
     * managed as dynamic terminal output.
     *
     * ---------------------------------------------------------------------
     * 🔷 LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * The returned entry remains associated with its terminal output and can be
     * updated using its public API:
     *
     * ```ts
     * entry.update('Complete');
     * ```
     *
     * Template-based entries can update their parameters independently:
     *
     * ```ts
     * entry.updateParams({ value: 50 });
     * ```
     *
     * Individual updates may optionally emit log events:
     *
     * ```ts
     * entry.update(
     *     'Download complete.',
     *     { log: true, level: 'info' }
     * );
     * ```
     *
     * An entry may be permanently finalized when its output is complete.
     *
     * ---------------------------------------------------------------------
     * 🔷 ERROR HANDLING
     * ---------------------------------------------------------------------
     *
     * The returned promise may be rejected if the entry cannot be created.
     *
     * If the terminal's cursor position could not be initialized, the promise
     * is rejected with a message describing the failure.
     *
     * Other errors encountered while creating the entry are propagated through
     * the returned promise.
     *
     * Callers should therefore handle the returned promise accordingly:
     *
     * ```ts
     * try {
     *     const entry = await terminal.createEntry({
     *         value: 'Starting...'
     *     });
     * } catch (error) {
     *     console.error('Unable to create terminal entry:', error);
     * }
     * ```
     *
     * @param entryOptions - Initial configuration for the terminal entry.
     * @param logOptions - Optional configuration for logging the initial value.
     * @returns Promise resolving to the created terminal entry, or rejecting if
     *     the entry cannot be created.
     *
     * @since 1.0.0
     */
    createEntry(
        entryOptions: TerminalCellOptions,
        logOptions?: TerminalEntryLogOptions
    ): Promise<TerminalEntry> {
        this.#_helpers.ensureCursorPosition();

        return new Promise<TerminalEntry>((resolve, reject) => {
            const task: TerminalEntryCellTask = {
                priority: 1,
                type: 'logging',
                action: () => {
                    if (cursorPosition.state === 'failed') {
                        throw new Error('Unable to create entry due to failed cursor position', {
                            cause: 'cursor-position-failed'
                        })
                    }
                    return ZexiTerminal.#_ct.screenEngine.create(entryOptions, 'external')
                },
                onResolve: (entry) => {
                    if (logOptions?.log === true) {
                        const level = logOptions.level ?? 'info';
                        this.#_entriesLogger(entry.value, { log: true, level });
                    }

                    TerminalEntry.attachLogger(entry, this.#_entriesLogger);
                    resolve(entry)
                },
                onReject: (err) => {
                    if (err.cause === 'cursor-position-failed') {
                        return reject(err.message);
                    }

                    reject(err);
                }
            }

            ZexiTerminal.#_ct.queue.addTask(task);
        });
    }
}

const zexiTerminal = new ZexiTerminal();
export default zexiTerminal;