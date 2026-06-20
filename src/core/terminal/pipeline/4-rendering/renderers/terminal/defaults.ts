import globalUtils from "../../../../../../utils";
import type { TerminalConfig } from "./types";

const SPACES = 2 as const;
const CYCLES = 'mark' as const;
const FORMATS = 'both' as const;

export const DEFAULT_TERMINAL_CONFIG: Record<'compact' | 'pretty', TerminalConfig> = {
    compact: {
        cycles: CYCLES,
        spaces: SPACES,
        formats: FORMATS,
        layout: {
            spaces: 'collapse',
            lineBreaks: 'collapsed',
            indentation: 'reflow'
        }
    },

    pretty: {
        cycles: CYCLES,
        spaces: SPACES,
        formats: FORMATS,
        layout: {
            spaces: 'normalize',
            lineBreaks: 'soft',
            indentation: 'reflow'
        }
    }
};

globalUtils.deepFreeze(DEFAULT_TERMINAL_CONFIG);