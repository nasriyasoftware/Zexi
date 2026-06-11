import type { CLIOption } from "./option";
import type { OptionDataType } from "./types";

export class OptionData {
    readonly #_option: CLIOption<OptionDataType>;
    readonly #_value: unknown;

    constructor(option: CLIOption<OptionDataType>, data: unknown) {
        this.#_option = option;
        this.#_value = data;
    }

    get definition(): CLIOption<OptionDataType> {
        return this.#_option;
    }

    get value(): unknown {
        return this.#_value;
    }
}

export default OptionData;