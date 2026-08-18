/**
 * Queries the terminal for the current cursor position.
 *
 * The terminal responds to the Device Status Report (DSR) cursor-position
 * query with an ANSI escape sequence in the following format:
 *
 * ```txt
 * ESC [ row ; column R
 * ```
 *
 * The response is read from `stdin` while the stream is temporarily placed
 * into raw mode. Once a valid cursor-position response is received, the
 * temporary input handler is removed and the stream is restored to its
 * normal paused state.
 *
 * ---------------------------------------------------------------------
 * 🔷 TERMINAL REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The process must be attached to a TTY through `stdin`.
 *
 * If `stdin` is not a TTY, the returned promise is rejected because the
 * terminal cannot be queried reliably.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR POSITION
 * ---------------------------------------------------------------------
 *
 * The returned coordinates are one-based terminal coordinates:
 *
 * - `row` - Current terminal row
 * - `column` - Current terminal column
 *
 * These coordinates correspond directly to the row and column reported by
 * the terminal's ANSI cursor-position response.
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT STATE
 * ---------------------------------------------------------------------
 *
 * While waiting for the terminal response:
 *
 * - `stdin` is placed into raw mode
 * - `stdin` is resumed
 * - a temporary `data` listener is registered
 *
 * Once the response is received, the temporary listener is removed, raw mode
 * is disabled, and `stdin` is paused again.
 *
 * ---------------------------------------------------------------------
 * 🔷 ASYNCHRONOUS BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Terminal cursor-position queries are asynchronous because the response is
 * provided by the terminal through `stdin`.
 *
 * @returns Promise resolving to the current one-based terminal cursor
 * position.
 *
 * @throws Error if `stdin` is not attached to a TTY.
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

        /**
         * Restores `stdin` to its state before the cursor-position query.
         *
         * Removes the temporary response listener, disables raw mode, and
         * pauses the input stream.
         */
        const cleanup = () => {
            stdin.off('data', onData);
            stdin.setRawMode?.(false);
            stdin.pause();
        };

        /**
         * Handles terminal responses received through `stdin`.
         *
         * The handler waits for an ANSI cursor-position response and ignores
         * unrelated input until a matching response is received.
         *
         * @param data - Data received from the terminal input stream.
         */
        const onData = (data: Buffer) => {
            const response = data.toString();

            const match = response.match(/\x1b\[(\d+);(\d+)R/);

            if (!match) {
                return;
            }

            cleanup();

            resolve({
                row: Number(match[1]),
                column: Number(match[2])
            });
        };

        // Temporarily configure stdin to receive the terminal response
        // without waiting for line-buffered input.
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', onData);

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