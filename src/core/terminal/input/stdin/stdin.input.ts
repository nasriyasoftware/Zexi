import type { StdinInputHandler, TerminalKey } from "./types";

/**
 * Captures and parses keyboard input received from `process.stdin`.
 *
 * `StdinInput` is the low-level input layer used by Zexi's interactive terminal
 * features. It is responsible only for receiving data from the process's
 * standard input stream and translating that data into normalized
 * {@link TerminalKey} values.
 *
 * It does **not** decide what the input means.
 *
 * For example, when the user presses:
 *
 * - `A` → emits `{ type: 'character', value: 'A' }`
 * - `Backspace` → emits `{ type: 'backspace' }`
 * - `Enter` → emits `{ type: 'enter' }`
 * - `Escape` → emits `{ type: 'escape' }`
 * - `Ctrl+C` → emits `{ type: 'ctrl', value: 'c' }`
 * - `ArrowUp` → emits `{ type: 'up' }`
 *
 * Higher-level components are responsible for deciding how those keys should
 * affect the current interaction. For example, {@link StdinCapture} uses
 * character keys to build an input value, interprets Backspace as deletion,
 * Enter as submission, and Escape according to its configured escape behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * The input capturer is **inactive by default**. Constructing an instance does
 * not modify `process.stdin`, enable raw mode, or begin receiving input.
 *
 * Input reception begins only after {@link start} is called:
 *
 * ```ts
 * stdinInput.start();
 * ```
 *
 * While active, the instance:
 *
 * 1. enables raw mode when supported by the current stdin implementation
 * 2. configures stdin to emit UTF-8 strings
 * 3. resumes the stdin stream
 * 4. listens for `data` events
 * 5. buffers incoming data
 * 6. parses the buffered data into {@link TerminalKey} values
 * 7. forwards parsed keys to the registered {@link onInput} handler
 *
 * Input reception can be stopped with:
 *
 * ```ts
 * stdinInput.stop();
 * ```
 *
 * Stopping the capturer pauses stdin, removes its `data` listener, disables
 * raw mode when supported, and clears any buffered input.
 *
 * Starting or stopping the capturer is idempotent. Calling {@link start} while
 * the capturer is already active has no effect, and calling {@link stop} while
 * it is inactive has no effect.
 *
 * ---------------------------------------------------------------------
 * 🔷 WHY RAW MODE IS USED
 * ---------------------------------------------------------------------
 *
 * Interactive terminal input normally operates in line-buffered mode, where
 * the terminal waits for the user to press Enter before delivering the input
 * to the process.
 *
 * Zexi's interactive features need individual keystrokes instead. For example,
 * a prompt must be able to react immediately when the user presses Backspace
 * or an arrow key without waiting for Enter.
 *
 * Therefore, when possible, `StdinInput` enables stdin raw mode while it is
 * active.
 *
 * Raw mode causes terminal input to be delivered as individual characters and
 * control sequences rather than as complete lines. Those characters are then
 * interpreted by this class and converted into {@link TerminalKey} values.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFERING
 * ---------------------------------------------------------------------
 *
 * Data received from stdin does not necessarily correspond to one keyboard
 * action.
 *
 * A single `data` event may contain:
 *
 * ```text
 * abc
 * ```
 *
 * or an ANSI escape sequence such as:
 *
 * ```text
 * ESC [ A
 * ```
 *
 * or several input events concatenated together.
 *
 * For this reason, incoming stdin data is first appended to an internal
 * character buffer.
 *
 * The buffer is then consumed incrementally by the parser.
 *
 * This also allows the parser to temporarily wait for additional characters
 * when processing multi-character terminal sequences.
 *
 * ---------------------------------------------------------------------
 * 🔷 KEY PARSING
 * ---------------------------------------------------------------------
 *
 * The parser converts the raw characters received from stdin into the
 * normalized {@link TerminalKey} union.
 *
 * Supported input includes:
 *
 * - ordinary characters
 * - Enter
 * - Backspace
 * - Escape
 * - Left arrow
 * - Right arrow
 * - Up arrow
 * - Down arrow
 * - control characters such as Ctrl+C
 *
 * Arrow keys are transmitted by terminals as ANSI/CSI escape sequences.
 * For example, the Up arrow is typically received as:
 *
 * ```text
 * ESC [ A
 * ```
 *
 * `StdinInput` recognizes the supported CSI sequences and converts them into
 * their corresponding key objects.
 *
 * A standalone `ESC` is distinguished from an ANSI escape sequence by briefly
 * waiting for a continuation character. If no continuation arrives within
 * the parser's timeout, the input is interpreted as the Escape key.
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT CALLBACK
 * ---------------------------------------------------------------------
 *
 * `StdinInput` exposes a single input callback through {@link onInput}.
 *
 * The callback receives already-parsed {@link TerminalKey} values:
 *
 * ```ts
 * stdinInput.onInput(key => {
 *     if (key.type === 'character') {
 *         console.log(key.value);
 *     }
 * });
 * ```
 *
 * The callback is intentionally singular rather than an event emitter.
 *
 * `StdinInput` is a low-level input source and is designed to have one
 * coordinating consumer: the stdin session manager. The session manager
 * determines which higher-level interaction currently owns stdin and forwards
 * the parsed key to that interaction.
 *
 * Higher-level APIs should therefore not compete directly for the stdin
 * callback.
 *
 * Registering another callback replaces the previously registered callback.
 *
 * ---------------------------------------------------------------------
 * 🔷 SESSION OWNERSHIP
 * ---------------------------------------------------------------------
 *
 * `StdinInput` itself does not manage which prompt or interactive operation
 * currently owns stdin.
 *
 * That responsibility belongs to the higher-level stdin session management
 * layer.
 *
 * Conceptually, the input flow is:
 *
 * ```text
 * process.stdin
 *      │
 *      ▼
 *  StdinInput
 *      │
 *      │ TerminalKey
 *      ▼
 * Stdin Session Manager
 *      │
 *      │ routes input to the active session
 *      ▼
 * StdinCapture / interactive consumer
 * ```
 *
 * This separation is important because multiple prompts may be created without
 * awaiting each other. The session manager serializes access to stdin so that
 * only one interactive operation receives input at a time.
 *
 * `StdinInput` therefore knows nothing about prompts, validation, passwords,
 * cancellation, or terminal entries.
 *
 * ---------------------------------------------------------------------
 * 🔷 ASYNCHRONOUS PARSING
 * ---------------------------------------------------------------------
 *
 * Parsing is asynchronous because some terminal input sequences cannot be
 * identified from a single character.
 *
 * In particular, `ESC` can represent either:
 *
 * - the Escape key itself, or
 * - the beginning of an ANSI escape sequence.
 *
 * When an `ESC` character is encountered, the parser briefly waits for the
 * next character to determine whether the sequence continues.
 *
 * This means that the internal parser may temporarily suspend while stdin
 * continues to provide data. Incoming data remains buffered and is processed
 * once the parser continues.
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
 * for consumers of the class. Consumers should use {@link onInput} instead.
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFER DISPOSAL
 * ---------------------------------------------------------------------
 *
 * Calling {@link stop} clears the internal input buffer.
 *
 * This is intentional: input captured while the input layer is inactive must
 * not leak into a later interactive operation.
 *
 * For example, if a user presses keys while a prompt is being torn down, those
 * characters must not unexpectedly become the initial value of the next prompt.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * `StdinInput` is intentionally limited to four responsibilities:
 *
 * 1. controlling whether stdin input is currently being received
 * 2. buffering raw stdin data
 * 3. translating raw terminal input into {@link TerminalKey} values
 * 4. forwarding parsed keys to its registered input handler
 *
 * It deliberately does **not**:
 *
 * - maintain a prompt's input value
 * - render input to the terminal
 * - validate user input
 * - decide whether Enter submits an interaction
 * - decide what Escape means
 * - manage multiple interactive consumers
 * - determine which prompt owns stdin
 *
 * Those responsibilities belong to higher layers of Zexi's terminal input
 * architecture.
 *
 * @internal
 * @since 1.0.0
 */
