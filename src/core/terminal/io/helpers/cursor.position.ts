import terminalIO, { ZexiTerminalIO } from "../terminal.io";
import type { CursorPosition } from "../types";

/**
 * Queries the terminal for its current cursor position.
 *
 * The terminal is queried using the ANSI Device Status Report sequence
 * (`CSI 6 n`). The terminal responds through `stdin` with a cursor-position
 * report containing the current row and column.
 *
 * This function is the low-level implementation used by
 * {@link terminalIO.queryCursorPosition}. It is not intended to be called
 * directly by consumers of the terminal subsystem.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The process must be attached to a TTY through `stdin`.
 *
 * The function temporarily:
 *
 * - enables raw input mode
 * - resumes `stdin`
 * - registers a temporary response listener
 * - waits for the terminal's cursor-position response
 *
 * Once the response is received, or the query fails, `stdin` is restored to
 * its previous operational state.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE HANDLING
 * ---------------------------------------------------------------------
 *
 * The terminal is expected to respond using the ANSI cursor-position report
 * format:
 *
 * ```txt
 * CSI row ; column R
 * ```
 *
 * Only responses matching this format are processed. Unrelated input
 * received while waiting for the terminal response is ignored.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEANUP
 * ---------------------------------------------------------------------
 *
 * The temporary input state is removed when the query completes.
 *
 * Cleanup:
 *
 * - removes the response listener
 * - disables raw input mode
 * - pauses `stdin`
 * - clears the pending timeout
 *
 * This prevents the cursor-position query from leaving `stdin` in an altered
 * state after initialization completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT
 * ---------------------------------------------------------------------
 *
 * The query is aborted after the specified timeout duration if no valid
 * cursor-position response is received.
 *
 * When this occurs, the temporary input state is cleaned up and the returned
 * promise is rejected.
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN VALUE
 * ---------------------------------------------------------------------
 *
 * Resolves with an immutable cursor-position object:
 *
 * ```ts
 * {
 *     row: number;
 *     column: number;
 * }
 * ```
 *
 * Both coordinates are one-based, matching the ANSI cursor-position
 * convention.
 *
 * @param timeoutDuration - The maximum time in milliseconds to wait for a
 * valid cursor-position response. Defaults to `1000` milliseconds.
 *
 * @returns Promise resolving to the current terminal cursor position.
 *
 * @throws Error if `stdin` is not attached to a TTY.
 * @throws Error if the terminal does not respond within the specified timeout
 * duration.
 *
 * @since 1.0.0
 */
async function queryCursorPosition(timeoutDuration = 1000): Promise<CursorPosition> {
    const { promise, resolve, reject } = Promise.withResolvers<CursorPosition>();
    const stdin = ZexiTerminalIO.streams.stdin;

    if (!stdin.isTTY) {
        throw new Error('stdin is not a TTY');
    }

    const refs = {
        /**
         * Timeout used to abort the cursor-position query if the terminal
         * does not respond within the allowed period.
         *
         * @since 1.0.0
         */
        timeout: null as NodeJS.Timeout | null,

        /**
         * Restores `stdin` to the operational state used before the cursor-position
         * query began.
         *
         * Removes the temporary response listener, clears the pending timeout,
         * disables raw mode, and pauses the input stream.
         *
         * @since 1.0.0
         */
        cleanup: () => {
            if (refs.timeout) {
                clearTimeout(refs.timeout);
                refs.timeout = null;

                stdin.off('data', refs.onData);
                stdin.setRawMode?.(false);
                stdin.pause();
            }
        },

        /**
         * Handles terminal responses received through `stdin`.
         *
         * The handler waits for an ANSI cursor-position response and ignores
         * unrelated input until a matching response is received.
         *
         * @param data - Data received from the terminal input stream.
         *
         * @since 1.0.0
         */
        onData: (data: Buffer) => {
            const response = data.toString();
            const match = response.match(/\x1b\[(\d+);(\d+)R/);

            if (!match) {
                return;
            }

            refs.cleanup();

            resolve(Object.freeze({
                row: Number(match[1]),
                column: Number(match[2])
            }));
        }
    };

    refs.timeout = setTimeout(() => {
        refs.cleanup();
        reject(new Error('Timeout: No cursor-position response received'));
    }, timeoutDuration ?? 1000);

    // Temporarily configure stdin to receive the terminal response
    // without waiting for line-buffered input.
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', refs.onData);

    // Request the terminal's current cursor position.
    terminalIO.write('\x1b[6n');

    return promise;
}

export default queryCursorPosition;