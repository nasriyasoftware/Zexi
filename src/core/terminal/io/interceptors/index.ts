import clearLineInterceptor from "./clearLine";
import clearScreenDown from "./clearScreenDown";
import cursorToInterceptor from "./cursorTo";
import moveCursorInterceptor from "./moveCursor";
import stderrWriteInterceptor from "./stderr.write";
import stdoutWriteInterceptor from "./stdout.write";

const interceptors = Object.freeze({
    stdoutWrite: stdoutWriteInterceptor,
    stderrWrite: stderrWriteInterceptor,
    cursorTo: cursorToInterceptor,
    clearLine: clearLineInterceptor,
    clearScreenDown: clearScreenDown,
    moveCursor: moveCursorInterceptor
});

export default interceptors;