import AppRunnerContext from "./context/runner.ctx";
import CommandContext from "./context/cmd.context";
import OptionData from "../option/option.data";
import CLIOption from "../option/option";
import { normalizeName } from "../../utils/utils";
import { parseTokens, constructOptions } from "./helpers";
import { ZexiCommandSymbol, ZexiOptionPreservedNamesOverrideSymbol } from "../keys";
import type CLICommand from "../command/core/cli.command";
import type { CommandContextData, CommandContextOptions, CommandMode } from "../command/types";
import type { CommandName, OptionAbbrev, OptionName } from "../../types/types";

const helpOption = new CLIOption({
    name: 'help',
    abbrev: 'h',
    dataType: 'boolean',
    defaultValue: false
}, ZexiOptionPreservedNamesOverrideSymbol);

/**
 * Resolves and executes CLI commands from process arguments.
 *
 * The runner parses argv into words/options, builds a contextual command scope,
 * executes app middlewares, runs matched `seen` handlers in order, then executes
 * the final command `action` handler.
 * 
 * @since 1.0.0
 */
export class AppRunner {
    readonly #_context: AppRunnerContext;
    #_running = false

    /**
     * Creates a new runner using the root application context and current argv tokens.
     *
     * @param data Root application context that contains commands and middlewares.
     * 
     * @since 1.0.0
     */
    constructor(appCMD: CLICommand<'static'>) {
        const rawCMD = process.argv.slice(2);
        const tokens = parseTokens(rawCMD);

        // construct the context:
        this.#_context = new AppRunnerContext({
            raw: rawCMD, appCMD,
            cmd: {
                options: constructOptions(tokens.options),
                words: tokens.words,
                argsAfterBreak: tokens.argsAfterBreak
            }
        })
    }

    readonly #_helpers = {
        /**
         * Builds a command execution context for the provided command target.
         *
         * For dynamic commands, unresolved path words are moved to loose args.
         *
         * @param target Command that will receive the generated context.
         * @returns A normalized immutable command context instance.
         * @since 1.0.0
         */
        getContext: (target: CLICommand<CommandMode>): CommandContext => {
            const context = this.#_context;

            const ctxData: CommandContextData = {
                raw: context.raw,
                path: [...context.words],
                options: this.#_helpers.constructOptions(target),
                args: {
                    positional: [...context.argsAfterBreak],
                    loose: [],
                    all: [...context.argsAfterBreak]
                }
            }

            if (target.mode === 'dynamic') {
                ctxData.path = context.words.slice(0, context.pointer.index);

                const loose = [...context.pointer.remaining()];
                ctxData.args = {
                    positional: [...context.argsAfterBreak],
                    loose,
                    all: [...loose, ...context.argsAfterBreak]
                }
            }

            return new CommandContext(ctxData);
        },
        /**
         * Resolves the deepest matching command for input words and collects
         * all `seen` handlers encountered from root to final match.
         *
         * @returns The resolved target command, its execution context, and queued seen handlers.
         * @since 1.0.0
         */
        getExecContext: (): {
            target: CLICommand<CommandMode>;
            context: CommandContext;
            seenHandlers: (() => Promise<void>)[]
        } => {
            const context = this.#_context;
            const pointer = context.pointer;

            const response: {
                target: CLICommand<CommandMode>;
                context: CommandContext;
                seenHandlers: (() => Promise<void>)[];
            } = {
                target: context.currentApp,
                context: this.#_helpers.getContext(context.currentApp),
                seenHandlers: []
            };

            // Store the root's "seen" handler
            const rootTarget = response.target;
            const rootContext = response.context;
            response.seenHandlers.push(() => rootTarget.handleSeen(rootContext, ZexiCommandSymbol));

            while (pointer.hasNext()) {
                const word = pointer.peek();

                const name = normalizeName<CommandName>(word);
                const match = response.target.commands?.find([name]);

                if (!match) { break; }

                pointer.next();
                response.target = match;
                response.context = this.#_helpers.getContext(match);

                // Store the "seen" handler of the matched command
                const seenTarget = response.target;
                const seenContext = response.context;
                response.seenHandlers.push(() => seenTarget.handleSeen(seenContext, ZexiCommandSymbol));

                if (response.target.mode === 'dynamic') { break; }
            }

            return response;
        },
        /**
         * Maps raw input options to command-defined options with type coercion,
         * required/default validation, and warnings for unknown inputs.
         *
         * @param target Command that defines the allowed option schema.
         * @returns Typed option data keyed by option name.
         * @throws When required options are missing or input values fail type parsing.
         * @since 1.0.0
         */
        constructOptions: (target: CLICommand<CommandMode>): CommandContextOptions => {
            const context = this.#_context;
            const options = new Map<OptionName, OptionData>();

            for (const optionDef of [...target.options.list(), helpOption]) {
                const value = (() => {
                    const provided = optionDef.name in context.options || (optionDef.abbrev && optionDef.abbrev in context.options);

                    if (provided) {
                        const inputValue = context.options[optionDef.name] ?? context.options[optionDef.abbrev!];

                        switch (optionDef.dataType) {
                            case 'string': {
                                return inputValue;
                            }

                            case 'boolean': {
                                if (typeof inputValue === 'boolean') { return inputValue; }

                                if (inputValue === undefined) {
                                    return true;
                                } else if (inputValue === 'true' || inputValue === 'false') {
                                    return inputValue === 'true';
                                } else {
                                    throw new Error(`Invalid boolean value "${inputValue}" for option "${optionDef.name}" in command "${target.name}"`);
                                }
                            }

                            case 'number': {
                                if (typeof inputValue === 'number') { return inputValue; }

                                const parsed = Number(inputValue);
                                if (Number.isNaN(parsed)) {
                                    throw new Error(`Invalid number value "${inputValue}" for option "${optionDef.name}" in command "${target.name}"`);
                                }

                                return parsed;
                            }

                            case 'date': {
                                const value = new Date(inputValue as string);
                                if (isNaN(value.getTime())) {
                                    throw new Error(`Invalid date value "${inputValue}" for option "${optionDef.name}" in command "${target.name}"`)
                                }

                                return value;
                            }
                        }
                    } else {
                        if (optionDef.required) {
                            throw new Error(`Option "${optionDef.name}" is required in command "${target.name}"`);
                        }

                        return optionDef.defaultValue;
                    }
                })();

                const optionData = new OptionData(optionDef, value);
                options.set(optionDef.name, optionData);
            }

            return options;;
        },
        /**
         * Executes queued `seen` handlers sequentially and ignores their errors,
         * so visibility hooks never block command execution.
         *
         * @param promises Deferred seen handler invocations.
         * @returns A promise that resolves after all handlers are attempted.
         * @since 1.0.0
         */
        runSeenHandlers: async (promises: (() => Promise<void>)[]) => {
            for (const p of promises) {
                try {
                    await p();
                } catch (error) {
                    // Ignore
                }
            }
        }
    }

    /**
     * Indicates whether the runner is currently executing.
     */
    get running() {
        return this.#_running;
    }

    /**
     * Runs the full execution pipeline:
     * middlewares -> command resolution -> seen handlers -> action handler.
     *
     * The running state is reset even if execution throws.
     * @since 1.0.0
     */
    async run(): Promise<unknown> {
        try {
            this.#_running = true;
            const { target, context, seenHandlers } = this.#_helpers.getExecContext();
            // #1: Run the main app's onRun
            await this.#_context.currentApp.onRun?.({
                raw: [...context.raw],
                path: [...context.path],
                options: Object.assign({}, this.#_context.options),
                args: context.args
            });

            // #2: Run the seen handlers
            await this.#_helpers.runSeenHandlers(seenHandlers);

            // #3: Run the execution pipeline
            const hasDelegation = target.delegation.assigned;
            if (!hasDelegation) {
                // Check if the help option was used
                if (context.options.has('help')) {
                    const needsHelp = context.options.get('help') as boolean;
                    if (needsHelp) {
                        console.info(target.help);
                        return;
                    }
                }                
            }

            {
                // Detect unknown options
                const defined = new Set([...target.options.list(), helpOption].flatMap(o => [o.name, o.abbrev].filter(Boolean)));
                const unknownOptions: (OptionName | OptionAbbrev)[] = [];
                for (const k in this.#_context.options) {
                    const key = k as OptionName | OptionAbbrev;
                    if (!defined.has(key)) {
                        unknownOptions.push(key);
                    }
                }

                if (unknownOptions.length > 0) {
                    console.warn(`[WARNING] Unknown CLI parameters "${unknownOptions.join(', ')}" in command "${target.name}"`);
                }
            }

            // Execute target command
            const execRes = await target.execute(context, ZexiCommandSymbol);

            if (hasDelegation) {
                const app = target.delegation.target!;
                const cmd = app._internal.accessCMD(ZexiCommandSymbol)!
                this.#_context.delegateTo(cmd);

                return await this.run();
            } else {
                return await execRes;
            }
        } finally {
            this.#_running = false;
        }
    }
}

export default AppRunner;