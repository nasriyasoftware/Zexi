import terminalIO from "../terminal.io";
import type { ClearScreenDown } from "../types";

/**
 * Intercepts screen-clearing operations on the standard output streams and
 * forwards them through `terminalIO`.
 *
 * @param args - Arguments received by the terminal's `clearScreenDown()` method.
 *
 * @returns The result of the original terminal screen-clearing operation.
 *
 * @since 1.0.0
 */
const clearScreenDownInterceptor: ClearScreenDown = (...args) => {
    return terminalIO.clearScreenDown(...args);
}

export default clearScreenDownInterceptor;