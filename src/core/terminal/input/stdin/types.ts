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
 * Handles a normalized key captured from standard input.
 *
 * @param key - The normalized terminal key that was captured.
 *
 * @since 1.0.0
 */
export type StdinInputHandler = (key: TerminalKey) => void;

/**
 * Controls how captured input is rendered while it is being entered.
 *
 * - `visible` — displays the entered characters normally.
 * - `hidden` — does not display the entered characters.
 * - `password` — displays a masking character instead of the entered characters.
 *
 * @since 1.0.0
 */
export type StdinCapturePrivacy = 'visible' | 'hidden' | 'password';

/**
 * Controls how the Escape key is handled during standard-input capture.
 *
 * - `cancel` — cancels the current capture and resolves it with `null`.
 * - `reset` — clears the current input and continues capturing.
 * - `ignore` — ignores the Escape key and leaves the current input unchanged.
 *
 * @since 1.0.0
 */
export type StdinEscapeBehavior = 'cancel' | 'reset' | 'ignore';

/**
 * Performs custom validation of captured standard input.
 *
 * The handler receives the current input value and a `reject` callback that can
 * be used to mark the input as invalid and provide a validation message.
 *
 * Validation may be synchronous or asynchronous. When the handler returns a
 * promise, input processing waits for that promise to settle before continuing.
 *
 * @param value - The current captured input value.
 * @param reject - Marks the input as invalid with the specified message.
 *
 * @example
 * ```ts
 * onCustomValidation: (value, reject) => {
 *     if (value.length === 0) {
 *         reject('Value cannot be empty.');
 *     }
 * }
 * ```
 *
 * @example
 * ```ts
 * onCustomValidation: async (value, reject) => {
 *     const available = await checkAvailability(value);
 *
 *     if (!available) {
 *         reject('This value is already in use.');
 *     }
 * }
 * ```
 *
 * @since 1.0.0
 */
export type StdinCustomValidationHandler = (
    value: string,
    reject: (message: string) => void
) => void | Promise<void>;

/**
 * Configuration options for capturing input from standard input.
 *
 * @since 1.0.0
 */
export type StdinCaptureOptions = {
    /**
     * Controls how the captured input is displayed while it is being entered.
     *
     * @default 'visible'
     */
    privacy?: StdinCapturePrivacy;

    /**
     * Controls how the Escape key is handled.
     *
     * @default 'cancel'
     */
    escapeBehavior?: StdinEscapeBehavior;

    /**
     * Specifies the amount of inactivity, in milliseconds, after which the
     * input capture is automatically cancelled.
     *
     * The timeout is reset whenever the captured input is modified.
     *
     * If omitted, no timeout is applied and the input capture remains active
     * indefinitely until the user submits or cancels it.
     *
     * @minimum `1000`
     */
    timeoutAfter?: number;

    /**
     * Validates the captured input when the user presses Enter.
     *
     * If validation rejects the input, the capture remains active and the
     * validation message is displayed to the user.
     *
     * The handler may perform asynchronous validation.
     *
     * @default undefined
     */
    onCustomValidation?: StdinCustomValidationHandler;
}

/**
 * Describes the result of validating captured standard input.
 *
 * @since 1.0.0
 */
export type StdinInputValidity = {
    /**
     * Whether the captured input is valid.
     */
    valid: boolean;

    /**
     * Validation error message.
     *
     * This value is empty when `valid` is `true`.
     */
    message: string;
}