import terminalIO from "..";
import screenManager from "../shared/screen";
import terminalStreams from "../shared/streams";
import processStdInterception from "./interception/interception.controller";
import type { TerminalBufferEntry, WriteReturnType } from "./types";

/**
 * Performs physical terminal output and manages output interception.
 *
 * `TerminalOutput` is the output-side boundary for terminal I/O. It writes
 * through captured methods of the currently configured output streams,
 * provides ANSI cursor and erase operations, and exposes the process-stream
 * interception controller.
 *
 * Writes submitted through {@link queue} are retained until the root
 * coordinator has completed initialization. {@link write} bypasses
 * interception and writes directly through the captured stream method,
 * allowing renderers, query dispatchers, and interception fallbacks to emit
 * terminal output without recursively invoking intercepted methods.
 *
 * The module exports one process-wide output instance. It does not own
 * terminal initialization, input acquisition, or resize state.
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT AND INTERCEPTION
 * ---------------------------------------------------------------------
 *
 * {@link interception} exposes the manager that installs, enables, disables,
 * and uninstalls the process-stream interceptors. The stdout and stderr
 * interceptors route ordinary application writes through the terminal entry
 * pipeline while active; internal physical writes use {@link write}.
 *
 * Disabling active interception does not itself uninstall the methods.
 * Uninstallation restores the methods captured for the currently configured
 * streams.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFERED WRITES
 * ---------------------------------------------------------------------
 *
 * {@link queue} preserves accepted requests in arrival order while terminal
 * initialization is incomplete. {@link flush} writes those entries through
 * their captured methods. New writes submitted after the root coordinator
 * becomes ready are written immediately.
 *
 * @since 1.0.0
 */
export class TerminalOutput {
    /**
     * Stores intercepted terminal writes received before the terminal becomes
     * ready.
     *
     * Entries are retained in arrival order and flushed by {@link flush}
     * after terminal initialization completes.
     *
     * The buffer contains only requests received through the interception
     * pipeline. Direct writes performed through {@link write} bypass this buffer
     * and are written immediately through the captured methods of the
     * configured output streams.
     *
     * @since 1.0.0
     */
    readonly #_buffer: TerminalBufferEntry[] = [];

    /**
     * Writes a buffered terminal entry directly through its configured
     * stream's captured writer.
     *
     * The destination stream is selected from the entry's `isError` flag.
     * Encoding and completion callback arguments are forwarded according to the
     * standard Node.js `write()` overloads.
     *
     * This method bypasses Zexi's installed interceptors and is therefore safe to
     * use while flushing buffered requests. The method is captured from the
     * currently configured stream and invoked with that stream as its
     * receiver.
     *
     * The selected configured stream must provide a captured `write()`
     * operation. Its absence represents an internal terminal I/O invariant
     * violation and causes an {@link Error} to be thrown.
     *
     * @param entry - Buffered terminal write to flush.
     *
     * @returns The return value of the captured standard-stream `write()`
     * operation.
     *
     * @throws {Error}
     * Thrown if the selected configured stream does not provide a `write()`
     * operation.
     *
     * @since 1.0.0
     */
    #_writeEntry(entry: TerminalBufferEntry): boolean {
        const { isError, output, encoding, callback } = entry;
        const { writer, thisCTX } = terminalStreams.getWritingCTX(isError);

        if (!writer.write) {
            throw new Error(
                `Invariant violation: Original ${isError ? 'stderr' : 'stdout'} stream does not provide a write operation.`
            );
        }

        const result = (() => {
            if (typeof output === 'string') {
                if (!callback && !encoding) {
                    return writer.write.call(thisCTX, output);
                }

                if (callback && !encoding) {
                    return writer.write.call(thisCTX, output, callback as any);
                }

                return writer.write.call(thisCTX, output, encoding, callback);
            }

            // handle buffer case
            if (callback) {
                // @ts-ignore
                return writer.write.call(thisCTX, output, callback);
            }

            return writer.write.call(thisCTX, output);

        })();

