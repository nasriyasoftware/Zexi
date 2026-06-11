/**
 * This module provides a context class for the runner application.
 * It is used to store and manage the context of the application during execution.
 *
 * @module runner/context/runner.ctx
 */
import ContextPointer from "./pointer";
import type CLICommand from "../../command/core/cli.command";
import type { OptionAbbrev, OptionName } from "../../../types/types";
import type { AppRunnerCTXData } from "./types";

/**
 * The context class for the runner application.
 * It provides a way to access and manage the context of the application during execution.
 */
export class AppRunnerContext {
    readonly #_raw: string[];
    readonly #_rootCMD: CLICommand<'static'>;
    readonly #_delegations: CLICommand<'static'>[] = [];
    readonly #_pointer: ContextPointer;
    readonly #_options: Record<OptionName | OptionAbbrev, unknown>;
    readonly #_argsAfterBreak: string[];
    readonly #_words: string[];

    /**
     * Constructs a new instance of the `AppRunnerContext` class.
     * @param {AppRunnerCTXData} input - The input data for constructing the context.
     */
    constructor(input: AppRunnerCTXData) {
        this.#_rootCMD = input.appCMD;
        this.#_raw = input.raw;

        this.#_pointer = new ContextPointer(input.cmd.words);
        this.#_options = input.cmd.options;
        this.#_words = input.cmd.words;
        this.#_argsAfterBreak = input.cmd.argsAfterBreak;
    }

    /**
     * Gets the root application context.
     * @returns {CLICommand<'static'>} The root command of the application.
     */
    get root(): CLICommand<'static'> { return this.#_rootCMD; }

    /**
     * Gets the pointer to the current position in the input words.
     * @returns {ContextPointer} The pointer to the current position in the input words.
     */
    get pointer(): ContextPointer { return this.#_pointer; }

    /**
     * Gets the application context that this context delegates to.
     * @returns {CLICommand<'static'>} The delegated application command.
     */
    get currentApp(): CLICommand<'static'> {
        const delegsNum = this.#_delegations.length;
        return delegsNum > 0 ? this.#_delegations[delegsNum - 1] : this.#_rootCMD;
    }

    /**
     * Gets the options received by the application.
     * @returns {Record<OptionName | OptionAbbrev, unknown>} The options received by the application.
     */
    get options(): Record<OptionName | OptionAbbrev, unknown> { return this.#_options; }

    /**
     * Gets the arguments received after the command break.
     * @returns {string[]} The arguments received after the command break.
     */
    get argsAfterBreak(): string[] { return this.#_argsAfterBreak; }

    /**
     * Gets the words received by the application.
     * @returns {string[]} The words received by the application.
     */
    get words(): string[] { return this.#_words; }

    /**
     * Gets the raw input words received by the application.
     * @returns {string[]} The raw input words received by the application.
     */
    get raw(): string[] { return this.#_raw; }

    /**
     * Delegates the execution to another application context.
     * @param {AppContext} app - The application context to delegate to.
     */
    delegateTo(appCMD: CLICommand<'static'>) {
        this.#_delegations.push(appCMD);
    }
}

export default AppRunnerContext;