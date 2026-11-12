import type { TerminalKey, StdinKeyInputHandler } from "./types";

/**
 * Parses raw stdin chunks into normalized {@link TerminalKey} values.
 *
 * `KeyInputParser` is the parsing layer of the terminal input system. It
 * accepts raw {@link Buffer} chunks from its owning stdin session, converts
 * their characters into semantic key values, and forwards those values to one
 * registered callback.
 *
 * This class does not read from or control `process.stdin`. The shared stdin
 * controller owns the stream, serializes access between sessions, and routes
 * chunks to the handler belonging to the active session. A `KeyInputSession`
 * connects that raw-chunk handler to this parser and forwards parsed keys to
 * its consumer.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES AND SCOPE
 * ---------------------------------------------------------------------
 *
 * The parser is responsible for:
 *
 * 1. buffering characters needed to complete a key or escape sequence;
 * 2. translating supported terminal input into {@link TerminalKey} values;
 * 3. sending parsed keys to its registered callback in input order.
 *
 * It does **not**:
 *
 * - acquire, queue, release, or cancel stdin sessions;
 * - attach or remove stdin listeners, or change raw/flowing mode;
 * - accumulate or edit a user's complete input value;
 * - render input, mask passwords, or manage terminal entries;
 * - validate input or decide what Enter, Escape, or other keys should do.
 *
 * The controller owns stdin and session scheduling. The consumer owns the
 * interaction state and decides what each parsed key means.
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT FLOW
 * ---------------------------------------------------------------------
 *
 * The parser participates in this flow:
 *
 * ```text
 * process.stdin
 *      │ raw Buffer chunks
 *      ▼
 * StdinController
 *      │ routes chunks to the active session
 *      ▼
 * KeyInputParser
 *      │ normalized TerminalKey values
 *      ▼
 * KeyInputSession
 *      │
 *      ▼
 * Consumer
 * ```
 *
 * Construction does not acquire stdin, enable raw mode, or begin input
 * reception. Once the controller grants a session, it supplies the raw chunks
 * through {@link dataParser}. The consumer registers for parsed keys through
 * {@link onKeyInput}.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFERING AND CHUNK BOUNDARIES
 * ---------------------------------------------------------------------
 *
 * A stdin data chunk does not necessarily correspond to one keyboard action.
 * A chunk may contain several printable characters, one or more complete
 * escape sequences, multiple keys concatenated together, or only part of a
 * multi-character sequence.
 *
 * The parser decodes each chunk and appends its characters to an internal
 * buffer. It consumes that buffer incrementally, retaining characters while
 * it waits briefly to determine whether an Escape character begins a supported
 * sequence.
 *
 * This is a parsing buffer, not an accumulated line or prompt value. A
 * consumer that needs editable text must build and maintain it from the
 * emitted keys.
 *
 * Releasing or canceling a session prevents the controller from routing
 * subsequent chunks to it, but does not interrupt parsing already underway.
 * Remaining keys in a chunk already delivered to this parser may still be
 * sent to its callback.
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED INPUT
 * ---------------------------------------------------------------------
 *
 * The parser recognizes ordinary characters, carriage return or line feed as
 * Enter, Backspace (`BS` or `DEL`), control characters not handled as Enter or
 * Backspace, standalone Escape, and the four arrow keys encoded as CSI
 * sequences.
 *
 * The arrow-key sequences are:
 *
 * ```text
 * ESC [ A   // Up
 * ESC [ B   // Down
 * ESC [ C   // Right
 * ESC [ D   // Left
 * ```
 *
 * Control keys are emitted with a lowercase letter value. For example, Ctrl+C
 * produces `{ type: 'ctrl', value: 'c' }`.
 *
 * ---------------------------------------------------------------------
 * 🔷 ESCAPE-SEQUENCE DISAMBIGUATION
 * ---------------------------------------------------------------------
 *
 * A standalone Escape key and an ANSI/CSI sequence both begin with `ESC`.
 * When the parser encounters `ESC`, it waits up to 50 milliseconds for a
 * continuation:
 *
 * - No continuation is treated as the Escape key.
 * - A continuation other than `[` is treated as the Escape key.
 * - After `[`, the parser waits up to another 50 milliseconds for a command.
 * - `A`, `B`, `C`, and `D` identify the four arrow keys.
 * - A missing or unsupported command is reported as the Escape key.
 *
 * Characters consumed while examining a non-CSI or unsupported sequence are
 * not emitted separately.
 *
 * ---------------------------------------------------------------------
 * 🔷 KEY CALLBACK
 * ---------------------------------------------------------------------
 *
 * Register one callback with {@link onKeyInput} to receive parsed keys:
 *
 * ```ts
 * parser.onKeyInput(key => {
 *     if (key.type === 'character') {
 *         // Update the consumer's own input state.
 *     }
 * });
 * ```
 *
 * The parser stores a single callback rather than an event-listener
 * collection. Registering another callback replaces the previous one.
 * Callback execution is synchronous when a key is dispatched; the parser does
 * not await a promise returned by consumer code.
 *
 * ---------------------------------------------------------------------
 * 🔷 ASYNCHRONOUS PARSING
 * ---------------------------------------------------------------------
 *
 * Parsing is asynchronous because an Escape sequence cannot always be
 * identified from the first character. While the parser waits for a
 * continuation character, newly received chunks are appended to the same
 * buffer and processed when the current parsing step resumes. Only one buffer
 * processing loop runs at a time.
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL WAITERS
 * ---------------------------------------------------------------------
 *
 * The parser uses internal waiters when it needs to obtain a specific character
 * from the stdin buffer.
 *
 * There are two kinds of internal waiters:
 *
 * - key waiters, which wait for a complete {@link TerminalKey}
 * - character waiters, which wait for a single raw character
 *
 * Character waiters are primarily used while parsing escape sequences.
 *
 * These mechanisms are internal implementation details and are not intended
 * for consumers of the class. Consumers should use {@link onKeyInput}
 * instead.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFER LIFETIME
 * ---------------------------------------------------------------------
 *
 * The parser has no start, stop, or reset operation. Its buffer is not
 * automatically cleared when the stdin session ends; only this parser's
 * owner supplies chunks while its session is active. Each key-input session
 * creates a fresh parser.
 *
 * @internal
 * @since 1.0.0
 */
