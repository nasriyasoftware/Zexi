import atomix from "@nasriya/atomix";
import consoleStyler from "../../styling/styler";
import stdinSessionsManager from "../sessions/manager";
import type TerminalEntry from "../../screen/terminal-cell";
import type {
    StdinCaptureOptions,
    StdinCapturePrivacy,
    StdinCustomValidationHandler,
    StdinEscapeBehavior,
    StdinInputValidity
} from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Captures and manages interactive user input from standard input.
 *
 * `StdinCapture` is the higher-level input layer responsible for turning the
 * normalized keyboard input produced by Zexi's stdin subsystem into a complete
 * user-entered value.
 *
 * Unlike {@link StdinInput}, which only understands terminal input and produces
 * {@link TerminalKey} values, `StdinCapture` understands the semantics of an
 * interactive text input operation.
 *
 * It is responsible for:
 *
 * - maintaining the current input value
 * - appending typed characters
 * - handling Backspace
 * - updating the associated {@link TerminalEntry}
 * - optionally hiding or masking the entered value
 * - handling Escape according to the configured behavior
 * - handling Ctrl+C as cancellation
 * - validating the submitted value
 * - supporting asynchronous validation
 * - displaying validation errors
 * - enforcing an optional inactivity timeout
 * - releasing the stdin session when the interaction finishes
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT ARCHITECTURE
 * ---------------------------------------------------------------------
 *
 * `StdinCapture` sits above the low-level stdin input layer:
 *
 * ```text
 * process.stdin
 *      │
 *      ▼
 * ┌──────────────┐
 * │  StdinInput  │
 * │              │
 * │ raw input →  │
 * │ TerminalKey  │
 * └──────┬───────┘
 *        │
 *        ▼
 * ┌─────────────────────┐
 * │ stdinSession Manager│
 * │                     │
 * │ controls ownership  │
 * └─────────┬───────────┘
 *           │
 *           ▼
 * ┌─────────────────────┐
 * │   StdinCapture      │
 * │                     │
 * │ key → input value   │
 * └─────────┬───────────┘
 *           │
 *           ▼
 * ┌─────────────────────┐
 * │   TerminalEntry     │
 * │                     │
 * │ displays the value  │
 * └─────────────────────┘
 * ```
 *
 * `StdinCapture` does not directly manipulate `process.stdin`.
 * Instead, it creates a stdin session through the session manager and listens
 * for input routed to that session.
 *
 * This allows multiple interactive operations to be created without requiring
 * every caller to manually coordinate access to stdin.
 *
 * ---------------------------------------------------------------------
 * 🔷 ASSOCIATED TERMINAL ENTRY
 * ---------------------------------------------------------------------
 *
 * Every capture is associated with a {@link TerminalEntry}.
 *
 * The entry is used to display the current state of the interaction. The
 * capture expects the entry to expose an `input` template parameter when
 * updating the visible input.
 *
 * For example:
 *
 * ```ts
 * const entry = await terminal.createEntry({
 *     template: 'Enter your name: ${input}',
 *     params: {
 *         input: ''
 *     }
 * });
 *
 * const capture = new StdinCapture(entry);
 * const value = await capture.capture();
 * ```
 *
 * The `input` parameter is reserved by `StdinCapture` for the current captured
 * value.
 *
 * When `privacy` is `visible`, the current value is written directly to this
 * parameter.
 *
 * When `privacy` is `password`, the parameter contains one `*` character for
 * each entered character.
 *
 * When `privacy` is `hidden`, the parameter is not updated with the entered
 * value at all.
 *
 * The captured value itself is always maintained internally regardless of the
 * configured privacy mode.
 *
 * ---------------------------------------------------------------------
 * 🔷 CAPTURE LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * Calling {@link capture} starts the interaction.
 *
 * The capture:
 *
 * 1. creates a stdin session
 * 2. registers an input handler for that session
 * 3. starts the inactivity timeout when configured
 * 4. marks the session as ready
 * 5. waits for user input
 * 6. processes each received {@link TerminalKey}
 * 7. resolves when the interaction completes or is cancelled
 * 8. releases the stdin session
 *
 * The returned promise remains pending while the user is entering input.
 *
 * ```ts
 * const value = await capture.capture();
 * ```
 *
 * Once the interaction finishes, the promise resolves with either:
 *
 * - the entered string, when the user successfully submits the value
 * - `null`, when the interaction is cancelled or times out
 *
 * ---------------------------------------------------------------------
 * 🔷 REUSING A CAPTURE INSTANCE
 * ---------------------------------------------------------------------
 *
 * A `StdinCapture` instance represents one input interaction.
 *
 * Calling {@link capture} while a capture is already in progress returns the
 * same pending promise rather than creating another stdin session.
 *
 * This prevents multiple concurrent captures from being created accidentally
 * from the same instance.
 *
 * Once the capture has completed, the instance should generally be considered
 * finished and a new `StdinCapture` should be created for another interaction.
 *
 * ---------------------------------------------------------------------
 * 🔷 CHARACTER INPUT
 * ---------------------------------------------------------------------
 *
 * Character keys append their value to the current input:
 *
 * ```text
 * a → "a"
 * b → "ab"
 * c → "abc"
 * ```
 *
 * Each accepted character causes the associated terminal entry to be updated
 * according to the configured privacy mode.
 *
 * Input can only be modified while the capture is accepting input.
 *
 * ---------------------------------------------------------------------
 * 🔷 BACKSPACE
 * ---------------------------------------------------------------------
 *
 * Backspace removes the final character from the current input value.
 *
 * For example:
 *
 * ```text
 * Input:     hello
 * Backspace: hell
 * Backspace: hel
 * ```
 *
 * Backspace does nothing when the current value is already empty.
 *
 * ---------------------------------------------------------------------
 * 🔷 ENTER
 * ---------------------------------------------------------------------
 *
 * Enter attempts to submit the current input value.
 *
 * Before the value is accepted, the capture disables further input and runs
 * the configured custom validation handler, if one exists.
 *
 * If validation succeeds, the capture resolves with the current value.
 *
 * If validation fails:
 *
 * 1. the current input is cleared
 * 2. the validation error is displayed in the associated entry
 * 3. the error remains visible for five seconds
 * 4. the error message is cleared
 * 5. input is enabled again
 *
 * This means validation errors do not terminate the capture.
 *
 * The user can correct the value and press Enter again.
 *
 * ---------------------------------------------------------------------
 * 🔷 CUSTOM VALIDATION
 * ---------------------------------------------------------------------
 *
 * Custom validation is provided through
 * {@link StdinCustomValidationHandler}.
 *
 * The validator receives:
 *
 * ```ts
 * (value, reject)
 * ```
 *
 * The `value` argument contains the complete current input.
 *
 * Calling `reject(message)` marks the input as invalid and supplies the message
 * that will be displayed to the user.
 *
 * ```ts
 * onCustomValidation: (value, reject) => {
 *     if (value.length === 0) {
 *         reject('Value cannot be empty.');
 *     }
 * }
 * ```
 *
 * The validator may also be asynchronous:
 *
 * ```ts
 * onCustomValidation: async (value, reject) => {
 *     const available = await checkAvailability(value);
 *
 *     if (!available) {
 *         reject('That value is already in use.');
 *     }
 * }
 * ```
 *
 * While asynchronous validation is running, the entry displays:
 *
 * ```text
 * Please wait...
 * ```
 *
 * Once validation completes, the original input representation is restored.
 *
 * If the validation promise rejects unexpectedly, the rejection is converted
 * into a validation failure and displayed to the user.
 *
 * The capture itself is not rejected merely because custom validation fails.
 * Validation failure is part of the normal interaction flow.
 *
 * ---------------------------------------------------------------------
 * 🔷 PRIVACY
 * ---------------------------------------------------------------------
 *
 * Input visibility is controlled by {@link StdinCapturePrivacy}.
 *
 * The available modes are:
 *
 * - `visible`
 * - `password`
 * - `hidden`
 *
 * `visible` displays the actual entered value:
 *
 * ```text
 * Enter password: hunter2
 * ```
 *
 * `password` displays one `*` per character:
 *
 * ```text
 * Enter password: *******
 * ```
 *
 * `hidden` does not display the entered value at all.
 *
 * Privacy affects only the terminal representation. It does not alter the
 * value returned by {@link capture}.
 *
 * For example, a password captured using `password` mode is still returned as
 * its original string:
 *
 * ```ts
 * const password = await capture.capture();
 * // password === "hunter2"
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 ESCAPE BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Escape handling is controlled by {@link StdinEscapeBehavior}.
 *
 * The available behaviors are:
 *
 * - `cancel`
 * - `reset`
 * - `ignore`
 *
 * `cancel` terminates the interaction and resolves {@link capture} with
 * `null`.
 *
 * `reset` clears the current input while keeping the interaction active.
 *
 * `ignore` leaves the current input unchanged and continues waiting for input.
 *
 * The default behavior is `cancel`.
 *
 * ---------------------------------------------------------------------
 * 🔷 CTRL+C
 * ---------------------------------------------------------------------
 *
 * Ctrl+C is treated as a cancellation request.
 *
 * When Ctrl+C is received, the capture resolves with `null`.
 *
 * This allows callers to handle cancellation without having to process the
 * low-level control key themselves:
 *
 * ```ts
 * const value = await capture.capture();
 *
 * if (value === null) {
 *     console.log('Input cancelled.');
 * }
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT
 * ---------------------------------------------------------------------
 *
 * An optional inactivity timeout can be configured using `timeoutAfter`.
 *
 * When configured, the timeout is reset whenever the user modifies the input.
 * This means the timeout measures inactivity rather than total interaction
 * duration.
 *
 * For example, with:
 *
 * ```ts
 * { timeoutAfter: 5000 }
 * ```
 *
 * the capture will remain active indefinitely while the user continues typing,
 * but will resolve with `null` after five seconds without input activity.
 *
 * If `timeoutAfter` is not specified, the capture has no timeout and will wait
 * indefinitely until the user submits or cancels the interaction.
 *
 * ---------------------------------------------------------------------
 * 🔷 SESSION RELEASE
 * ---------------------------------------------------------------------
 *
 * A capture does not permanently own stdin.
 *
 * It acquires a stdin session when {@link capture} begins and releases that
 * session when the interaction settles.
 *
 * This is important when multiple interactive operations are queued:
 *
 * ```ts
 * const first = new StdinCapture(firstEntry);
 * const second = new StdinCapture(secondEntry);
 *
 * const firstValue = first.capture();
 * const secondValue = second.capture();
 * ```
 *
 * The session manager ensures that only the appropriate interaction receives
 * input at a time.
 *
 * Releasing a capture therefore does not necessarily stop stdin globally.
 * Another queued interaction may immediately become the active stdin consumer.
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPLETION AND CANCELLATION
 * ---------------------------------------------------------------------
 *
 * There are two possible successful completion states from the caller's
 * perspective:
 *
 * **Submitted value**
 *
 * ```ts
 * const value = await capture.capture();
 * // value is a string
 * ```
 *
 * **Cancelled interaction**
 *
 * ```ts
 * const value = await capture.capture();
 * // value === null
 * ```
 *
 * Cancellation occurs when:
 *
 * - Escape is configured as `cancel`
 * - Ctrl+C is received
 * - the configured inactivity timeout expires
 *
 * Validation failures are not cancellation. They keep the capture active.
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR HANDLING
 * ---------------------------------------------------------------------
 *
 * Errors that occur while establishing or managing the stdin session can cause
 * the capture promise to reject.
 *
 * In contrast, invalid user input reported through the custom validation
 * handler does **not** reject the capture promise. It is handled as part of the
 * normal input flow and allows the user to try again.
 *
 * Therefore callers should distinguish between:
 *
 * ```ts
 * const value = await capture.capture();
 * ```
 *
 * returning `null` because the interaction was cancelled, and the promise
 * rejecting because an actual runtime error occurred.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * const entry = await terminal.createEntry({
 *     template: 'Enter a port number: ${input}',
 *     params: {
 *         input: ''
 *     }
 * });
 *
 * const capture = new StdinCapture(entry, {
 *     escapeBehavior: 'cancel',
 *     onCustomValidation: (value, reject) => {
 *         if (value.length === 0) {
 *             reject('Port number cannot be empty.');
 *         }
 *
 *         const port = Number(value);
 *
 *         if (!Number.isInteger(port) || port < 0 || port > 65535) {
 *             reject('Port number must be between 0 and 65535.');
 *         }
 *     }
 * });
 *
 * const value = await capture.capture();
 *
 * if (value === null) {
 *     entry.update('[Skipped] Port number');
 * } else {
 *     entry.update(`Port: ${value}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
class StdinCapture {
    /**
     * Terminal entry whose `input` template parameter is updated as the user
     * types.
     *
     * The entry is supplied by the terminal API and may either have been
     * created specifically for this capture or supplied explicitly by the
     * caller through `terminal.prompt({ entry })`.
     *
     * The entry is never replaced during the lifetime of the capture.
     */
    readonly #_enty: TerminalEntry;

    /**
     * Controls how the current input value is represented in the associated
     * terminal entry.
     *
     * This does not affect the internally stored value. The complete,
     * unmasked value remains available for validation and is returned when
     * the capture succeeds.
     *
     * Defaults to `visible`.
     * 
     * @default 'visible'
     */
    readonly #_privacy: StdinCapturePrivacy = 'visible';

    /**
     * Determines what happens when the Escape key is received.
     *
     * - `cancel` resolves the capture with `null`.
     * - `reset` clears the current input and keeps the capture active.
     * - `ignore` leaves the current input unchanged.
     *
     * Defaults to `cancel`.
     * 
     * @default 'cancel'
     */
    readonly #_escapeBehavior: StdinEscapeBehavior = 'cancel';

    /**
     * Configuration and runtime state for the optional inactivity timeout.
     *
     * A timeout is disabled by default. When disabled, the capture can remain
     * active indefinitely until the user submits or cancels it.
     *
     * When enabled, the timer is reset whenever input is modified or otherwise
     * refreshed through the input update path.
     */
    readonly #_timeout = {
        /**
         * Whether the capture has an inactivity timeout configured.
         */
        enabled: false,

        /**
         * Number of milliseconds of inactivity allowed before the capture
         * automatically resolves with `null`.
         */
        duration: 0,

        /**
         * Currently active timeout timer.
         *
         * `null` means no timeout is currently scheduled.
         */
        timer: null as NodeJS.Timeout | null
    };

    /**
     * Optional callbacks associated with the capture.
     *
     * These are kept separately from the capture's internal mechanics so the
     * input-processing code does not need to repeatedly inspect the original
     * options object.
     */
    readonly #_events: {
        /**
         * Optional custom validation callback supplied by the terminal API.
         */
        onCustomValidation?: StdinCustomValidationHandler
    } = {};

     /**
     * Operations that manipulate the captured input value and its associated
     * terminal representation.
     *
     * This object centralizes all mutations of the input state so that privacy,
     * timeout handling, and input-enable/disable behavior remain consistent.
     */
    readonly #_input = {
        /**
         * Whether new user input is currently accepted.
         *
         * Input is disabled while Enter-triggered validation is running. This
         * prevents additional characters or another Enter key from modifying
         * the value while validation is in progress.
         * 
         * @default true
         */
        allowed: true,

        /**
         * Updates the terminal entry to reflect the current input.
         *
         * The actual representation depends on the configured privacy mode:
         *
         * - `visible` writes the current value.
         * - `password` writes a mask consisting of one `*` per character.
         * - `hidden` does not update the entry at all.
         *
         * Updating the visible input also resets the inactivity timeout.
         */
        update: () => {
            const p = this.#_privacy;
            if (p === 'hidden') { return }

            this.#_enty.updateParams({
                input: p === 'password'
                    ? '*'.repeat(this.#_currentValue.length)
                    : this.#_currentValue
            });

            this.#_helpers.resetTimeout();
        },

        /**
         * Appends a character to the current input value.
         *
         * The operation is ignored while input is disabled, such as while
         * asynchronous validation is running.
         *
         * @param value - Character or character sequence received from STDIN.
         */
        append: (value: string) => {
            if (!this.#_input.allowed) { return }
            this.#_currentValue += value;
            this.#_input.update();
        },

        /**
         * Removes the final character from the current input value.
         *
         * The operation is ignored while input is disabled.
         *
         * Backspace on an empty value is harmless and simply leaves the value
         * unchanged.
         */
        backspace: () => {
            if (!this.#_input.allowed) { return }
            this.#_currentValue = this.#_currentValue.slice(0, -1);
            this.#_input.update();
        },

        /**
         * Clears the current input value and updates the associated terminal
         * entry accordingly.
         */
        reset: () => {
            this.#_currentValue = '';
            this.#_input.update();
        },

        /**
         * Prevents further user input from being processed.
         *
         * This is primarily used while validation is running. Disabling input
         * also cancels the inactivity timeout because the capture is waiting
         * for validation to finish rather than for additional user activity.
         */
        disable: () => {
            this.#_input.allowed = false
            if (this.#_timeout.timer) {
                clearTimeout(this.#_timeout.timer);
                this.#_timeout.timer = null;
            }
        },

        /**
         * Re-enables user input after a temporary disabled state.
         *
         * Used after an invalid validation attempt has been displayed and the
         * capture is ready to accept another value.
         */
        enable: () => {
            this.#_input.allowed = true;
            this.#_helpers.resetTimeout();
        }
    }

    /**
     * Complete, unmasked input value currently entered by the user.
     *
     * This value is intentionally separate from the terminal entry's rendered
     * representation because privacy modes may mask or hide the displayed
     * value.
     */
    #_currentValue = '';

    /**
     * Promise resolvers for the currently active capture.
     *
     * Only one capture operation may be active for a `StdinCapture` instance.
     * Repeated calls to `capture()` while an operation is active return the
     * same promise rather than creating a second input session.
     */
    #_promiseWR?: PromiseWithResolvers<string | null>

    /**
     * Creates a stdin capture associated with a terminal entry.
     *
     * The entry is used as the visual representation of the current input.
     * `StdinCapture` does not create or own the entry; callers may provide an
     * existing entry so that the input interaction can become part of a larger
     * terminal display.
     *
     * When using an existing entry, the entry must provide an `input` template
     * parameter because the capture updates that parameter as the user types.
     *
     * For example:
     *
     * ```ts
     * const entry = await terminal.createEntry({
     *     template: 'Username: ${input}',
     *     params: { input: '' }
     * });
     *
     * const capture = new StdinCapture(entry);
     * ```
     *
     * @param entry - Terminal entry used to display the captured input.
     * @param options - Optional input-capture configuration.
     *
     * @throws {TypeError} If `options` is not a record object.
     * @throws {TypeError} If an option has an invalid type.
     * @throws {RangeError} If `timeoutAfter` is less than `1000` milliseconds,
     *     negative, or not finite.
     *
     * @since 1.0.0
     */
    constructor(
        entry: TerminalEntry,
        options?: StdinCaptureOptions
    ) {
        this.#_enty = entry;

        if (options === undefined) { return }

        if (!atomix.valueIs.record(options)) {
            throw new TypeError(`Expected STDIN capture \`options\` to be a record object, but got ${typeof options}`);
        }

        if (hasOwnProp(options, 'privacy') && options.privacy !== undefined) {
            const privacy = options.privacy;

            if (typeof privacy !== 'string') {
                throw new TypeError(`Expected STDIN capture \`options.privacy\` to be a string, but got ${typeof privacy}`);
            }

            if (!StdinCapture.consts.PRIVACY.includes(privacy)) {
                throw new TypeError(`Expected STDIN capture \`options.privacy\` to be one of [${StdinCapture.consts.PRIVACY.join(', ')}], but got ${privacy}`);
            }

            this.#_privacy = privacy;
        }

        if (hasOwnProp(options, 'escapeBehavior') && options.escapeBehavior !== undefined) {
            const behavior = options.escapeBehavior;

            if (typeof behavior !== 'string') {
                throw new TypeError(`Expected STDIN capture \`options.escapeBehavior\` to be a string, but got ${typeof behavior}`);
            }

            if (!StdinCapture.consts.ESCAPE_BEHAVIOR.includes(behavior)) {
                throw new TypeError(`Expected STDIN capture \`options.escapeBehavior\` to be one of [${StdinCapture.consts.ESCAPE_BEHAVIOR.join(', ')}], but got ${behavior}`);
            }

            this.#_escapeBehavior = behavior;
        }

        if (hasOwnProp(options, 'timeoutAfter') && options.timeoutAfter !== undefined) {
            const timeout = options.timeoutAfter;

            if (typeof timeout !== 'number') {
                throw new TypeError(`Expected STDIN capture \`options.timeoutAfter\` to be a number, but got ${typeof timeout}`);
            }

            if (timeout < 0) {
                throw new RangeError(`Expected STDIN capture \`options.timeoutAfter\` to be a non-negative number, but got ${timeout}`);
            }

            if (timeout < 1000) {
                throw new RangeError(`Expected STDIN capture \`options.timeoutAfter\` to be at least 1000ms, but got ${timeout}`);
            }

            if (timeout === Infinity) {
                throw new RangeError(`Expected STDIN capture \`options.timeoutAfter\` to be a finite number, but got ${timeout}`);
            }

            this.#_timeout.enabled = true;
            this.#_timeout.duration = timeout;
        }

        if (hasOwnProp(options, 'onCustomValidation') && options.onCustomValidation !== undefined) {
            const handler = options.onCustomValidation;

            if (typeof handler !== 'function') {
                throw new TypeError(`Expected STDIN capture \`options.onCustomValidation\` to be a function, but got ${typeof handler}`);
            }

            this.#_events.onCustomValidation = handler;
        }
    }

    readonly #_helpers = {
        createSession: () => {
            if (this.#_currentValue !== '') {
                this.#_currentValue = '';
                this.#_enty.updateParams({ input: '' });
            }

            const session = stdinSessionsManager.create();
            let settled = false;

            const cleanup = () => {
                if (this.#_timeout.timer) {
                    clearTimeout(this.#_timeout.timer);
                    this.#_timeout.timer = null;
                }

                session.release();
                this.#_promiseWR = undefined;
            }

            const resolve = (value: string | null) => {
                if (settled) { return }
                settled = true;

                this.#_promiseWR?.resolve(value);
                cleanup();
            }

            const reject = (error: unknown) => {
                if (settled) { return }
                settled = true;

                this.#_promiseWR?.reject(error);
                cleanup();
            }

            return { session, resolve, reject };
        },

        resetTimeout: () => {
            if (!this.#_timeout.enabled) { return }

            if (this.#_timeout.timer) {
                clearTimeout(this.#_timeout.timer);
                this.#_timeout.timer = null;
            }

            this.#_timeout.timer = setTimeout(() => {
                this.#_promiseWR?.resolve(null);
            }, this.#_timeout.duration);
        },

        validateInput: async (): Promise<StdinInputValidity> => {
            const validity = Object.seal({ valid: true, message: '' });

            if (!this.#_events.onCustomValidation) {
                return validity;
            }

            let rejected = false;
            const rejector = (message: string) => {
                if (rejected) { return }
                rejected = true;

                validity.valid = false;
                validity.message = message;
            }

            // Run the custom validation
            const returned = this.#_events.onCustomValidation(this.#_currentValue, rejector);

            if (returned instanceof Promise) {
                this.#_enty.updateParams({
                    input: 'Please wait...'
                });

                try {
                    await returned;
                    this.#_input.update();
                } catch (error) {
                    rejector(`An error occurred while validating the input: ${error}`);
                }
            }

            return validity;
        }
    }

    /**
     * Captures user input until the interaction is submitted or cancelled.
     *
     * The returned promise remains pending while the user is entering and editing
     * the value.
     *
     * Pressing Enter submits the value after custom validation succeeds.
     *
     * The promise resolves with:
     *
     * - the entered string when submission succeeds
     * - `null` when the interaction is cancelled or times out
     *
     * The promise may reject when an unexpected runtime or stdin-session error
     * occurs.
     *
     * Calling `capture()` again while a capture is already active returns the same
     * pending promise and does not create a second stdin session.
     *
     * ```ts
     * const value = await capture.capture();
     *
     * if (value === null) {
     *     console.log('Input cancelled.');
     * } else {
     *     console.log('Input:', value);
     * }
     * ```
     *
     * @returns Promise resolving to the captured value, or `null` when cancelled
     *     or timed out.
     *
     * @since 1.0.0
     */
    async capture(): Promise<string | null> {
        if (this.#_promiseWR) {
            return this.#_promiseWR.promise;
        }

        const promiseWR = this.#_promiseWR = Promise.withResolvers<string | null>();
        const { session, resolve, reject } = this.#_helpers.createSession();

        try {
            session.on('input', async key => {
                switch (key.type) {
                    case 'character': {
                        this.#_input.append(key.value);
                        break;
                    }

                    case 'backspace': {
                        this.#_input.backspace();
                        break;
                    }

                    case 'ctrl': {
                        if (key.value === 'c') {
                            resolve(null);
                        }
                        break;
                    }

                    case 'escape': {
                        if (this.#_escapeBehavior === 'reset') {
                            if (this.#_input.allowed) { this.#_input.reset(); }
                        } else if (this.#_escapeBehavior === 'cancel') {
                            resolve(null);
                        }

                        break;
                    }

                    case 'enter': {
                        if (!this.#_input.allowed) { return }
                        this.#_input.disable();

                        const validity = await this.#_helpers.validateInput();
                        if (validity.valid) {
                            resolve(this.#_currentValue);
                            return;
                        }

                        // Reset the invalid input
                        this.#_input.reset();

                        // Show the validation error message:
                        this.#_enty.updateParams({
                            input: consoleStyler.color(`[Input invalid: ${validity.message}]`, 'red')
                        });

                        await atomix.utils.sleep(5000);
                        this.#_enty.updateParams({ input: '' });
                        this.#_input.enable();
                        break;
                    }
                }
            });

            // Ready to receive input
            this.#_helpers.resetTimeout();
            session.ready();
        } catch (err) {
            reject(err);
        }

        return promiseWR.promise;
    }

    /**
     * Supported privacy modes.
     *
     * This constant is used by the constructor to validate the `privacy`
     * option at runtime.
     *
     * @internal
     */
    static consts = {
        /**
         * Supported input rendering modes:
         *
         * - `visible` — display the entered value normally.
         * - `hidden` — do not display the entered value.
         * - `password` — display one `*` per entered character.
         */
        PRIVACY: ['visible', 'hidden', 'password'],

        /**
         * Supported Escape-key behaviors:
         *
         * - `cancel` — cancel the capture.
         * - `reset` — clear the current value and continue capturing.
         * - `ignore` — do nothing.
         */
        ESCAPE_BEHAVIOR: ['cancel', 'reset', 'ignore']
    } as const;
}

export default StdinCapture;