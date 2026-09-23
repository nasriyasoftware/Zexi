import type { ProcessStderrWriter, ProcessStdoutWriter, WriteCallback, WriteRequest } from "../types";

const ZEXI_MANAGED_TERMINAL_CONTROLS = /\x1B\[(?:\d+G|\d+;\d+H|\d*[ABCD]|\d*K|\d*J)/g;

function suppressTerminalControls(output: string): string {
    return output.replace(ZEXI_MANAGED_TERMINAL_CONTROLS, '');
}

/**
 * Parses the arguments of a standard-stream `write()` operation into a
 * normalized write request.
 *
 * The parser supports the standard Node.js `write()` overloads:
 *
 * - `write(output)`
 * - `write(output, encoding)`
 * - `write(output, callback)`
 * - `write(output, encoding, callback)`
 *
 * String output is normalized by removing terminal-control sequences that
 * would interfere with Zexi's managed terminal state. Binary output is
 * preserved unchanged.
 *
 * The parser does not otherwise modify the supplied output.
 *
 * @param args - Arguments received by a standard-stream `write()` operation.
 *
 * @returns The normalized write request.
 *
 * @since 1.0.0
 */
function parseRequest(...args: Parameters<ProcessStdoutWriter | ProcessStderrWriter>): WriteRequest {
    const output = typeof args[0] === 'string'
        ? suppressTerminalControls(args[0])
        : args[0];

    const req: WriteRequest = { output };

    const arg2 = args[1];
    if (typeof arg2 === 'string') {
        req.encoding = arg2;
    } else if (typeof arg2 === 'function') {
        req.callback = arg2;
    }

    if (typeof args[2] === 'function') {
        req.callback = args[2] as WriteCallback;
    }

    return req;
}

export default parseRequest;