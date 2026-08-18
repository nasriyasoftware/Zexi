/**
 * Queries the terminal for the current cursor position.
 *
 * The terminal is queried using the ANSI Device Status Report sequence
 * (`CSI 6 n`). The terminal responds through `stdin` with a cursor-position
 * report containing the current row and column.
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
 * - listens for the terminal response
 *
 * Once the response is received, `stdin` is restored to its previous state.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE HANDLING
 * ---------------------------------------------------------------------
 *
 * Only ANSI cursor-position responses are processed. Unrelated input
 * received while waiting for the response is ignored.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT
 * ---------------------------------------------------------------------
 *
 * The query is aborted after one second if no valid cursor-position response
 * is received.
 *
 * In that case:
 *
 * - the temporary input listener is removed
 * - raw mode is disabled
 * - `stdin` is paused
 * - the returned promise is rejected
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN VALUE
 * ---------------------------------------------------------------------
 *
 * Resolves with the cursor position reported by the terminal:
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
 * @returns Promise resolving to the current terminal cursor position
 *
 * @throws Error if `stdin` is not attached to a TTY
 * @throws Error if the terminal does not respond within one second
 *
 * @since 1.0.0
 */
const getCursorPosition = (): Promise<{ row: number; column: number }> => {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;

        if (!stdin.isTTY) {
            reject(new Error('stdin is not a TTY'));
            return;
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
             * Restores `stdin` to its state before the cursor-position query.
             *
             * Removes the temporary response listener, disables raw mode, and
             * pauses the input stream.
             *
             * @since 1.0.0
             */
            cleanup: () => {
                if (refs.timeout) {
                    clearTimeout(refs.timeout);
                    refs.timeout = null;
                }

                stdin.off('data', refs.onData);
                stdin.setRawMode?.(false);
                stdin.pause();
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

                resolve({
                    row: Number(match[1]),
                    column: Number(match[2])
                });
            }
        };

        refs.timeout = setTimeout(() => {
            refs.cleanup();
            reject(new Error('Timeout: No cursor-position response received'));
        }, 1000);

        // Temporarily configure stdin to receive the terminal response
        // without waiting for line-buffered input.
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', refs.onData);

        // Request the terminal's current cursor position.
        process.stdout.write('\x1b[6n');
    });
};

/**
 * The terminal cursor position captured during module initialization.
 *
 * This position represents the cursor location immediately before Zexi
 * begins managing its terminal output.
 *
 * The position is captured once and remains immutable for the lifetime of
 * the module. It is used as the reference point for operations that need to
 * restore or clear Zexi's terminal output without assuming ownership of
 * content written before Zexi was initialized.
 *
 * Coordinates are one-based, matching the coordinates reported by the
 * terminal's ANSI cursor-position response.
 *
 * @since 1.0.0
 */
const initialCursorPosition = Object.freeze(await getCursorPosition());

export default initialCursorPosition;