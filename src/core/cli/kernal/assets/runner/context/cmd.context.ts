import { normalizeName } from "../../../utils/utils";
import type { OptionName } from "../../../types/types";
import type { CommandContextData, CommandContextOptions, AppCMDArgs } from "../../command/types";

export class CommandContext {
    readonly #_rawCMD: readonly string[];
    readonly #_path: readonly string[];
    readonly #_cmdTxt: string;
    readonly #_arguments: AppCMDArgs;
    readonly #_options: CommandContextOptions;

    constructor(rawCTX: CommandContextData) {

        this.#_rawCMD = Object.freeze(rawCTX.raw);
        this.#_path = Object.freeze(rawCTX.path);
        this.#_cmdTxt = rawCTX.path.join(' ');
        this.#_options = Object.freeze(rawCTX.options);
        this.#_arguments = Object.freeze(rawCTX.args);
    }

    /**
     * Returns the full command path as typed by the user (not the resolved traversal path).
     * @returns A readonly array of strings representing the command path.
     */
    get path(): readonly string[] {
        return this.#_path;
    }

    /**
     * Returns the command text that triggered this command context.
     * This command text is the path of the command joined by spaces.
     * @returns A string representing the command text that triggered this command context.
     */
    get cmd(): string {
        return this.#_cmdTxt;
    }

    /**
     * Returns the raw command text that triggered this command context.
     * This raw command text is the unprocessed command text that was passed to the command handler.
     * @returns A readonly array of strings representing the raw command text that triggered this command context.
     */
    get raw(): readonly string[] {
        return this.#_rawCMD;
    }

    /**
     * Returns the arguments of the command context.
     * This includes the positional, loose, and all arguments passed to the command.
     * @returns A readonly object containing the arguments of the command context.
     */
    get args(): Readonly<AppCMDArgs> {
        return this.#_arguments;
    }

    readonly options = {
        /**
         * Retrieves the value of an option by its name or abbreviation.
         * @param {string} name - The name or abbreviation of the option to retrieve.
         * @returns The value of the option, or throws an error if the option is not found.
         * @throws {Error} If the option is not found.
         */
        get: (name: string): unknown => {
            const normalizedKey = normalizeName<OptionName>(name);

            const option = this.#_options.get(normalizedKey);
            if (!option) {
                throw new Error(`Option "${name}" not found`);
            }

            return option.value;
        },

        /**
         * Checks if a given command name exists in the command registry.
         *
         * @param {string} name - The name of the command to check.
         * @returns {boolean} `true` if the command exists, `false` otherwise.
         */
        has: (name: string): boolean => {
            const normalizedKey = normalizeName<OptionName>(name);
            return this.#_options.has(normalizedKey);
        },

        /**
         * Lists all the options present in the command context.
         * @returns An array of objects where each object has a `key` and a `value` property.
         * The `key` is the name or abbreviation of the option, and the `value` is the value of the option.
         */
        list: () => {
            return Object.entries(this.#_options).map(e => {
                return { key: e[0], value: e[1] }
            })
        }
    }
}

export default CommandContext;