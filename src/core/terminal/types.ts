import type OutputBuffer  from "./inspector/formatter/output.buffer";

export type OriginalDataType = 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'array' | 'set' | 'map' | 'date' | 'record' | 'error' | 'object' | 'regex' | 'function' | 'symbol' | 'unknown';
export type ZexiLogLevel = 'trace' | 'log' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface CLIRenderingOptions {
    /**
     * Whether to render the object inline.
     * @default false
     */
    inline?: boolean;

    /**
     * Whether to ignore colors.
     * @default false
     */
    ignoreColors?: boolean;

    /**
     * Whether to ignore styles.
     * @default false
     */
    ignoreStyles?: boolean;
}

export interface DataSerializationResult {
    output: OutputBuffer;
    originalType: OriginalDataType;
    displayType?: string;
    layout: 'inline' | 'multiline';
}

export type LogFormatOptions = {
    /**
     * Enable color. Setting this to `false` will remove all color from the output
     * @default true
     */
    color?: boolean;

    /**
     * Log the input without log level color and tag
     * @default false
     */
    raw?: boolean;
}