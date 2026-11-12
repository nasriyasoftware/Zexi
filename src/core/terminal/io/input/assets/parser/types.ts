/**
 * Represents a normalized key input captured from the terminal's standard input.
 *
 * `TerminalKey` abstracts away the raw bytes and ANSI escape sequences produced
 * by different terminal environments and exposes them as semantic key events.
 *
 * @since 1.0.0
 */
export type TerminalKey =
    /**
     * A printable character entered by the user.
     *
     * @example
     * ```ts
     * { type: 'character', value: 'a' }
     * ```
     */
    | { type: 'character'; value: string }

    /**
     * A Control-key combination.
     *
     * The `value` contains the normalized letter associated with the
     * Control-key combination.
     *
     * @example
     * ```ts
     * { type: 'ctrl', value: 'c' }
     * ```
     */
    | { type: 'ctrl'; value: string }

    /** The Enter or Return key. */
    | { type: 'enter' }

    | { type: 'backspace' }
    | { type: 'escape' }
    | { type: 'left' }
    | { type: 'right' }
    | { type: 'up' }
    | { type: 'down' };
    
/**
 * Receives one normalized key emitted by the key input parser.
 *
 * This handler connects parser output to a key-input session. It receives
 * only the parsed key; the session supplies its release function when it
 * calls the consumer.
 *
 * ```ts
 * parser.onKeyInput(key => {
 *     if (key.type === 'enter') {
 *         // The parser reports the key; it does not decide what Enter does.
 *     }
 * });
 * ```
 *
 * @param key - The parsed terminal key.
 * @returns `void`
 * @since 1.0.0
 */
export type StdinKeyInputHandler = (key: TerminalKey) => void;