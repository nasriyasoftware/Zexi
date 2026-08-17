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
import type { CircularReferencePolicy } from "./pipeline/1-graphing/types";
import type { OutputMode, OutputTarget, TerminalLogOptions, ZexiLogLevel, ZexiTerminalOptions } from "./types";
import type { TerminalEvent, TerminalEventName, TerminalEvents, UnsubscribeHandler } from "./events/types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

class ZexiTerminal {
    static readonly #_ct = ZexiTerminalControllerInstance;
    readonly #_configs = {
        logLevel: 'debug' as ZexiLogLevel,
        includeMetadata: false
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
        render: {
            json: (value: unknown, options?: JsonOptions) => {
                const tokens = JSONTokenizer(value);
                return JSONRenderer.render(tokens, options ?? {});
            },

            debug: (value: unknown, options?: DebugOptions) => {
                const tokens = DefaultTokenizer(value, options?.cycles ?? 'mark');
                return DefaultRenderer.render(tokens, options ?? {});
            }
        },
        generateStack: () => buildStack(new Error().stack ?? ''),
        freezeEvent: (event: TerminalEvent) => atomix.dataTypes.object.deepFreeze(event),
        logEvent: (event: TerminalEvent): void => {
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

            if (this.#_helpers.isPrimitive(event.original.value)) {
                parts.push(consoleStyler.color(event.content.value, color));
            } else {
                parts.push(event.content.value);
            }

            if (event.content.stack) {
                parts.push(`${event.content.stack}\n`);
            }

            const message = parts.join(' ');
            ZexiTerminal.#_ct.screenEngine.create({ value: message, final: true });
        },
        validateOptions: (options: unknown): Record<string, unknown> => {
            if (options === undefined) {
                return {};
            }

            if (!atomix.valueIs.record(options)) {
                throw new TypeError(`Expected \`options\` to be an object, received \`${typeof options}\``);
            }

            const configs: Partial<{
                target: OutputTarget,
                mode: OutputMode;
                cycles: CircularReferencePolicy;
                spaces: number;
                trace: boolean
            }> = {};

            if (hasOwnProp(options, 'as')) {
                const as = options.as;

                if (typeof as !== 'string') {
                    throw new TypeError(`Expected \`options.as\` to be a string, received \`${typeof as}\``);
                }

                if (['json', 'debug'].includes(as)) {
                    configs.target = as as OutputTarget;
                } else {
                    throw new TypeError(`Expected \`options.as\` to be \`json\` or \`debug\`, received \`${as}\``);
                }
            }

            if (hasOwnProp(options, 'mode')) {
                const mode = options.mode;

                if (typeof mode !== 'string') {
                    throw new TypeError(`Expected \`options.mode\` to be a string, received \`${typeof mode}\``);
                }

                if (['compact', 'pretty'].includes(mode)) {
                    configs.mode = mode as OutputMode;
                } else {
                    throw new TypeError(`Expected \`options.mode\` to be \`compact\` or \`pretty\`, received \`${mode}\``);
                }
            }

            if (hasOwnProp(options, 'trace')) {
                const trace = options.trace;

                if (typeof trace !== 'boolean') {
                    throw new TypeError(`Expected \`options.trace\` to be a boolean, received \`${typeof trace}\``);
                }

                configs.trace = trace;
            }

            if (hasOwnProp(options, 'cycles')) {
                const c = options.cycles;

                if (typeof c !== 'string') {
                    throw new TypeError(`Expected \`options.cycles\` to be a string, received \`${typeof c}\``);
                }

                if (['ignore', 'mark', 'throw'].includes(c)) {
                    configs.cycles = c as CircularReferencePolicy;
                } else {
                    throw new TypeError(`Expected \`options.cycles\` to be \`ignore\`, \`mark\`, or \`throw\`, received \`${c}\``);
                }
            }

            if (hasOwnProp(options, 'spaces')) {
                const spaces = options.spaces;

                if (typeof spaces !== 'number') {
                    throw new TypeError(`Expected \`options.spaces\` to be a number, received \`${typeof spaces}\``);
                }

                if (spaces >= 0 && spaces <= 8) {
                    configs.spaces = spaces;
                } else {
                    throw new TypeError(`Expected \`options.spaces\` to be a number between 0 and 8, received \`${spaces}\``);
                }
            }

            return configs;
        },
        isPrimitive: (value: unknown): boolean => {
            return (
                typeof value === 'string' ||
                typeof value === 'number' ||
                typeof value === 'boolean' ||
                value === null ||
                value === undefined
            );
        },
        logLevel: (
            level: ZexiLogLevel,
            value: unknown,
            options?: TerminalLogOptions
        ): void => {
            const vOpts = this.#_helpers.validateOptions(options);

            const isPrimitive = value === null || (
                typeof value !== 'object' &&
                typeof value !== 'function'
            );

            const ansiEnabled = (() => {
                if (level === 'debug' || level === 'info') {
                    return true;
                }

                if (isPrimitive) {
                    return false;
                }

                return true;
            })()

            const target = (vOpts.target ?? 'json') as OutputTarget;
            const trace = vOpts.trace ?? false;
            const mode = (
                vOpts.mode ??
                (target === 'json' ? 'compact' : 'pretty')
            ) as OutputMode;

            const content = (() => {
                const baseConfigs = { mode, ansiEnabled }

                switch (target) {
                    case 'json':
                        return this.#_helpers.render.json(value, baseConfigs);

                    case 'debug': {
                        const configs = mode === 'pretty' ? { ...baseConfigs, spaces: 4 } : mode === 'compact' ? baseConfigs : { ansiEnabled };
                        return this.#_helpers.render.debug(value, configs);
                    }
                }
            })();

            const draft: TerminalEvent = {
                id: crypto.randomUUID(),
                time: new Date().toISOString(),
                content: { value: content },
                original: { value },
                level: level,
                name: `log.${level}`
            }

            if (trace) {
                draft.original.stack = this.#_helpers.generateStack();
                const token = new TOKENS.StackTrace(draft.original.stack)
                draft.content.stack = DefaultRenderer.render([token], { mode: 'compact', ansiEnabled: true });
            }

            const event = this.#_helpers.freezeEvent(draft);

            // Emit the fatal log event
            ZexiTerminal.#_ct.events.emit(`log.${level}`, event);

            // Emit the general log event
            ZexiTerminal.#_ct.events.emit('log', event);

            // Log to the console if the log level is high enough
            this.#_helpers.logEvent(event);
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
        ZexiTerminal.#_ct.screenEngine.clear();
    }

    fatal(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logLevel('fatal', value, options);
    }

    error(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logLevel('error', value, options);
    }

    warn(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logLevel('warn', value, options);
    }

    info(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logLevel('info', value, options);
    }

    debug(value: unknown, options?: TerminalLogOptions): void {
        this.#_helpers.logLevel('debug', value, options);
    }
}

const zexiTerminal = new ZexiTerminal();
export default zexiTerminal;