class StdinInput {
    #_buffer = '';
    #_onInput?: StdinInputHandler;

    /**
     * Internal queue of consumers waiting for a parsed terminal key.
     *
     * These waiters are used by the parser itself and are not exposed as part
     * of the public input-capture API.
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
         * Indicates that the input buffer is currently being processed.
         *
         * This prevents multiple stdin `data` events from starting concurrent
         * parser loops.
         * 
         * @since 1.0.0
         */
        processing: false,

        /**
         * Indicates that this instance is currently receiving stdin data.
         * @since 1.0.0
         */
        receiving: false
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
     * Controls the connection between this input layer and `process.stdin`.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_controller = {
        /**
         * Handles a raw stdin `data` event.
         *
         * Incoming data is appended to the internal buffer and processing is
         * scheduled asynchronously.
         *
         * @internal
         * @since 1.0.0
         */
        onData: (chunk: string) => {
            this.#_buffer += chunk;
            void this.#_process();
        },
        
        /**
         * Starts receiving and processing stdin input.
         *
         * This method is idempotent. If input is already being received, the
         * call is ignored.
         *
         * @internal
         * @since 1.0.0
         */
        start: () => {
            if (this.#_flags.receiving) {
                return;
            }

            this.#_flags.receiving = true;

            process.stdin.setRawMode?.(true);
            process.stdin.setEncoding('utf8');
            process.stdin.resume();

            process.stdin.on('data', this.#_controller.onData);
        },

        /**
         * Stops receiving stdin input.
         *
         * This method is idempotent. If input is not currently being received,
         * the call is ignored.
         *
         * Stopping also clears the buffered input so that characters received
         * during one interaction cannot accidentally become input for a later
         * interaction.
         *
         * @internal
         * @since 1.0.0
         */
        stop: () => {
            if (!this.#_flags.receiving) {
                return;
            }

            this.#_flags.receiving = false;

            process.stdin.pause();
            process.stdin.off('data', this.#_controller.onData);
            process.stdin.setRawMode?.(false);

            this.#_buffer = '';
        }
    }

    /**
     * Processes buffered stdin data and forwards parsed keys to the registered
     * input handler.
     *
     * Only one processing loop may run at a time. This is necessary because
     * stdin can emit multiple `data` events while an earlier event is still
     * being parsed, particularly when an ANSI escape sequence requires the
     * parser to wait for additional characters.
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
     * Indicates whether this input capturer is currently receiving input from
     * `process.stdin`.
     *
     * `true` means that stdin is currently connected to this instance and raw
     * input processing is enabled.
     *
     * `false` means that this instance is inactive and is not listening for
     * stdin data.
     * 
     * @returns `true` if this capturer is active, `false` otherwise
     * @since 1.0.0
     */
    get isActive() { return this.#_flags.receiving; }

    /**
     * Starts capturing keyboard input from `process.stdin`.
     *
     * Once started, incoming stdin data is parsed into {@link TerminalKey}
     * values and delivered to the callback registered with {@link onInput}.
     *
     * Starting an already-active input capturer has no effect.
     *
     * The input layer is normally controlled by Zexi's stdin session manager
     * rather than directly by public terminal APIs.
     * 
     * @returns `void`
     * @since 1.0.0
     */
    start(): void {
        this.#_controller.start();
    }

    /**
     * Stops capturing keyboard input from `process.stdin`.
     *
     * Stopping the input layer pauses stdin, removes the input listener,
     * disables raw mode when supported, and clears any currently buffered
     * input.
     *
     * Stopping an already-inactive input capturer has no effect.
     *
     * The input layer is normally controlled by Zexi's stdin session manager
     * rather than directly by public terminal APIs.
     * 
     * @returns `void`
     * @since 1.0.0
     */
    stop(): void {
        this.#_controller.stop();
    }

    /**
     * Registers the callback that receives parsed terminal input.
     *
     * The callback receives one {@link TerminalKey} for each recognized
     * keyboard action.
     *
     * ```ts
     * stdinInput.onInput(key => {
     *     switch (key.type) {
     *         case 'character':
     *             console.log('Character:', key.value);
     *             break;
     *
     *         case 'backspace':
     *             console.log('Backspace');
     *             break;
     *
     *         case 'enter':
     *             console.log('Enter');
     *             break;
     *
     *         case 'escape':
     *             console.log('Escape');
     *             break;
     *     }
     * });
     * ```
     *
     * Only one callback is stored. Registering a new callback replaces the
     * previously registered callback.
     *
     * The callback is invoked only after the raw stdin data has been parsed.
     * Consumers therefore do not need to understand terminal-specific byte
     * sequences such as `ESC [ A` for the Up arrow.
     *
     * This method is primarily intended for the stdin session-management layer.
     * Higher-level interactive APIs should normally consume input through a
     * managed stdin session instead of registering directly with this class.
     *
     * @param cb - Callback invoked for each parsed terminal key.
     * @throws {TypeError} If `cb` is not a function.
     * 
     * @returns `void`
     * @since 1.0.0
     */
    onInput(cb: StdinInputHandler): void {
        if (typeof cb !== 'function') {
            throw new TypeError(`Expected \`cb\` to be a function, received \`${typeof cb}\``);
        }

        this.#_onInput = cb;
    }
}

const stdinInput = new StdinInput();
export default stdinInput;