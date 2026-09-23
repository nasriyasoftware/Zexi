import terminalIO from "../terminal.io";
import type { MoveCursor } from "../types";

/**
 * Intercepts relative cursor movement operations on the standard output
 * streams and forwards them through `terminalIO`.
 *
 * @param args - Arguments received by the terminal's `moveCursor()` method.
 *
 * @returns The result of the original terminal cursor movement operation.
 *
 * @since 1.0.0
 */
const moveCursorInterceptor: MoveCursor = (...args) => {
    return terminalIO.moveCursor(...args);
}

export default moveCursorInterceptor;