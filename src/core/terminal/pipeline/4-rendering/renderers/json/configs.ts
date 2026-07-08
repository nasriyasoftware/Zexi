import { Token } from "../../../3-tokenization/types";
import type { JSONConfig } from "./types";

const SPACES = 0;
export function DEFAULT_JSON_CONFIG(): Record<'compact' | 'pretty', JSONConfig> {
    return {
        compact: {
            spaces: SPACES,
            layout: {
                spaces: 'collapse',
                lineBreaks: 'collapsed',
                indentation: 'reflow'
            }
        },

        pretty: {
            spaces: 2,
            layout: {
                spaces: 'normalize',
                lineBreaks: 'strict',
                indentation: 'reflow'
            }
        }
    }
}

export const INLINE_SAFE_TOKENS = Object.freeze([
    'primitive',
    'date'
] as Token['kind'][]);