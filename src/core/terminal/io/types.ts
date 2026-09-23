export type ProcessStdWriteStream = typeof process.stdout | typeof process.stderr;

export type TerminalOriginals = {
    stdout: Readonly<Partial<ProcessStdWriteStream>>;
    stderr: Readonly<Partial<ProcessStdWriteStream>>;
    console: Console;
}

/**
 * Callback invoked after a standard-stream write operation completes.
 *
 * @param err - The error encountered during the write, if any.
 *
 * @since 1.0.0
 */
export type WriteCallback = (err?: Error | null | undefined) => void;

/**
 * Signature of the terminal's cursor positioning operation.
 *
 * @since 1.0.0
 */
export type CursorTo = typeof process.stdout.cursorTo;

/**
 * Signature of the terminal's line clearing operation.
 *
 * @since 1.0.0
 */
export type ClearLine = typeof process.stdout.clearLine;

/**
 * Signature of the terminal's screen clearing operation.
 *
 * @since 1.0.0
 */
export type ClearScreenDown = typeof process.stdout.clearScreenDown;

/**
 * Signature of the terminal's relative cursor movement operation.
 *
 * @since 1.0.0
 */
export type MoveCursor = typeof process.stdout.moveCursor;

/**
 * The original `process.stdout.write` function.
 *
 * @since 1.0.0
 */
export type ProcessStdoutWriter = typeof process.stdout.write;

/**
 * The original `process.stderr.write` function.
 *
 * @since 1.0.0
 */
export type ProcessStderrWriter = typeof process.stderr.write;

/**
 * Return type of a standard-stream write operation selected by error state.
 *
 * When `T` is `true`, the return type corresponds to the stderr writer.
 * Otherwise, the return type corresponds to the stdout writer.
 *
 * @typeParam T - Whether the write targets stderr.
 *
 * @since 1.0.0
 */
export type WriteReturnType<T extends boolean> = ReturnType<T extends true
    ? ProcessStderrWriter
    : ProcessStdoutWriter
>;

/**
 * Normalized arguments of a standard-stream write operation.
 *
 * This representation is produced from the overloaded `write()` signatures
 * exposed by Node.js standard streams and provides the write payload together
 * with its optional encoding and completion callback.
 *
 * @since 1.0.0
 */
export type WriteRequest = {
    /**
     * Data to write to the standard stream.
     */
    output: string | Uint8Array;

    /**
     * Character encoding used when the output is represented as a string.
     */
    encoding?: BufferEncoding;

    /**
     * Callback invoked after the write operation completes.
     */
    callback?: WriteCallback;
};

/**
 * Immutable terminal cursor-position data.
 *
 * Represents the row and column reported by the terminal in response to an
 * ANSI cursor-position query.
 *
 * Both coordinates follow the ANSI terminal convention:
 *
 * - `row` is one-based
 * - `column` is one-based
 *
 * The value is immutable so that a captured terminal position cannot be
 * modified after it has been established.
 *
 * @since 1.0.0
 */
export type CursorPosition = Readonly<{
    row: number;
    column: number;
}>;

/**
 * Represents a normalized terminal write request retained for deferred
 * writing.
 *
 * An entry is created from an intercepted `process.stdout.write` or
 * `process.stderr.write` request and preserves the output data, destination
 * stream, encoding, and completion callback required to perform the write
 * after the terminal becomes ready.
 *
 * @property output - Data received by the standard-stream write operation.
 * @property isError - Whether the output is written to stderr instead of
 * stdout.
 * @property encoding - Optional encoding used when the output is a string.
 * @property callback - Optional callback invoked after the write is processed
 * by the original standard stream.
 *
 * @since 1.0.0
 */
export type TerminalBufferEntry = {
    output: string | Uint8Array;
    isError: boolean;
    encoding?: BufferEncoding;
    callback?: WriteCallback;
}