        return result;
    }

    /**
     * Gets the process-stream interception controller used by this output
     * module.
     *
     * @returns The singleton interception controller.
     * @since 1.0.0
     */
    get interception() { return processStdInterception; }

    /**
     * Indicates whether the currently configured stdout and stderr streams
     * are both TTYs.
     *
     * This output-specific value does not inspect stdin. The root terminal
     * coordinator combines this value with the input module's TTY state.
     *
     * @returns `true` when both output streams are TTYs; otherwise, `false`.
     * @since 1.0.0
     */
    get isTTY() {
        return (
            terminalStreams.output.isTTY === true &&
            terminalStreams.error.isTTY === true
        );
    }

    /**
     * Queues a terminal write until the terminal becomes ready.
     *
     * When the terminal is already ready, the write is forwarded immediately to
     * {@link write}. Otherwise, the request is added to the internal buffer and
     * retained until the root coordinator's {@link terminalIO.initialize}
     * readiness step.
     *
     * Buffered requests are flushed in the order in which they were received.
     * The terminal remains not ready while the buffer is being flushed so that
     * writes received during the flush are also added to the buffer and preserved
     * in their correct order.
     *
     * @typeParam T - Whether the output is written to stderr.
     *
     * @param output - Data to write to the selected standard stream.
     * @param options - Optional stream selection, encoding, and completion
     * callback.
     *
     * @returns The result of the immediate write when the terminal is ready, or
     * `true` when the request has been accepted for deferred writing.
     *
     * @since 1.0.0
     */
    queue<T extends boolean>(
        output: string | Uint8Array,
        options?: {
            isError?: T
            callback?: (err?: Error | null) => void,
            encoding?: BufferEncoding,
        }
    ): boolean {
        if (terminalIO.isReady) {
            return this.write(output, options);
        }

        const entry = {
            output,
            isError: options?.isError === true,
            callback: typeof options?.callback === 'function' ? options.callback : undefined,
            encoding: typeof options?.encoding === 'string' ? options.encoding : undefined
        };

        this.#_buffer.push(entry);
        return true;
    }

    /**
     * Writes all buffered entries directly to their configured streams in
     * arrival order.
     *
     * The buffer is drained synchronously. Each entry is removed before it is
     * written; if a physical write throws, the error is propagated and later
     * entries remain buffered.
     *
     * @returns `void`
     * @throws Any error thrown by an entry's captured stream writer.
     * @since 1.0.0
     */
    flush() {
        while (this.#_buffer.length > 0) {
            const entry = this.#_buffer.shift()!;
            this.#_writeEntry(entry);
        }
    }

    /**
     * Writes directly through the captured writer of the configured standard
     * stream.
     *
     * This method bypasses Zexi's installed interceptors and is therefore the
     * physical output path used by Zexi when it must write directly to the
     * terminal.
     *
     * The destination stream is selected using the `isError` option:
     *
     * - `false` writes to the configured stdout stream
     * - `true` writes to the configured stderr stream
     *
     * The remaining options follow the standard Node.js `write()` overloads for
     * string or byte output.
     *
     * This method is intentionally used by Zexi's interceptors and terminal
     * rendering code to prevent internally generated output from recursively
     * entering the interception pipeline.
     *
     * @typeParam T - Whether the output is written to stderr.
     *
     * @param output - Data to write to the selected standard stream.
     * @param options - Optional stream selection, encoding, and completion
     * callback.
     *
     * @returns The return value of the captured standard-stream `write()`
     * operation.
     *
     * @since 1.0.0
     */
    write<T extends boolean>(
        output: string | Uint8Array,
        options?: {
            isError?: T
            callback?: (err?: Error | null) => void,
            encoding?: BufferEncoding,
        }
    ): WriteReturnType<T> {
        const entry = {
            output,
            isError: options?.isError === true,
            callback: typeof options?.callback === 'function' ? options.callback : undefined,
            encoding: typeof options?.encoding === 'string' ? options.encoding : undefined
        }

        return this.#_writeEntry(entry) as WriteReturnType<T>;
    }

    /**
     * Positions the terminal cursor at the specified coordinates.
     *
     * When only the horizontal coordinate is provided, the cursor is positioned
     * on that column of the current row.
     *
     * When both coordinates are provided, the cursor is positioned at the
     * specified column and row.
     *
     * The coordinates are converted to the corresponding ANSI cursor-positioning
     * sequence and written through the captured stdout writer. This bypasses
     * Zexi's installed interceptors so that terminal control sequences generated
     * by Zexi do not re-enter the interception pipeline.
     *
     * @param x - Zero-based horizontal cursor position.
     * @param y - Optional zero-based vertical cursor position.
     * @param callback - Optional callback invoked after the sequence is written.
     *
     * @returns Whether the control sequence was accepted for writing.
     *
     * @since 1.0.0
     */
    cursorTo(x: number, y?: number, callback?: () => void): boolean;
    cursorTo(x: number, callback: () => void): boolean;
    cursorTo(x: number, y?: number | (() => void), callback?: () => void): boolean {
        const req: {
            x: number,
            y?: number,
            cb?: () => void
        } = { x };

        if (typeof y === 'number') {
            req.y = y;
        } else if (typeof y === 'function') {
            req.cb = y;
        }

        if (typeof callback === 'function') {
            req.cb = callback;
        }

        const sequence = req.y === undefined
            ? `\x1b[${req.x + 1}G`
            : `\x1b[${req.y + 1};${x + 1}H`;

        return this.write(sequence, { callback: req.cb });
    }

    /**
     * Clears the specified portion of the current terminal line.
     *
     * The direction follows the Node.js `clearLine()` convention:
     *
     * - `0` clears from the cursor to the end of the line
     * - `1` clears from the beginning of the line to the cursor
     * - `-1` clears the entire line
     *
     * The direction is translated to the corresponding ANSI erase-line sequence
     * and written through the captured stdout writer. This bypasses Zexi's
     * installed interceptors so that terminal control sequences generated by
     * Zexi do not re-enter the interception pipeline.
     *
     * @param direction - Portion of the current line to clear.
     * @param callback - Optional callback invoked after the sequence is written.
     *
     * @returns Whether the control sequence was accepted for writing.
     *
     * @since 1.0.0
     */
    clearLine(direction: -1 | 0 | 1 = 0, callback?: () => void): boolean {
        const ansiDirection = direction === -1 ? 2 : direction;
        return this.write(`\x1b[${ansiDirection}K`, { callback });
    }

    /**
     * Clears the terminal from the current cursor position downward.
     *
     * The corresponding ANSI erase-in-display sequence is written through the
     * captured stdout writer. This bypasses Zexi's installed interceptors so that
     * terminal control sequences generated by Zexi do not re-enter the
     * interception pipeline.
     *
     * @param callback - Optional callback invoked after the sequence is written.
     *
     * @returns Whether the control sequence was accepted for writing.
     *
     * @since 1.0.0
     */
    clearScreenDown(callback?: () => void): boolean {
        return this.write('\x1b[0J', { callback });
    }

    /**
     * Moves the terminal cursor relative to its current position.
     *
     * Horizontal and vertical movement are converted to the corresponding ANSI
     * cursor-movement sequences. Positive and negative values move the cursor in
     * opposite directions:
     *
     * - positive `dx` moves right
     * - negative `dx` moves left
     * - positive `dy` moves down
     * - negative `dy` moves up
     *
     * The generated sequences are written through the captured stdout writer.
     * This bypasses Zexi's installed interceptors so that terminal control
     * sequences generated by Zexi do not re-enter the interception pipeline.
     *
     * @param dx - Number of columns to move horizontally.
     * @param dy - Number of rows to move vertically.
     * @param callback - Optional callback invoked after the sequence is written.
     *
     * @returns Whether the control sequence was accepted for writing.
     *
     * @since 1.0.0
     */
    moveCursor(dx: number, dy: number, callback?: () => void): boolean {
        let sequence = '';

        if (dy < 0) {
            sequence += `\x1b[${-dy}A`;
        } else if (dy > 0) {
            sequence += `\x1b[${dy}B`;
        }

        if (dx > 0) {
            sequence += `\x1b[${dx}C`;
        } else if (dx < 0) {
            sequence += `\x1b[${-dx}D`;
        }

        return this.write(sequence, { callback });
    }

    /**
     * Toggles between the original and alternate terminal screens.
     *
     * The operation is a no-op while screen management is disabled. A screen
     * that has not completed initialization cannot be switched and causes an
     * invariant error.
     *
     * @throws {Error} If screen initialization has not reached `READY`.
     * @since 1.0.0
     */
    switchScreen() {
        if (screenManager.state === 'Disabled') { return; }

        if (screenManager.initState !== 'READY') {
            throw new Error(`Invariant violation: Screen initialization must be in READY state, but was ${screenManager.initState}.`);
        }

        screenManager.switch();
    }
}

/**
 * The process-wide terminal output module.
 *
 * This singleton writes through the captured methods of the currently
 * configured output streams and owns output buffering and interception
 * access. The root terminal I/O coordinator uses it for physical output and
 * flushes deferred writes after initialization.
 *
 * @since 1.0.0
 */
const terminalOutput = new TerminalOutput();
export default terminalOutput;