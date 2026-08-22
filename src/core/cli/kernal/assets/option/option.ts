import atomix from "@nasriya/atomix";
import { normalizeName } from "../../utils/utils";
import { ZexiOptionPreservedNamesOverrideSymbol } from "../keys";
import type { OptionAbbrev, OptionName } from "../../types/types";
import type { CLIOptionConfigType, CLIOptionParams, OptionDataType } from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

const preservedKeys = ['help'];
const preservedAbbrevs = ['h'];

export class CLIOption<K extends OptionDataType = 'string'> {
    readonly #_configs: CLIOptionConfigType<K> = {
        name: '' as OptionName,
        abbrev: undefined,
        description: undefined,
        required: false,
        defaultValue: undefined,
        dataType: 'string' as K
    }

    constructor(configs: CLIOptionParams<K>, bypassPreservedKeysAuth?: symbol) {
        if (!atomix.valueIs.record(configs)) {
            throw new TypeError(`Expected configs to be a record object, but got ${typeof configs}`);
        }

        if (hasOwnProp(configs, 'name')) {
            const name = normalizeName(configs.name);
            if (bypassPreservedKeysAuth !== ZexiOptionPreservedNamesOverrideSymbol && preservedKeys.includes(name)) {
                throw new Error(`The option name "${name}" is reserved`);
            }

            this.#_configs.name = name as OptionName;
        } else {
            throw new Error('Option name is required');
        }

        if (hasOwnProp(configs, 'abbrev')) {
            const abbrev = normalizeName(configs.abbrev);
            if (abbrev.length > 1) {
                throw new Error('Abbreviation must be a single character');
            }

            if (bypassPreservedKeysAuth !== ZexiOptionPreservedNamesOverrideSymbol && preservedAbbrevs.includes(abbrev)) {
                throw new Error(`The option abbreviation "${abbrev}" is reserved`);
            }

            this.#_configs.abbrev = abbrev as OptionAbbrev;
        }

        if (hasOwnProp(configs, 'description')) {
            if (typeof configs.description !== 'string') {
                throw new TypeError(`The option description (when provided) must be a string, instead got ${typeof configs.description}`);
            }

            const desc = configs.description.trim();
            if (desc.length === 0) {
                throw new RangeError('Option description (when provided) cannot be empty');
            }

            this.#_configs.description = desc;
        }

        if (hasOwnProp(configs, 'required')) {
            if (typeof configs.required !== 'boolean') {
                throw new TypeError(`The option required (when provided) must be a boolean, instead got ${typeof configs.required}`);
            }

            this.#_configs.required = configs.required;
        }

        if (hasOwnProp(configs, 'dataType')) {
            if (typeof configs.dataType !== 'string') {
                throw new TypeError(`The option dataType (when provided) must be a string, instead got ${typeof configs.dataType}`);
            }

            const allowedDataTypes = ['string', 'boolean', 'number', 'date'];
            if (!allowedDataTypes.includes(configs.dataType)) {
                throw new RangeError(`The option dataType (when provided) must be one of ${allowedDataTypes.join(', ')}, instead got ${configs.dataType}`);
            }

            this.#_configs.dataType = configs.dataType;
        }

        if (hasOwnProp(configs, 'defaultValue')) {
            if (['string', 'number', 'boolean'].includes(this.#_configs.dataType)) {
                if (typeof configs.defaultValue !== this.#_configs.dataType) {
                    throw new TypeError(`The option defaultValue (when provided) must match the option dataType (${this.#_configs.dataType}), instead got ${typeof configs.defaultValue}`);
                }
            } else if (this.#_configs.dataType === 'date') {
                if (!(configs.defaultValue instanceof Date)) {
                    throw new TypeError(`The option defaultValue (when provided) must match the option dataType (${this.#_configs.dataType}), instead got ${typeof configs.defaultValue}`);
                }
            }

            this.#_configs.defaultValue = configs.defaultValue;
        }
    }

    /**
     * Get the name of the option.
     *
     * The name is the value that should be used when calling the option on the command line.
     * If the option is configured with an abbreviation, then the abbreviation can also be used.
     *
     * @returns {OptionName} The name of the option.
     */
    get name(): CLIOptionConfigType<K>["name"] {
        return this.#_configs.name;
    }

    /**
     * Get the abbreviation of the option.
     *
     * If the option is configured with an abbreviation, then the abbreviation can be used instead of the option name.
     *
     * @returns {OptionAbbrev | undefined} The abbreviation of the option, or undefined if the option is not configured with an abbreviation.
     */
    get abbrev(): CLIOptionConfigType<K>["abbrev"] {
        return this.#_configs.abbrev;
    }

    /**
     * Get the description of the option.
     *
     * The description is a string that is displayed when the user requests help information for the option.
     *
     * @returns {string | undefined} The description of the option, or undefined if the option is not configured with a description.
     */
    get description(): CLIOptionConfigType<K>["description"] {
        return this.#_configs.description;
    }

    /**
     * Get the data type of the option.
     *
     * The data type is a string that specifies the type of value that the option expects.
     *
     * @returns {string} The data type of the option.
     */
    get dataType(): CLIOptionConfigType<K>["dataType"] {
        return this.#_configs.dataType;
    }

    /*************  ✨ Windsurf Command ⭐  *************/
    /**
     * Get whether the option is required or not.
     *
     * If the option is required, then the command line tool will not allow the user to omit the option.
     *
     * @returns {boolean} Whether the option is required or not.
     */
    /*******  b74cb0f5-d7ac-44aa-a310-41d1d124bcc3  *******/
    get required(): CLIOptionConfigType<K>["required"] {
        return this.#_configs.required;
    }

    /**
     * Get the default value of the option.
     *
     * If the option is not specified by the user, then the command line tool will use the default value.
     *
     * @returns {any} The default value of the option, or undefined if the option is not configured with a default value.
     */
    get defaultValue(): CLIOptionConfigType<K>["defaultValue"] {
        return this.#_configs.defaultValue;
    }

    /**
     * Returns an object containing information about how to use this option in the given command.
     *
     * @param {string} cmd - The name of the command.
     * @returns {{
     *     usedAs: string,
     *     descriptions: string,
     *     examples: string
     * }}
     */
    usageIn(cmd: string): {
        usedAs: string,
        descriptions: string,
        examples: string
    } {
        const item = {
            usedAs: '',
            descriptions: this.description || '',
            examples: ''
        };

        const usage = [`--${this.name}`];
        if (this.abbrev) { usage.push(`-${this.abbrev}`); }
        item.usedAs = usage.join(', ');

        const examples = usage.map(u => `${this.name} ${u}`);
        item.examples = examples.length > 1 ? examples.map(e => `"${e}"`).join(', ') : examples[0];

        return item;
    }
}

export default CLIOption;