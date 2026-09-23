import terminalIO from "../terminal.io";
import type { ClearLine } from "../types";

/**
 * Intercepts line-clearing operations on the standard output streams and
 * forwards them through `terminalIO`.
 *
 * @param args - Arguments received by the terminal's `clearLine()` method.
 *
 * @returns The result of the original terminal line-clearing operation.
 *
 * @since 1.0.0
 */
const clearLineInterceptor: ClearLine = (...args) => {
    return terminalIO.clearLine(...args);
}

export default clearLineInterceptor;