import type { CLIOption } from "./option";
import type { OptionDataType } from "./types";
import type { OptionAbbrev, OptionName } from "../../types/types";

export class CLIOptionManager {
    readonly #_data = new Map<string, CLIOption<OptionDataType>>();

    /**
     * Find an option in the manager using the given names or abbreviations.
     *
     * If an option is found that matches any of the given names or abbreviations, then it is returned.
     * Otherwise, null is returned.
     *
     * @param {Array<OptionName | OptionAbbrev>} names - The names or abbreviations to use when looking up the option.
     * @returns {CLIOption | null} The option that matches any of the given names or abbreviations, or null if no option is found.
     */
    find(names: (OptionName | OptionAbbrev)[]): CLIOption<OptionDataType> | null {
        const aliases = new Set(names);

        for (const option of this.#_data.values()) {
            for (const name of aliases) {
                if (option.name === name || option.abbrev === name) {
                    return option;
                }
            }
        }

        return null;
    }

    /**
     * Add an option to the manager.
     *
     * If an option with the same name or abbreviation already exists in the manager, then an error is thrown.
     *
     * @param {CLIOption} option - The option to add to the manager.
     * @throws {Error} If an option with the same name or abbreviation already exists in the manager.
     */
    add<K extends OptionDataType>(option: CLIOption<K>) {
        const opt = this.find([option.name, option.abbrev!]);

        if (opt) {
            throw new Error(`Option with name "${option.name}" or abbreviation "${option.abbrev}" already exists`);
        }

        this.#_data.set(option.name, option);
    }

    /**
     * Returns an array of all options in the manager.
     *
     * @returns {CLIOption<OptionDataType>[]} An array of all options in the manager.
     * @readonly The array is a copy of the internal data structure, so changes to the array will not affect the manager.
     */
    list(): CLIOption<OptionDataType>[] {
        return Array.from(this.#_data.values());
    }
}

export default CLIOptionManager;