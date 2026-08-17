
export const ZEXI_LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;
export type ZexiLogLevel = typeof ZEXI_LOG_LEVELS[number];

export type OutputTarget = 'json' | 'debug';
export type OutputMode = 'compact' | 'pretty';

export type TerminalLogOptions = {
    target?: OutputTarget;
    trace?: boolean;
    print?: boolean;
}

export type ZexiTerminalOptions = {
    logLevel?: ZexiLogLevel;
    includeMetadata?: boolean
}