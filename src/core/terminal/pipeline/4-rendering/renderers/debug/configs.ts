import type { Token } from "../../../3-tokenization/types";
import type { DebugConfig } from "./types";

const SPACES = 4 as const;
const CYCLES = 'mark' as const;

export function DEFAULT_DEBUG_CONFIG(): Record<'compact' | 'pretty', DebugConfig> {
    return {
        compact: {
            spaces: SPACES,
            cycles: CYCLES,
            layout: {
                spaces: 'preserve',
                lineBreaks: 'strict',
                indentation: 'reflow'
            }
        },

        pretty: {
            spaces: SPACES,
            cycles: CYCLES,
            layout: {
                spaces: 'preserve',
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