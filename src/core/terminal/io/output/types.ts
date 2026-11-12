import type { ProcessStdWriteStream } from "../shared/streams";

/**
 * References to captured terminal output methods and the global console.
 *
 * Stores partial, readonly snapshots of stdout and stderr methods alongside
 * the captured global console instance. The stream snapshots correspond to
 * the currently configured streams and are refreshed when those streams are
 * replaced. They allow Zexi to retain access to physical output operations
 * while stream methods are intercepted.
 *
 * @since 1.0.0
 */
export type TerminalMethodReferences = {
    /**
     * Snapshot of methods captured from the currently configured stdout
     * stream before interception.
     *
     * Only methods that existed on the original stream are retained.
     *
     * @since 1.0.0
     */
    stdout: Readonly<Partial<ProcessStdWriteStream>>;

    /**
     * Snapshot of methods captured from the currently configured stderr
     * stream before interception.
     *
     * Only methods that existed on the original stream are retained.
     *
     * @since 1.0.0
     */
    stderr: Readonly<Partial<ProcessStdWriteStream>>;

    /**
     * Exact global console instance captured for the current stream
     * configuration before Zexi replaces it.
     *
     * The instance is restored when terminal interception is uninstalled.
     *
     * @since 1.0.0
     */
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
     *
     * @since 1.0.0
     */
    output: string | Uint8Array;

    /**
     * Character encoding used when the output is represented as a string.
     *
     * @since 1.0.0
     */
    encoding?: BufferEncoding;

    /**
     * Callback invoked after the write operation completes.
     *
     * @since 1.0.0
     */
    callback?: WriteCallback;
};

/**
 * Represents a normalized terminal write request retained for deferred
 * writing.
 *
 * An entry is created from an intercepted stdout or stderr write request and
 * preserves the output data, destination stream, encoding, and completion
 * callback required to perform the write after the terminal becomes ready.
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

/**
 * Terminal dimensions reported by a resize event.
 *
 * Describes the terminal viewport dimensions after a resize has been detected.
 *
 * @property width - New number of character columns in the terminal viewport.
 * @property height - New number of character rows in the terminal viewport.
 *
 * @since 1.0.0
 */
export type TerminalIOResizeEvent = {
    width: number;
    height: number;
};

/**
 * Event map for terminal I/O notifications.
 *
 * Maps each supported event name to the signature of its listener callback.
 * The `resize` event is emitted when a change in terminal dimensions is
 * detected.
 *
 * @since 1.0.0
 */
export type TerminalIOEvents = {
    /**
     * Invoked when the terminal viewport dimensions change.
     *
     * @param event - The updated terminal dimensions.
     *
     * @since 1.0.0
     */
    resize: (event: TerminalIOResizeEvent) => void;
}

/**
 * Names of events supported by the terminal I/O event emitter.
 *
 * Derived from {@link TerminalIOEvents} so that event names remain aligned
 * with the declared event map.
 *
 * @since 1.0.0
 */
export type TerminalIOEventName = keyof TerminalIOEvents;
