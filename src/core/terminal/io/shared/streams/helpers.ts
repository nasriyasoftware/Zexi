import { ProcessStdWriteStream } from "./types";

/**
 * Captures the stream methods that terminal output may replace.
 *
 * The returned snapshot contains only methods currently present on the
 * supplied stream. Method references are retained without binding so they
 * can later be restored or invoked with the stream as their receiver.
 *
 * @typeParam T - A process stdout or stderr stream.
 * @param original - Stream whose methods are being captured.
 * @returns A partial snapshot of supported write and terminal-control
 * methods.
 * @since 1.0.0
 */
export function captureStream<T extends ProcessStdWriteStream>(
    original: T
): Partial<T> {
    const target: Partial<T> = {};

    if (original.write) { target.write = original.write; }
    if (original.cursorTo) { target.cursorTo = original.cursorTo; }
    if (original.clearLine) { target.clearLine = original.clearLine; }
    if (original.clearScreenDown) { target.clearScreenDown = original.clearScreenDown; }
    if (original.moveCursor) { target.moveCursor = original.moveCursor; }

    return target;
}

/**
 * Restores captured write and terminal-control methods on a stream object.
 *
 * This operation restores method properties only; it does not replace the
 * stream object or change which stream is configured by terminal I/O. A
 * method omitted from the snapshot is left unchanged.
 *
 * @typeParam T - A process stdout or stderr stream.
 * @param original - Stream object whose methods are restored.
 * @param target - Snapshot containing methods to restore.
 * @returns `void`
 * @since 1.0.0
 */
export function restoreStream<T extends ProcessStdWriteStream>(
    original: T,
    target: Partial<T>
): void {
    if (target.write) { original.write = target.write; }
    if (target.cursorTo) { original.cursorTo = target.cursorTo; }
    if (target.clearLine) { original.clearLine = target.clearLine; }
    if (target.clearScreenDown) { original.clearScreenDown = target.clearScreenDown; }
    if (target.moveCursor) { original.moveCursor = target.moveCursor; }
}