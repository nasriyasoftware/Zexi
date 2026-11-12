import QueryDispatcher from "../assets/dispatcher";
import MessageBuffer from "../assets/message.buffer";
import type { TerminalSize } from "../types";

/**
 * Queries the terminal for its current height and width using the ANSI window
 * size request/response sequence.
 *
 * The dispatcher sends `ESC [ 18 t` and recognizes a response in the form
 * `ESC [ 8 ; height ; width t`. The returned dimensions are represented as a
 * frozen object whose `height` and `width` values are numbers.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE ASSEMBLY
 * ---------------------------------------------------------------------
 *
 * Terminal input is streamed and the response may span multiple `data`
 * events. This dispatcher keeps a private {@link MessageBuffer} for its
 * lifetime, appends each chunk, and searches the accumulated text for the
 * window-size response. On a match, it clears the accumulated text and
 * resolves the active request. If there is no match yet, it keeps only the
 * final 64 UTF-16 code units so a partial escape sequence can be completed by
 * a later chunk without unbounded accumulation.
 *
 * The parser accepts the first matching response and converts both captured
 * decimal fields with `Number()`. It does not validate the values against
 * terminal-specific dimension limits.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT AND TERMINAL REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The optional constructor timeout is passed to {@link QueryDispatcher}.
 * When omitted or `undefined`, this dispatcher uses `500` milliseconds. A
 * query requires stdin to be attached to a TTY; otherwise `dispatch()` throws
 * synchronously with a descriptive error. The shared dispatcher handles raw
 * input mode, timeout, listener removal, and cleanup.
 *
 * @example
 * ```ts
 * const size = await new TerminalSizeDispatcher().dispatch();
 * // size is a frozen { height, width } value.
 * ```
 *
 * @internal Used by the terminal query manager to read the active terminal's
 * dimensions.
 * @since 1.0.0
 */
class TerminalSizeDispatcher extends QueryDispatcher<Readonly<TerminalSize>> {
    /**
     * Creates a terminal-size query dispatcher.
     *
     * @param timeout - Maximum response wait in milliseconds. Defaults to
     * `500` when omitted or `undefined`; the base dispatcher validates an
     * explicitly supplied value.
     *
     * @since 1.0.0
     */
    constructor(timeout?: number) {
        const buffer = new MessageBuffer();
        super({
            query: '\x1b[18t',
            description: 'query terminal size',
            timeout: timeout ?? 500,
            handler: (data, resolve) => {
                buffer.append(data);
                const match = buffer.match(/\x1b\[8;(\d+);(\d+)t/);

                if (match) {
                    buffer.clear();
                    return resolve(Object.freeze({
                        height: Number(match[1]),
                        width: Number(match[2])
                    }))
                }

                buffer.splice(-64);
            }
        });
    }
}

export default TerminalSizeDispatcher;