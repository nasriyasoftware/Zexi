import clearLineInterceptor from "./clearLine";
import clearScreenDown from "./clearScreenDown";
import cursorToInterceptor from "./cursorTo";
import moveCursorInterceptor from "./moveCursor";
import stderrWriteInterceptor from "./stderr.write";
import stdoutWriteInterceptor from "./stdout.write";

/**
 * The stream-method interceptors installed by terminal output interception.
 *
 * These functions are used internally by the interception controller and are
 * bound to the currently configured stream objects during installation.
 *
 * @internal
 * @since 1.0.0
 */
const interceptors = Object.freeze({
    stdoutWrite: stdoutWriteInterceptor,
    stderrWrite: stderrWriteInterceptor,
    cursorTo: cursorToInterceptor,
    clearLine: clearLineInterceptor,
    clearScreenDown: clearScreenDown,
    moveCursor: moveCursorInterceptor
});

export default interceptors;