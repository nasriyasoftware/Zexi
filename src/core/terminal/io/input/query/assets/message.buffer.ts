/**
 * Accumulates terminal input chunks as text so a response can be parsed even
 * when the terminal splits it across multiple `stdin` data events.
 *
 * Terminal query responses are byte sequences delivered through Node's input
 * stream. A response may arrive in one chunk, several chunks, or alongside
 * unrelated input. `MessageBuffer` provides the small set of string operations
 * used by query dispatchers without making assumptions about those chunk
 * boundaries.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFERING MODEL
 * ---------------------------------------------------------------------
 *
 * The buffer stores decoded text, not the original `Buffer` objects. Calling
 * {@link append} with a `Buffer` decodes that chunk as UTF-8 before appending
 * it; calling it with a string appends the string directly. The buffer has no
 * built-in maximum size. A dispatcher that wants bounded retention must trim
 * it explicitly, as the terminal query dispatchers do when a response has not
 * matched yet.
 *
 * Each Buffer is decoded independently. This is suitable for the ASCII
 * control sequences parsed by the current dispatchers, but this class is not a
 * streaming UTF-8 decoder and does not preserve a multibyte character whose
 * encoded bytes are split between chunks.
 *
 * The buffer is intentionally a string accumulator rather than a terminal
 * protocol parser. It does not identify response boundaries, validate escape
 * sequences, or discard unrelated input on its own. Those decisions belong to
 * the caller that uses {@link match}, {@link splice}, and {@link clear}.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPICAL RESPONSE PARSING
 * ---------------------------------------------------------------------
 *
 * A dispatcher can append each input chunk, search the accumulated text for a
 * response pattern, and retain a short suffix if the pattern is incomplete:
 *
 * ```ts
 * buffer.append(data);
 * const response = buffer.match(/\x1b\[(\d+);(\d+)R/);
 *
 * if (response) {
 *     buffer.clear();
 *     resolve({ row: Number(response[1]), column: Number(response[2]) });
 * } else {
 *     buffer.splice(-64);
 * }
 * ```
 *
 * This is useful when an ANSI response begins near the end of one input chunk
 * and finishes in a later chunk. Trimming remains the dispatcher's
 * responsibility because the correct retention limit depends on the pattern
 * being recognized.
 *
 * @internal Used by terminal query dispatchers to assemble streamed response
 * text before matching it.
 * @since 1.0.0
 */
class MessageBuffer {
    /**
     * Accumulated UTF-8 text received for the current parser's lifetime.
     *
     * The buffer is private so callers use the explicit append, search, trim,
     * reset, and conversion operations below. It is not automatically reset
     * when a query times out; a dispatcher decides when its parser state is no
     * longer useful.
     *
     * @since 1.0.0
     */
    #_buffer: string = '';

    /**
     * Appends a string or UTF-8 input chunk to the accumulated message.
     *
     * `Buffer` values are decoded with `Buffer.toString('utf8')` before they
     * are appended. Strings are appended as-is. No delimiter is inserted, so
     * chunk boundaries do not appear in the resulting text.
     *
     * @param data - Text or bytes from a terminal input event.
     *
     * @since 1.0.0
     */
    append(data: string | Buffer) {
        if (Buffer.isBuffer(data)) {
            data = data.toString('utf8');
        }

        this.#_buffer += data;
    }

    /**
     * Replaces the accumulated text with the result of `String.prototype.slice`.
     *
     * Despite its name, this is not `Array.prototype.splice`: it removes no
     * range in place and accepts the same start/end indexes as
     * `String.prototype.slice`. In particular, a negative start index counts
     * backward from the end. Query dispatchers use a call such as
     * `splice(-64)` to retain only the last 64 UTF-16 code units while waiting
     * for a response that may span input chunks.
     *
     * @param args - The start index and optional end index accepted by
     * `String.prototype.slice`.
     *
     * @since 1.0.0
     */
    splice(...args: Parameters<String['slice']>) {
        this.#_buffer = this.#_buffer.slice(...args);
    }

    /**
     * Discards all accumulated text.
     *
     * A parser normally calls this after finding the complete response it is
     * responsible for. The operation only resets this buffer; it does not
     * affect terminal input, listeners, or query-dispatcher state.
     *
     * @since 1.0.0
     */
    clear() {
        this.#_buffer = '';
    }

    /**
     * Searches the accumulated text using `String.prototype.match`.
     *
     * The matching rules and return value are exactly those of the native
     * string method. For example, a regular expression without the global
     * flag returns a `RegExpMatchArray` when it matches and `null` otherwise.
     * Searching does not consume or modify the buffer.
     *
     * @param args - The pattern or regular expression accepted by
     * `String.prototype.match`.
     * @returns The native string-match result.
     *
     * @since 1.0.0
     */
    match(...args: Parameters<String['match']>) {
        return this.#_buffer.match(...args);
    }

    /**
     * Returns all currently accumulated text without changing the buffer.
     *
     * @returns The current message text.
     *
     * @since 1.0.0
     */
    toString() {
        return this.#_buffer;
    }
}

export default MessageBuffer;