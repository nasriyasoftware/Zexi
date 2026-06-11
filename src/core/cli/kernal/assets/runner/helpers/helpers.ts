
import { normalizeName } from "../../../utils/utils";
import type { CLIOptionToken } from "../types";
import type { OptionAbbrev, OptionName } from "../../../types/types";

export function constructOptions(optionsTokens: CLIOptionToken[]): Record<OptionName | OptionAbbrev, unknown> {
    const options: Record<OptionName | OptionAbbrev, unknown> = {};
    
    for (const option of optionsTokens) {
        try {
            const key = normalizeName<OptionName>(option.name);
            options[key] = option.value;
        } catch (error) {
            if (error instanceof Error) {
                error.message = `${error.message} | Input: ${option.raw}`;
            }

            throw error;
        }
    }

    return options;
}