class KeyInputParser {
    #_buffer = '';
    #_onInput?: StdinKeyInputHandler;

    /**
     * Internal queue of consumers waiting for a parsed terminal key.
     *
     * `readKey()` stores a resolver here when no complete key is already
     * buffered. The processing loop resolves the oldest waiter before sending
     * that key to the registered callback.
     *
     * @internal
     * @since 1.0.0
     */
    #_keyWaiters: ((key: TerminalKey) => void)[] = [];

    /**
     * Internal queue of consumers waiting for an individual raw character.
     *
     * This is primarily used when parsing ANSI escape sequences, where the
     * parser must inspect characters one at a time.
     *
     * @internal
     * @since 1.0.0
     */
    #_characterWaiters: ((value: string) => void)[] = [];

    /**
     * Internal state flags.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_flags = {
        /**
         * Indicates that the character buffer is currently being processed.
         *
         * This prevents multiple incoming chunks from starting concurrent
         * parser loops while an escape sequence is awaiting more characters.
         *
         * @since 1.0.0
         */
        processing: false,
    }

    readonly #_helpers = {
        /**
         * Reads the next complete terminal key from the input buffer.
         *
         * If a complete key is already available, it is returned immediately.
         * Otherwise, a waiter is registered and resolved when the parser
         * produces the next key.
         *
         * @internal
         * @since 1.0.0
         */
        readKey: async (): Promise<TerminalKey> => {
            const key = await this.#_helpers.readBufferedKey();

            if (key) {
                return key;
            }

            return new Promise(resolve => {
                this.#_keyWaiters.push(resolve);
            });
        },

        /**
         * Reads a single raw character from the input buffer.
         *
         * Unlike {@link readKey}, this method does not parse the character into
         * a {@link TerminalKey}.
         *
         * If no character is currently available, the method waits until one
         * arrives or until the supplied timeout expires.
         *
         * This is primarily required when parsing multi-character ANSI escape
         * sequences.
         *
         * @param timeout - Maximum amount of time to wait, in milliseconds.
         * @returns The next raw character, or `undefined` if the timeout expires.
         *
         * @internal
         * @since 1.0.0
         */
        readNextCharacter: (timeout: number): Promise<string | undefined> => {
            if (this.#_buffer.length > 0) {
                const value = this.#_buffer[0];
                this.#_buffer = this.#_buffer.slice(1);

                return Promise.resolve(value);
            }

            return new Promise(resolve => {
                const timer = setTimeout(() => {
                    const index = this.#_characterWaiters.indexOf(resolve);

                    if (index !== -1) {
                        this.#_characterWaiters.splice(index, 1);
                    }

                    resolve(undefined);
                }, timeout);

                this.#_characterWaiters.push(value => {
                    clearTimeout(timer);
                    resolve(value);
                });
            });
        },

        /**
         * Removes a specified number of characters from the input buffer and
         * returns the supplied parsed key.
         *
         * This helper keeps buffer consumption and key creation together for
         * simple single-character input cases.
         *
         * @internal
         * @since 1.0.0
         */
        consume: <T extends TerminalKey>(
            length: number,
            key: T
        ): T => {
            this.#_buffer = this.#_buffer.slice(length);
            return key;
        },

        /**
         * Parses an Escape character and determines whether it represents the
         * Escape key itself or the beginning of a supported ANSI/CSI sequence.
         *
         * A standalone Escape key consists only of the `ESC` character.
         *
         * Arrow keys are commonly transmitted as:
         *
         * ```text
         * ESC [ A   // Up
         * ESC [ B   // Down
         * ESC [ C   // Right
         * ESC [ D   // Left
         * ```
         *
         * Because the initial `ESC` character is identical in both cases, the
         * parser waits briefly for the next character.
         *
         * If no continuation arrives, the input is treated as the Escape key.
         *
         * If an unsupported sequence is encountered, the input currently falls
         * back to the Escape key representation.
         *
         * @returns The parsed terminal key.
         *
         * @internal
         * @since 1.0.0
         */
        readEscapeSequence: async (): Promise<TerminalKey> => {
            // Consume ESC.
            this.#_buffer = this.#_buffer.slice(1);

            // Wait briefly to determine whether this is an escape sequence.
            const sequence =
                await this.#_helpers.readNextCharacter(50);

            // No continuation means this was the Escape key.
            if (sequence === undefined) {
                return { type: 'escape' };
            }

            // We only currently support CSI sequences.
            if (sequence !== '[') {
                return { type: 'escape' };
            }

            const command = await this.#_helpers.readNextCharacter(50);

            if (command === undefined) {
                return { type: 'escape' };
            }

            switch (command) {
                case 'A':
                    return { type: 'up' };

                case 'B':
                    return { type: 'down' };

                case 'C':
                    return { type: 'right' };

                case 'D':
                    return { type: 'left' };

                default:
                    return { type: 'escape' };
            }
        },

        /**
         * Attempts to parse one complete {@link TerminalKey} from the current
         * input buffer.
         *
         * If the buffer does not contain enough information to determine a
         * complete key, `undefined` is returned.
         *
         * Escape sequences are handled asynchronously because the parser may
         * need to wait for additional characters.
         *
         * @returns A parsed terminal key, or `undefined` when no complete key
         * can currently be produced.
         *
         * @internal
         * @since 1.0.0
         */
        readBufferedKey: async (): Promise<TerminalKey | undefined> => {
            if (this.#_buffer.length === 0) {
                return;
            }

            const char = this.#_buffer[0];

            // Enter
            if (char === '\r' || char === '\n') {
                return this.#_helpers.consume(1, {
                    type: 'enter'
                });
            }

            // Backspace
            if (char === '\x08' || char === '\x7f') {
                return this.#_helpers.consume(1, {
                    type: 'backspace'
                });
            }

            // Escape / ANSI sequence
            if (char === '\x1b') {
                return this.#_helpers.readEscapeSequence();
            }

            // Control character
            const code = char.charCodeAt(0);

            if (code >= 0x01 && code <= 0x1a) {
                this.#_buffer = this.#_buffer.slice(1);

                return {
                    type: 'ctrl',
                    value: String.fromCharCode(code + 0x40).toLowerCase()
                };
            }

            // Ordinary character
            this.#_buffer = this.#_buffer.slice(1);

            return {
                type: 'character',
                value: char
            };
        }
    };

    /**
     * Receives a raw stdin chunk routed by the active session's controller.
     *
     * The chunk is decoded, appended to the internal character buffer, and
     * processed asynchronously. This callback does not attach a stdin
     * listener or change the stream's state.
     *
     * @param chunk - Raw bytes from the active stdin session.
     * @returns `void`
     * @internal
     * @since 1.0.0
     */
    dataParser = (chunk: Buffer) => {
        this.#_buffer += chunk.toString();
        void this.#_process();
    }

    /**
     * Processes buffered stdin data and forwards parsed keys to the registered
     * input handler.
     *
     * Only one processing loop may run at a time. Additional chunks may
     * arrive while an earlier key is being parsed, particularly when an
     * Escape sequence requires the parser to wait for continuation
     * characters.
     *
     * @internal
     * @since 1.0.0
     */
    async #_process(): Promise<void> {
        if (this.#_flags.processing) {
            return;
        }

        this.#_flags.processing = true;

        try {
            while (this.#_buffer.length > 0) {
                /*
                 * If something is waiting for a raw character, give it the
                 * next character before parsing it as a TerminalKey.
                 *
                 * This is primarily used while resolving an ESC sequence.
                 */
                const characterWaiter = this.#_characterWaiters.shift();

                if (characterWaiter) {
                    const value = this.#_buffer[0];

                    this.#_buffer = this.#_buffer.slice(1);
                    characterWaiter(value);

                    continue;
                }

                const key = await this.#_helpers.readBufferedKey();

                if (!key) {
                    return;
                }

                const keyWaiter = this.#_keyWaiters.shift();

                if (keyWaiter) {
                    keyWaiter(key);
                    continue;
                }

                this.#_onInput?.(key);
            }
        } finally {
            this.#_flags.processing = false;
        }
    }

    /**
     * Registers the callback that receives parsed terminal keys.
     *
     * The callback receives each recognized {@link TerminalKey} as the parser
     * consumes buffered input. Registering another callback replaces the
     * previous one. The callback is not invoked until chunks are supplied
     * through {@link dataParser}.
     *
     * @param handler - Receives each parsed key.
     * @since 1.0.0
     */
    onKeyInput(handler: StdinKeyInputHandler) {
        this.#_onInput = handler;
    }
}

export default KeyInputParser;