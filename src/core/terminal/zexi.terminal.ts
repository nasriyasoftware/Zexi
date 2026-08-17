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

class ZexiTerminal {
    static readonly #_ct = ZexiTerminalControllerInstance;
    readonly #_configs = {
        logLevel: 'debug' as ZexiLogLevel,
        includeMetadata: false
    }

    static #_utils = {
        generateStack: () => buildStack(new Error().stack ?? ''),
        isPrimitive: (value: unknown): boolean => {
            return (
                value === null ||
                value === undefined ||
                typeof value !== 'object' &&
                typeof value !== 'function'
            );
        },
        render: {
            json: (value: unknown, options?: JsonOptions) => {
                const tokens = JSONTokenizer(value);
                return JSONRenderer.render(tokens, options ?? {});
            },

            debug: (value: unknown, options?: DebugOptions) => {
                const tokens = DefaultTokenizer(value, options?.cycles ?? 'mark');
                return DefaultRenderer.render(tokens, options ?? {});
            }
        }
    }

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

    readonly #_helpers = {
        logging: {
            freezeEvent: (event: TerminalLogEvent) => atomix.dataTypes.object.deepFreeze(event),
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

                const event = this.#_helpers.logging.freezeEvent(draft);

                // Emit the specific log-level event
                ZexiTerminal.#_ct.events.emit<TerminalEventName>(`log.${level}`, event);

                // Emit the general log event
                ZexiTerminal.#_ct.events.emit('log', event);

                if (print) {
                    // Print to the console if the log level is high enough
                    this.#_helpers.logging.printEvent(event);
                }
            },
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

    readonly events = {
        on: <E extends TerminalEventName>(
            event: E,
            handler: TerminalEvents[E]
        ): UnsubscribeHandler => {
            ZexiTerminal.#_ct.events.on<TerminalEventName>(event, handler);
            return () => ZexiTerminal.#_ct.events.remove.handler(event, handler);
        },

        once: <E extends TerminalEventName>(
            event: E,
            handler: TerminalEvents[E]
        ): UnsubscribeHandler => {
            ZexiTerminal.#_ct.events.on<TerminalEventName>(event, handler, { once: true });
            return () => ZexiTerminal.#_ct.events.remove.handler(event, handler);
        },

        get eventNames() {
            return ZexiTerminal.#_ct.events.eventNames;
        }
    }

    with(options?: ZexiTerminalOptions): ZexiTerminal {
        return new ZexiTerminal(options);
    }

    get includeMetadata(): boolean { return this.#_configs.includeMetadata; }
    set includeMetadata(value: boolean) {
        if (typeof value !== 'boolean') {
            throw new TypeError(`Expected \`includeMetadata\` to be a boolean, received \`${typeof value}\``);
        }

        this.#_configs.includeMetadata = value;
    }

    get logLevel(): ZexiLogLevel { return this.#_configs.logLevel; }
    set logLevel(value: ZexiLogLevel) {
        if (!ZEXI_LOG_LEVELS.includes(value)) {
            throw new Error(`Invalid log level: ${value}`);
        }

        this.#_configs.logLevel = value;
    }

    clear(): void {
        ZexiTerminal.#_ct.screenEngine.clear
        ZexiTerminal.#_ct.screenEngine.clear();
        ZexiTerminal.#_ct.events.emit('clear', atomix.dataTypes.object.deepFreeze({
            id: crypto.randomUUID(),
            time: new Date().toISOString(),
            name: 'clear'
        }));
    }

    fatal(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('fatal', value, options);
    }

    error(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('error', value, options);
    }

    warn(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('warn', value, options);
    }

    info(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('info', value, options);
    }

    debug(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logging.logLevel('debug', value, options);
    }
}

const zexiTerminal = new ZexiTerminal();
export default zexiTerminal;