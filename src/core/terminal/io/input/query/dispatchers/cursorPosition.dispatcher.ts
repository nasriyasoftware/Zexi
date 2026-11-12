import QueryDispatcher from "../assets/dispatcher";
import MessageBuffer from "../assets/message.buffer";
import type { CursorPosition } from "../types";

/**
 * Queries the terminal for its current cursor row and column using the ANSI
 * cursor-position request/response sequence.
 *
 * The dispatcher sends `ESC [ 6 n` and recognizes a response in the form
 * `ESC [ row ; column R`. The returned position is a frozen object with
 * numeric `row` and `column` properties.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE ASSEMBLY
 * ---------------------------------------------------------------------
 *
 * A terminal may split the response across multiple stdin `data` events. The
 * dispatcher therefore keeps a private {@link MessageBuffer} for its
 * lifetime, appends each chunk, and searches the accumulated text for the
 * cursor report. When a match is found, the buffer is cleared and the active
 * request resolves. When no match is present yet, only the final 64 UTF-16
 * code units are retained so a partial response can be completed by a later
 * chunk without allowing unmatched input to grow without bound.
 *
 * The first matching report is accepted, and its decimal row and column
 * captures are converted with `Number()`. The parser does not validate that
 * the coordinates are positive or within the terminal's current dimensions.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT AND TERMINAL REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The optional constructor timeout is passed to {@link QueryDispatcher}.
 * When omitted or `undefined`, this dispatcher uses `500` milliseconds. A
 * query requires stdin to be attached to a TTY; otherwise `dispatch()` throws
 * synchronously with a descriptive error. Raw-mode setup, timeout handling,
 * listener removal, and cleanup are provided by the shared dispatcher.
 *
 * @example
 * ```ts
 * const position = await new CursorPositionDispatcher().dispatch();
 * // position is a frozen { row, column } value.
 * ```
 *
 * @internal Used by the terminal query manager to read the active cursor
 * position.
 * @since 1.0.0
 */
class CursorPositionDispatcher extends QueryDispatcher<Readonly<CursorPosition>> {
    /**
     * Creates a cursor-position query dispatcher.
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
            query: '\x1b[6n',
            description: 'query cursor position',
            timeout: timeout ?? 500,
            handler: (data, resolve) => {
                buffer.append(data);
                const match = buffer.match(/\x1b\[(\d+);(\d+)R/);

                if (match) {
                    buffer.clear();
                    return resolve(Object.freeze({
                        row: Number(match[1]),
                        column: Number(match[2])
                    }));
                }

                buffer.splice(-64);
            }
        })
    }
}

export default CursorPositionDispatcher;