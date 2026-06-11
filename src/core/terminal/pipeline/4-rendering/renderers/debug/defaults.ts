import type { DebugConfig } from "./types";

const SPACES = 4;
const CYCLES = 'mark';

export const DEFAULT_DEBUG_CONFIG: Record<'compact' | 'pretty', DebugConfig> = {
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
};