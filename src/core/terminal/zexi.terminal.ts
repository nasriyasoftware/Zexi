import atomix from "@nasriya/atomix";
import buildStack from "./pipeline/1-graphing/helpers/build.stack";
import consoleStyler from "./styling/styler";

import TOKENS from "./pipeline/3-tokenization/tokens";
import ZexiTerminalControllerInstance from "./controller/controller";
import JSONRenderer from "./pipeline/4-rendering/renderers/json/renderer";
import JSONTokenizer from "./pipeline/3-tokenization/tokenizers/json.tokenizer";
import DefaultTokenizer from "./pipeline/3-tokenization/tokenizers/default.tokenizer";
import DefaultRenderer from './pipeline/4-rendering/renderers/debug/renderer';

import { ZEXI_LOG_LEVELS } from "./types";
import type { JsonOptions } from "./pipeline/4-rendering/renderers/json/types";
import type { DebugOptions } from "./pipeline/4-rendering/renderers/debug/types";
import type { TerminalLogOptions, ZexiLogLevel, ZexiTerminalOptions } from "./types";
import type { TerminalEventName, TerminalEvents, TerminalLogEvent, UnsubscribeHandler } from "./events/types";

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
             * Processes and emits a log message at the specified severity level.
             *
             * This operation:
             *
             * 1. Resolves the logging and rendering options.
             * 2. Produces the canonical JSON representation.
             * 3. Produces the printable representation.
             * 4. Creates the terminal log event.
             * 5. Optionally captures the caller stack.
             * 6. Emits the level-specific event.
             * 7. Emits the general `log` event.
             * 8. Optionally prints the event according to this terminal's log level.
             *
             * The configured terminal log level affects printing only. It does not
             * prevent the event from being emitted.
             *
             * @param level Severity level of the log.
             * @param value Value to log.
             * @param options Logging options.
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
                })()

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

                const event = atomix.dataTypes.object.deepFreeze(draft);

                // Emit the specific log-level event
                ZexiTerminal.#_ct.events.emit<TerminalEventName>(`log.${level}`, event);

                // Emit the general log event
                ZexiTerminal.#_ct.events.emit('log', event);

                if (print) {
                    // Print to the console if the log level is high enough
                    this.#_helpers.logging.printEvent(event);
                }
            },

            /**
             * Prints a log event to the shared screen engine when the event's severity
             * meets this terminal instance's configured log level.
             *
             * This operation does not emit events. Event emission is performed when
             * the log event is created.
             *
             * @param event Log event to print.
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
                ZexiTerminal.#_ct.screenEngine.create({ value: message, final: true });
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
     * Clearing the screen also emits a `clear` event containing the identifier
     * and timestamp of the operation.
     *
     * @since 1.0.0
     */
    clear(): void {
        ZexiTerminal.#_ct.screenEngine.clear();
        ZexiTerminal.#_ct.events.emit('clear', atomix.dataTypes.object.deepFreeze({
            id: crypto.randomUUID(),
            time: new Date().toISOString(),
            name: 'clear'
        }));
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
}

const zexiTerminal = new ZexiTerminal();
export default zexiTerminal;