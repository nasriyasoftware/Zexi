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
        spaces: SPACES,
        layout: {
            spaces: 'normalize',
            lineBreaks: 'strict',
            indentation: 'reflow'
        }
    }
}