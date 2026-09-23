import terminalIO from "../terminal.io";
import type { CursorTo } from "../types";

/**
 * Intercepts cursor positioning operations on the standard output streams
 * and forwards them through `terminalIO`.
 *
 * @param args - Arguments received by the terminal's `cursorTo()` method.
 *
 * @returns The result of the original terminal cursor positioning operation.
 *
 * @since 1.0.0
 */
const cursorToInterceptor: CursorTo = (...args) => {
    return terminalIO.cursorTo(...args as Parameters<CursorTo>);
}

export default cursorToInterceptor;