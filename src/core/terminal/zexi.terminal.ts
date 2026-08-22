import atomix from "@nasriya/atomix";
import buildStack from "./pipeline/1-graphing/helpers/build.stack";
import consoleStyler from "./styling/styler";
import cursorPosition from "./screen/cursor-position";

import TerminalEntry from "./screen/terminal-cell";
import TOKENS from "./pipeline/3-tokenization/tokens";
import StdinCapture from "./input/stdin/stdin.capture";
import ZexiTerminalControllerInstance from "./controller/controller";
import JSONRenderer from "./pipeline/4-rendering/renderers/json/renderer";
import DefaultRenderer from './pipeline/4-rendering/renderers/debug/renderer';
import JSONTokenizer from "./pipeline/3-tokenization/tokenizers/json.tokenizer";
import DefaultTokenizer from "./pipeline/3-tokenization/tokenizers/default.tokenizer";

import { ZEXI_LOG_LEVELS } from "./types";
import type { JsonOptions } from "./pipeline/4-rendering/renderers/json/types";
import type { DebugOptions } from "./pipeline/4-rendering/renderers/debug/types";
import type { TerminalEventName, TerminalEvents, TerminalLogEvent, UnsubscribeHandler } from "./events/types";
import type { TerminalCellOptions, TerminalEntryCellTask, TerminalEntryLogOptions, TerminalEntryUpdateLogger } from "./screen/types";
import type { TerminalConfirmOptions, TerminalLogOptions, TerminalPromptOptions, ZexiLogLevel, ZexiTerminalOptions } from "./types";

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
             * Freezes and asynchronously emits a completed terminal log event.
             *
             * The event is emitted through both:
             *
             * - the level-specific `log.<level>` event
             * - the general `log` event
             *
             * Both events receive the same immutable event object.
             *
             * The level-specific event is fully emitted before the general `log` event
             * is emitted. The returned promise resolves only after both event emissions
             * and their asynchronous listeners have completed.
             *
             * This helper performs event emission only. It does not serialize, render,
             * capture stack traces, or print the event.
             *
             * @param event - Completed terminal log event to emit.
             *
             * @returns A promise that resolves after both log events have been emitted.
             *
             * @internal
             * @since 1.0.0
             */
            logEvent: async (event: TerminalLogEvent) => {
                const e = atomix.dataTypes.object.deepFreeze(event);

                // Emit the specific log-level event
                await ZexiTerminal.#_ct.events.emit<TerminalEventName>(`log.${e.level}`, e);

                // Emit the general log event
                await ZexiTerminal.#_ct.events.emit('log', e);
            },

            /**
             * Processes a value and asynchronously creates, emits, and optionally prints
             * a log event at the specified severity level.
             *
             * This operation:
             *
             * 1. Resolves the logging and rendering options.
             * 2. Produces the canonical JSON representation.
             * 3. Produces the printable representation.
             * 4. Creates the terminal log event.
             * 5. Optionally captures the caller stack.
             * 6. Emits the completed event through {@link logEvent} and waits for all
             *    event listeners to complete.
             * 7. Optionally prints the event according to this terminal's log level and
             *    waits for the queued screen operation to complete.
             *
             * The configured terminal log level affects printing only. It does not
             * prevent the event from being emitted.
             *
             * The returned promise resolves after all requested event emission and
             * terminal rendering operations have completed.
             *
             * Unlike {@link logEntry}, this method accepts an arbitrary value and
             * processes it through the terminal's normal serialization and rendering
             * pipeline before creating the event.
             *
             * @param level - Severity level of the log.
             * @param value - Value to log.
             * @param options - Logging and rendering options.
             *
             * @returns A promise that resolves after the log event has been emitted and,
             * optionally, printed to the terminal.
             *
             * @internal
             * @since 1.0.0
             */
            logLevel: async (
                level: ZexiLogLevel,
                value: unknown,
                options?: TerminalLogOptions
            ): Promise<void> => {
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

                await this.#_helpers.logging.logEvent(draft);

                if (print) {
                    // Print to the console if the log level is high enough
                    await this.#_helpers.printEvent(draft);
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
         * 🔷 ASYNCHRONOUS API
         * ---------------------------------------------------------------------
         *
         * The printable message is constructed synchronously, but the screen
         * mutation is executed asynchronously through the shared terminal task
         * queue.
         *
         * The returned promise resolves after the queued screen operation has
         * completed.
         *
         * The promise rejects when the queued screen operation fails.
         *
         * Callers may await the returned promise when they need to ensure that
         * the log event has been rendered to the terminal before continuing:
         *
         * ```ts
         * await this.#_helpers.printEvent(event);
         * ```
         *
         * @param event - Log event to print.
         *
         * @internal
         * @since 1.0.0
         */
        printEvent: async (event: TerminalLogEvent): Promise<void> => {
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

            return new Promise<void>((res, rej) => {
                ZexiTerminal.#_ct.queue.addTask({
                    priority: 1,
                    type: 'logging',
                    action: () => {
                        if (cursorPosition.state === 'failed') {
                            throw new Error(
                                'Unable to print log event because terminal cursor position initialization failed.'
                            );
                        }

                        ZexiTerminal.#_ct.screenEngine.create({
                            value: message,
                            final: true
                        });
                    },
                    onResolve: res,
                    onReject: rej
                });
            })
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
     * 🔷 ASYNCHRONOUS API
     * ---------------------------------------------------------------------
     *
     * The clear operation is queued and executed asynchronously.
     *
     * The returned promise resolves after:
     *
     * - the screen engine has cleared the terminal
     * - the `clear` event has been emitted
     * - all asynchronous `clear` event listeners have completed
     *
     * The promise rejects if the queued clear operation fails.
     *
     * Callers can therefore await the operation when they need to ensure that
     * the terminal has completed clearing before continuing:
     *
     * ```ts
     * await terminal.clear();
     * ```
     *
     * The method remains non-blocking when the returned promise is not awaited.
     *
     * @since 1.0.0
     */
    clear(): Promise<void> {
        this.#_helpers.ensureCursorPosition();

        return new Promise((res, rej) => {
            ZexiTerminal.#_ct.queue.addTask({
                priority: 3,
                type: 'clear',
                action: async () => {
                    ZexiTerminal.#_ct.screenEngine.clear();

                    await ZexiTerminal.#_ct.events.emit('clear', atomix.dataTypes.object.deepFreeze({
                        id: crypto.randomUUID(),
                        time: new Date().toISOString(),
                        name: 'clear'
                    }));
                },
                onResolve: res,
                onReject: rej
            });
        });
    }

    /**
     * Logs a message at the `fatal` level.
     *
     * Fatal messages represent the highest-severity logging level.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, and printing options.
     *
     * @returns A promise that resolves when the log operation has completed.
     *
     * @since 1.0.0
     */
    fatal(value: unknown, options?: TerminalLogOptions): Promise<void> {
        return this.#_helpers.logging.logLevel('fatal', value, options);
    }

    /**
     * Logs a message at the `error` level.
     *
     * Error messages represent serious failures that occurred during
     * application execution.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, and printing options.
     *
     * @returns A promise that resolves when the log operation has completed.
     *
     * @since 1.0.0
     */
    error(value: unknown, options?: TerminalLogOptions): Promise<void> {
        return this.#_helpers.logging.logLevel('error', value, options);
    }

    /**
     * Logs a message at the `warn` level.
     *
     * Warning messages indicate potentially problematic conditions that do
     * not necessarily prevent the application from continuing.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, and printing options.
     *
     * @returns A promise that resolves when the log operation has completed.
     *
     * @since 1.0.0
     */
    warn(value: unknown, options?: TerminalLogOptions): Promise<void> {
        return this.#_helpers.logging.logLevel('warn', value, options);
    }

    /**
     * Logs a message at the `info` level.
     *
     * Informational messages describe normal application activity or state.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, and printing options.
     *
     * @returns A promise that resolves when the log operation has completed.
     *
     * @since 1.0.0
     */
    info(value: unknown, options?: TerminalLogOptions): Promise<void> {
        return this.#_helpers.logging.logLevel('info', value, options);
    }

    /**
     * Logs a message at the `debug` level.
     *
     * Debug messages are intended for detailed diagnostic information.
     *
     * @param value - Value to render and log.
     * @param options - Optional rendering, tracing, and printing options.
     *
     * @returns A promise that resolves when the log operation has completed.
     *
     * @since 1.0.0
     */
    debug(value: unknown, options?: TerminalLogOptions): Promise<void> {
        return this.#_helpers.logging.logLevel('debug', value, options);
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

    /**
     * Prompts the user for interactive terminal input and resolves with the
     * captured value.
     *
     * The prompt creates or reuses a {@link TerminalEntry} to display the
     * interaction and internally uses the STDIN capture system to collect the
     * user's input.
     *
     * ---------------------------------------------------------------------
     * 🔷 TERMINAL ENTRY
     * ---------------------------------------------------------------------
     *
     * When no `entry` is provided, `prompt()` creates a new terminal entry using
     * the following template:
     *
     * ```text
     * {message}{input}
     * ```
     *
     * The `${input}` parameter is updated as the user types. Once the prompt
     * completes, the entry created by this method is automatically finalized.
     *
     * When an existing {@link TerminalEntry} is supplied through `entry`, that
     * entry is reused instead. The supplied entry is **not** finalized by
     * `prompt()`, allowing the caller to update or finalize it after the prompt
     * completes.
     *
     * A reused entry **must define an `input` parameter**. The capture system uses
     * this parameter to display the value currently being entered.
     *
     * ---------------------------------------------------------------------
     * 🔷 RETURN VALUE
     * ---------------------------------------------------------------------
     *
     * The returned promise resolves to the exact string entered by the user, or
     * `null` when the prompt is cancelled or times out.
     *
     * An empty string is a valid result and is distinct from cancellation:
     *
     * - A string, including `''`, means the user submitted the input.
     * - `null` means the prompt was cancelled or timed out.
     *
     * ```ts
     * const value = await terminal.prompt({
     *     message: 'Enter something: '
     * });
     *
     * if (value === null) {
     *     terminal.info('Prompt cancelled.');
     * } else if (value === '') {
     *     terminal.info('The user submitted an empty value.');
     * } else {
     *     terminal.info(`You entered: ${value}`);
     * }
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 INPUT PRIVACY
     * ---------------------------------------------------------------------
     *
     * The `privacy` option controls how the captured value is displayed while
     * the user is typing. It does not alter the value returned by the prompt.
     *
     * The supported privacy modes are:
     *
     * - `visible` — display the entered value normally.
     * - `password` — display one `*` character for each entered character.
     * - `hidden` — do not display the entered value.
     *
     * The default privacy mode is `visible`.
     *
     * ```ts
     * const password = await terminal.prompt({
     *     message: 'Password: ',
     *     privacy: 'password'
     * });
     * ```
     *
     * With `password` privacy, the terminal displays `*` characters while the
     * actual password remains available through the returned value.
     *
     * ---------------------------------------------------------------------
     * 🔷 ESCAPE BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * The `escapeBehavior` option determines what happens when the user presses
     * the Escape key.
     *
     * The supported behaviors are:
     *
     * - `cancel` — cancel the prompt and resolve with `null`.
     * - `reset` — clear the current input and continue prompting.
     * - `ignore` — ignore the Escape key.
     *
     * The default behavior is `cancel`.
     *
     * ```ts
     * const value = await terminal.prompt({
     *     message: 'Enter a value: ',
     *     escapeBehavior: 'reset'
     * });
     * ```
     *
     * Pressing `Ctrl+C` is independent of `escapeBehavior`. `Ctrl+C` always
     * cancels the prompt because it represents termination of the current
     * terminal operation.
     *
     * ---------------------------------------------------------------------
     * 🔷 INPUT VALIDATION
     * ---------------------------------------------------------------------
     *
     * Custom validation can be performed through `onCustomValidation`.
     *
     * The callback is invoked when the user presses Enter and receives the
     * complete input value along with a `reject` callback. Calling `reject()`
     * marks the value as invalid and displays the supplied message to the user.
     *
     * ```ts
     * const port = await terminal.prompt({
     *     message: 'Enter a port number: ',
     *     onCustomValidation: (value, reject) => {
     *         if (value.length === 0) {
     *             return reject('Port number cannot be empty.');
     *         }
     *
     *         const number = Number(value);
     *
     *         if (!Number.isInteger(number) || number < 0 || number > 65535) {
     *             return reject(
     *                 'Please enter a valid port number between 0 and 65535.'
     *             );
     *         }
     *     }
     * });
     * ```
     *
     * When validation fails, the input is cleared and the validation message is
     * displayed before the user is allowed to enter another value.
     *
     * The validation callback may be asynchronous. This is useful when validation
     * requires an external operation such as checking whether a username exists,
     * querying a service, or performing another asynchronous operation.
     *
     * ```ts
     * const username = await terminal.prompt({
     *     message: 'Username: ',
     *     onCustomValidation: async (value, reject) => {
     *         if (value.length < 3) {
     *             return reject(
     *                 'Username must contain at least 3 characters.'
     *             );
     *         }
     *
     *         const available = await checkUsernameAvailability(value);
     *
     *         if (!available) {
     *             reject('That username is already taken.');
     *         }
     *     }
     * });
     * ```
     *
     * While asynchronous validation is running, further input is temporarily
     * disabled and the prompt displays `Please wait...`.
     *
     * ---------------------------------------------------------------------
     * 🔷 TIMEOUT
     * ---------------------------------------------------------------------
     *
     * The `timeoutAfter` option can be used to automatically cancel the prompt
     * after a period of user inactivity.
     *
     * ```ts
     * const value = await terminal.prompt({
     *     message: 'Enter your name: ',
     *     timeoutAfter: 30_000
     * });
     *
     * if (value === null) {
     *     terminal.info('The prompt timed out.');
     * }
     * ```
     *
     * The timeout is reset whenever the user modifies the input. Therefore,
     * `timeoutAfter` represents the maximum period of inactivity rather than a
     * fixed maximum duration for the entire prompt.
     *
     * The timeout must be at least `1000` milliseconds.
     *
     * If `timeoutAfter` is not specified, the prompt has **no timeout** and waits
     * indefinitely until the user submits or cancels it.
     *
     * ---------------------------------------------------------------------
     * 🔷 REUSING AN EXISTING ENTRY
     * ---------------------------------------------------------------------
     *
     * An existing terminal entry can be supplied when the caller needs complete
     * control over the entry after the prompt completes.
     *
     * The entry must define an `input` parameter because `prompt()` updates that
     * parameter as the user types.
     *
     * ```ts
     * const entry = await terminal.createEntry({
     *     template: 'Enter a port number: ${input}',
     *     params: {
     *         input: ''
     *     }
     * });
     *
     * const value = await terminal.prompt({
     *     entry,
     *     escapeBehavior: 'cancel'
     * });
     *
     * if (value === null) {
     *     entry.update('[Skipped] Port number');
     * } else {
     *     entry.update(
     *         `Your application will listen on port ${value}.`
     *     );
     * }
     * ```
     *
     * When an existing entry is supplied, `prompt()` does not finalize it. The
     * caller remains responsible for updating and/or finalizing the entry.
     *
     * ---------------------------------------------------------------------
     * 🔷 MULTI-STEP PROMPTS
     * ---------------------------------------------------------------------
     *
     * Multiple prompts can be composed naturally by checking for `null` after
     * each prompt.
     *
     * ```ts
     * const email = await terminal.prompt({
     *     message: 'Email address: ',
     *     onCustomValidation: (value, reject) => {
     *         if (value.length === 0) {
     *             return reject('Email address cannot be empty.');
     *         }
     *
     *         if (!/^[^@]+@[^@]+\.[^@]+$/.test(value)) {
     *             return reject('Please enter a valid email address.');
     *         }
     *     }
     * });
     *
     * if (email === null) {
     *     return;
     * }
     *
     * const password = await terminal.prompt({
     *     message: 'Password: ',
     *     privacy: 'password',
     *     onCustomValidation: (value, reject) => {
     *         if (value.length < 8) {
     *             return reject(
     *                 'Password must contain at least 8 characters.'
     *             );
     *         }
     *     }
     * });
     *
     * if (password === null) {
     *     return;
     * }
     *
     * // Both values were successfully collected.
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 PARAMETERS
     * ---------------------------------------------------------------------
     *
     * @param prompt
     * Optional configuration controlling how the prompt is displayed and how
     * input is captured.
     *
     * @param prompt.entry
     * An existing {@link TerminalEntry} to use for displaying the prompt.
     *
     * The entry must contain an `input` parameter. That parameter is updated as
     * the user types.
     *
     * The supplied entry is not finalized automatically.
     *
     * If omitted, a new entry is created automatically using `message` and an
     * `${input}` parameter.
     *
     * @param prompt.message
     * The message displayed before the captured input.
     *
     * This option is ignored when `entry` is supplied because the existing entry
     * controls its own presentation.
     *
     * @param prompt.privacy
     * Controls how the user's input is displayed while it is being captured.
     *
     * Defaults to `visible`.
     *
     * @param prompt.escapeBehavior
     * Determines how the Escape key is handled.
     *
     * Defaults to `cancel`.
     *
     * @param prompt.timeoutAfter
     * The maximum period of inactivity, in milliseconds, before the prompt is
     * automatically cancelled.
     *
     * The value must be at least `1000` milliseconds.
     *
     * When specified, the timeout is reset whenever the user modifies the input.
     * If omitted, the prompt has no timeout and waits indefinitely.
     *
     * When the timeout expires, the prompt resolves with `null`.
     *
     * @param prompt.onCustomValidation
     * Optional synchronous or asynchronous callback used to validate the complete
     * input when the user presses Enter.
     *
     * The callback receives the current input value and a `reject` callback.
     * Calling `reject()` marks the input as invalid and displays the supplied
     * message to the user.
     *
     * If the callback returns a promise, the prompt waits for the asynchronous
     * validation to complete before deciding whether the input is valid.
     *
     * ---------------------------------------------------------------------
     * 🔷 ERRORS
     * ---------------------------------------------------------------------
     *
     * @throws {TypeError}
     * Thrown when an invalid prompt configuration is supplied.
     *
     * @returns
     * A promise that resolves to the captured input string, or `null` when the
     * prompt is cancelled or times out.
     *
     * @example
     * const value = await terminal.prompt({
     *     message: 'Enter a value: '
     * });
     *
     * if (value !== null) {
     *     terminal.info(`You entered: ${value}`);
     * }
     */
    async prompt(
        prompt?: TerminalPromptOptions
    ): Promise<string | null> {
        const extEntry = prompt?.entry instanceof TerminalEntry;

        const entry = extEntry
            ? prompt.entry!
            : await this.createEntry({
                template: `${prompt?.message ?? ''}` + '${input}',
                params: { input: '' }
            });

        const value = await new StdinCapture(entry, {
            privacy: prompt?.privacy,
            escapeBehavior: prompt?.escapeBehavior,
            timeoutAfter: prompt?.timeoutAfter,
            onCustomValidation: prompt?.onCustomValidation
        }).capture();

        if (!extEntry) {
            entry.finalize();
        }

        return value;
    }

    /**
     * Prompts the user to confirm or reject an action through standard input.
     *
     * The confirmation uses a conventional `[Y/n]` or `[y/N]` prompt depending
     * on the configured default action. The capitalized choice represents the
     * default action and is intentionally case-sensitive to require a deliberate
     * key press.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When `default` is `true`, the prompt uses `[Y/n]`:
     *
     * - Pressing `Enter` accepts the confirmation.
     * - Typing `Y` explicitly accepts the confirmation.
     * - Typing `y` asks the user to explicitly type `Y`.
     * - Typing `Yes` in any letter case accepts the confirmation.
     * - Typing `n` rejects the confirmation.
     * - Typing `N` explicitly rejects the confirmation.
     * - Typing `No` in any letter case rejects the confirmation.
     * - Any other value is rejected and the user is asked to enter `Y` or `N`.
     *
     * When `default` is `false` or omitted, the prompt uses `[y/N]`:
     *
     * - Pressing `Enter` rejects the confirmation.
     * - Typing `N` explicitly rejects the confirmation.
     * - Typing `n` asks the user to explicitly type `N`.
     * - Typing `No` in any letter case rejects the confirmation.
     * - Typing `y` accepts the confirmation.
     * - Typing `Y` explicitly accepts the confirmation.
     * - Typing `Yes` in any letter case accepts the confirmation.
     * - Any other value is rejected and the user is asked to enter `Y` or `N`.
     *
     * The capitalized single-letter choice is intentional. Because it normally
     * requires the user to hold `Shift`, it provides an explicit and deliberate
     * confirmation of the default action rather than an accidental key press.
     *
     * ---------------------------------------------------------------------
     * 🔷 CANCELLATION
     * ---------------------------------------------------------------------
     *
     * The user can cancel the confirmation at any time by pressing `Ctrl+C`.
     *
     * Cancellation is distinct from rejection:
     *
     * - `true` means the user explicitly accepted the action.
     * - `false` means the user explicitly rejected the action or selected the
     *   non-default action.
     * - `null` means the confirmation was cancelled or timed out.
     *
     * ---------------------------------------------------------------------
     * 🔷 TIMEOUT
     * ---------------------------------------------------------------------
     *
     * When `options.timeoutAfter` is specified, the confirmation is automatically
     * cancelled if the user does not provide a valid response within the
     * specified duration.
     *
     * When no timeout is specified, the confirmation remains active indefinitely
     * until the user accepts, rejects, or cancels it.
     *
     * ---------------------------------------------------------------------
     * 🔷 TERMINAL ENTRY
     * ---------------------------------------------------------------------
     *
     * When `options.entry` is provided with a {@link TerminalEntry}, the existing
     * entry is used to display and update the confirmation. The caller remains
     * responsible for managing the lifecycle of that entry.
     *
     * When no entry is provided, a new terminal entry is created automatically.
     * The automatically created entry is finalized after the confirmation
     * completes.
     *
     * If an existing entry is supplied, it must provide an `input` parameter.
     * The `input` parameter is used by the confirmation to display the user's
     * current input and final answer.
     *
     * ---------------------------------------------------------------------
     * 🔷 RETURN VALUE
     * ---------------------------------------------------------------------
     *
     * @returns
     * A promise resolving to:
     *
     * - `true` when the user accepts the confirmation.
     * - `false` when the user rejects the confirmation.
     * - `null` when the user cancels the confirmation with `Ctrl+C` or when the
     *   confirmation times out.
     *
     * ---------------------------------------------------------------------
     * 🔷 PARAMETERS
     * ---------------------------------------------------------------------
     *
     * @param message
     * The message describing the action that requires confirmation.
     *
     * The message must be a non-empty string. Whitespace surrounding the message
     * is ignored when determining whether it contains any content.
     *
     * @param options
     * Optional confirmation configuration.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLES
     * ---------------------------------------------------------------------
     *
     * @example
     * // Ask the user to confirm an operation.
     * const confirmed = await terminal.confirm(
     *     'Continue with the operation?'
     * );
     *
     * if (confirmed === null) {
     *     return;
     * }
     *
     * if (confirmed) {
     *     await performOperation();
     * }
     *
     * @example
     * // Make acceptance the default action.
     * //
     * // Displays:
     * // Continue with the installation? [Y/n]:
     * //
     * // Pressing Enter accepts the operation.
     * const confirmed = await terminal.confirm(
     *     'Continue with the installation?',
     *     { default: true }
     * );
     *
     * if (confirmed === null) {
     *     return;
     * }
     *
     * if (confirmed) {
     *     await install();
     * }
     *
     * @example
     * // Make rejection the default action.
     * //
     * // Displays:
     * // Delete all generated files? [y/N]:
     * //
     * // Pressing Enter rejects the operation.
     * const confirmed = await terminal.confirm(
     *     'Delete all generated files?',
     *     { default: false }
     * );
     *
     * if (confirmed === true) {
     *     await deleteGeneratedFiles();
     * }
     *
     * @example
     * // Automatically cancel the confirmation after 30 seconds.
     * const confirmed = await terminal.confirm(
     *     'Continue with the operation?',
     *     {
     *         default: true,
     *         timeoutAfter: 30_000
     *     }
     * );
     *
     * if (confirmed === null) {
     *     return;
     * }
     *
     * @example
     * // Reuse an existing terminal entry.
     * //
     * // The entry must provide an `input` parameter because `confirm()` updates
     * // it while capturing the user's response.
     * const entry = await terminal.createEntry({
     *     template: 'Enable automatic updates? [Y/n]: ${input}',
     *     params: {
     *         input: ''
     *     }
     * });
     *
     * const confirmed = await terminal.confirm(
     *     'Enable automatic updates?',
     *     {
     *         default: true,
     *         entry
     *     }
     * );
     *
     * if (confirmed === null) {
     *     entry.update('[Skipped] Automatic updates');
     * } else if (confirmed) {
     *     entry.update('Automatic updates enabled.');
     * } else {
     *     entry.update('Automatic updates disabled.');
     *
     * ---------------------------------------------------------------------
     * 🔷 ERRORS
     * ---------------------------------------------------------------------
     *
     * @throws {TypeError}
     * Thrown when `message` is not a string.
     *
     * @throws {SyntaxError}
     * Thrown when `message` is an empty or whitespace-only string.
     * 
     * @since 1.0.0
     */
    async confirm(
        message: string,
        options?: TerminalConfirmOptions
    ): Promise<boolean | null> {
        if (typeof message !== 'string') {
            throw new TypeError(`Expected \`message\` to be a string, received \`${typeof message}\``);
        }

        if (message.trim().length === 0) {
            throw new SyntaxError(`Expected \`message\` to be a non-empty string`);
        }

        const defaultYes = options?.default === true;
        const choiceLabels = Object.freeze({
            yes: {
                value: defaultYes ? 'Y' : 'y',
                get styled() {
                    return consoleStyler.color(this.value, 'bright-green');
                }
            },
            no: {
                value: defaultYes ? 'n' : 'N',
                get styled() {
                    return consoleStyler.color(this.value, 'bright-red');
                }
            }
        });

        const extEntry = options?.entry instanceof TerminalEntry;
        const entry = extEntry
            ? options.entry!
            : await this.createEntry({
                template: `${message} [${choiceLabels.yes.styled}/${choiceLabels.no.styled}]: ` + '${input}',
                params: { input: '' }
            });

        const answer = await new StdinCapture(entry, {
            escapeBehavior: 'ignore',
            timeoutAfter: options?.timeoutAfter,
            onCustomValidation: (value, reject) => {
                const input = value.trim();
                if (input.length === 0) {
                    return;
                }

                if (input.toLowerCase() === 'yes' || input.toLowerCase() === 'no') {
                    return;
                }

                if (defaultYes) {
                    if (input === 'Y') {
                        return;
                    }

                    if (input === 'y') {
                        return reject(
                            `Please confirm your acceptance by typing '${choiceLabels.yes.styled}'.`
                        );
                    }

                    if (input === 'n') {
                        return;
                    }
                } else {
                    if (input === 'N') {
                        return;
                    }

                    if (input === 'n') {
                        return reject(
                            `Please confirm your rejection by typing '${choiceLabels.no.styled}'.`
                        );
                    }

                    if (input === 'y') {
                        return;
                    }
                }

                reject(`Please enter '${choiceLabels.yes.value}' to accept or '${choiceLabels.no.value}' to reject.`);
            }
        }).capture();

        try {
            if (answer === null) {
                entry.updateParams({ input: '' });
                return null;
            }

            const normalized = answer.toLowerCase().trim();
            const accepted = normalized === 'y' || normalized === 'yes';

            entry.updateParams({
                input: accepted
                    ? consoleStyler.color('Yes', 'bright-green')
                    : consoleStyler.color('No', 'bright-red')
            });

            return accepted;
        } finally {
            if (!extEntry) {
                entry.finalize();
            }
        }
    }
}

const zexiTerminal = new ZexiTerminal();
export default zexiTerminal;