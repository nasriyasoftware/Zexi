import type { TerminalConfig } from "./types";

const SPACES = 2;
const CYCLES = 'mark';
const STYLE = 'full';

export const DEFAULT_TERMINAL_CONFIG: Record<'compact' | 'pretty', TerminalConfig> = {
    compact: {
        cycles: CYCLES,
        spaces: SPACES,
        style: STYLE,
        layout: {
            spaces: 'collapse',
            lineBreaks: 'collapsed',
            indentation: 'reflow'
        }
    },

    pretty: {
        cycles: CYCLES,
        spaces: SPACES,
        style: STYLE,
        layout: {
            spaces: 'normalize',
            lineBreaks: 'soft',
            indentation: 'reflow'
        }
    }
};