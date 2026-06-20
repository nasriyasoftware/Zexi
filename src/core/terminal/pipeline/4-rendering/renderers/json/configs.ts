import { Token } from "../../../3-tokenization/types";
import type { JSONConfig } from "./types";

const SPACES = 0;
export const DEFAULT_JSON_CONFIG: Record<'compact' | 'pretty', JSONConfig> = {
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

export const INLINE_SAFE_TOKENS = [
    'primitive',
    'date'
] as Token['kind'][]