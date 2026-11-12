import terminalIO from "../../..";
import zexiTerminal from "../../../../zexi.terminal";
import parseRequest from "../../assets/write.request.parser";
import type { ProcessStderrWriter } from "../../types";

/**
 * Intercepts writes to the currently configured stderr stream.
 *
 * When interception is disabled, the write is passed to
 * `terminalIO.output.queue()`. The request is written through the captured
 * stderr method when the terminal is ready, or buffered until it becomes
 * ready.
 *
 * When interception is enabled, the output is normalized to text and
 * submitted to Zexi as a terminal entry. The original write callback is
 * invoked after the Zexi entry has completed or failed.
 *
 * If the Zexi entry cannot be created, the error and original output are
 * written directly through `terminalIO` using stderr so that the intercepted
 * output is not lost.
 *
 * @param args - Arguments received by the configured stderr stream's `write`
 * method.
 *
 * @returns The result of the original stderr writer when interception is
 * disabled and the terminal is ready, or `true` when the write is queued or
 * handled asynchronously by Zexi.
 *
 * @since 1.0.0
 */
const stderrWriteInterceptor: ProcessStderrWriter = (...args) => {
    const req = parseRequest(...args as Parameters<ProcessStderrWriter>);

    if (!terminalIO.output.interception.intercepting) {
        return terminalIO.output.queue(req.output, {
            callback: req.callback,
            encoding: req.encoding,
            isError: true
        });
    }

    const output = typeof req.output === 'string'
        ? req.output.replace(/(?:\r\n|\r|\n)+$/, '')
        : Buffer.from(req.output).toString(req.encoding);

    void zexiTerminal.createEntry({
        value: output,
        final: true
    }, {
        log: true,
        level: 'info'
    }).catch((err) => {
        terminalIO.output.write(`[Zexi] Failed to print entry: ${err.message}\n`, { isError: true });
        terminalIO.output.write(err.message, { isError: true });
        terminalIO.output.write(output, { isError: true });
    }).finally(() => {
        req.callback?.();
    });

    return true;
}

export default stderrWriteInterceptor;