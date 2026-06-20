import globalUtils from "../../../../../../utils";
import type { DebugConfig } from "./types";

const SPACES = 4 as const;
const CYCLES = 'mark' as const;

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

globalUtils.deepFreeze(DEFAULT_DEBUG_CONFIG);