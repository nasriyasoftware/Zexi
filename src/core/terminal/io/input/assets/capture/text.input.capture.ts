import atomix from "@nasriya/atomix";
import consoleStyler from "../../../../styling/styler";
import TerminalCell from "../../../../screen/tom/cells/terminal.cell";
import KeyInputSession from "../session/key.input.session";
import type {
    StdinCaptureOptions,
    StdinCapturePrivacy,
    StdinCustomValidationHandler,
    StdinEscapeBehavior,
    StdinInputValidity
} from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

class TextInputCapture {
    /**
     * Terminal cell whose `input` template parameter is updated as the user
     * types.
     *
     * The cell is supplied by the terminal API and may either have been
     * created specifically for this capture or supplied explicitly by the
     * caller through `terminal.prompt({ cell })`.
     *
     * The cell is never replaced during the lifetime of the capture.
     */
    readonly #_cell: TerminalCell;

    /**
     * Controls how the current input value is represented in the associated
     * terminal cell.
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
         * Updates the terminal cell to reflect the current input.
         *
         * The actual representation depends on the configured privacy mode:
         *
         * - `visible` writes the current value.
         * - `password` writes a mask consisting of one `*` per character.
         * - `hidden` does not update the cell at all.
         *
         * Updating the visible input also resets the inactivity timeout.
         */
        update: () => {
            const p = this.#_privacy;
            if (p === 'hidden') { return }

            this.#_cell.updateParams({
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
         * cell accordingly.
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
     * This value is intentionally separate from the terminal cell's rendered
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
     * Creates a stdin capture associated with a terminal cell.
     *
     * The cell is used as the visual representation of the current input.
     * `StdinCapture` does not create or own the cell; callers may provide an
     * existing cell so that the input interaction can become part of a larger
     * terminal display.
     *
     * When using an existing cell, the cell must provide an `input` template
     * parameter because the capture updates that parameter as the user types.
     *
     * For example:
     *
     * ```ts
     * const cell = await terminal.createEntry({
     *     template: 'Username: ${input}',
     *     params: { input: '' }
     * });
     *
     * const capture = new StdinCapture(cell);
     * ```
     *
     * @param cell - Terminal cell used to display the captured input.
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
        cell: TerminalCell,
        options?: StdinCaptureOptions
    ) {
        this.#_cell = cell;

        if (options === undefined) { return }

        if (!atomix.valueIs.record(options)) {
            throw new TypeError(`Expected STDIN capture \`options\` to be a record object, but got ${typeof options}`);
        }

        if (hasOwnProp(options, 'privacy') && options.privacy !== undefined) {
            const privacy = options.privacy;

            if (typeof privacy !== 'string') {
                throw new TypeError(`Expected STDIN capture \`options.privacy\` to be a string, but got ${typeof privacy}`);
            }

            if (!TextInputCapture.consts.PRIVACY.includes(privacy)) {
                throw new TypeError(`Expected STDIN capture \`options.privacy\` to be one of [${TextInputCapture.consts.PRIVACY.join(', ')}], but got ${privacy}`);
            }

            this.#_privacy = privacy;
        }

        if (hasOwnProp(options, 'escapeBehavior') && options.escapeBehavior !== undefined) {
            const behavior = options.escapeBehavior;

            if (typeof behavior !== 'string') {
                throw new TypeError(`Expected STDIN capture \`options.escapeBehavior\` to be a string, but got ${typeof behavior}`);
            }

            if (!TextInputCapture.consts.ESCAPE_BEHAVIOR.includes(behavior)) {
                throw new TypeError(`Expected STDIN capture \`options.escapeBehavior\` to be one of [${TextInputCapture.consts.ESCAPE_BEHAVIOR.join(', ')}], but got ${behavior}`);
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
        createCapturer: () => {
            if (this.#_currentValue !== '') {
                this.#_currentValue = '';
                this.#_cell.updateParams({ input: '' });
            }

            let capturer: KeyInputSession | undefined;
            let settled = false;

            const cleanup = () => {
                if (this.#_timeout.timer) {
                    clearTimeout(this.#_timeout.timer);
                    this.#_timeout.timer = null;
                }

                if (!capturer) {
                    throw new Error('Invariant violation: capturer should not be undefined');
                }

                capturer.release();
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

            capturer = new KeyInputSession(async (key) => {
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
                        this.#_cell.updateParams({
                            input: consoleStyler.color(`[Input invalid: ${validity.message}]`, 'red')
                        });

                        await atomix.utils.sleep(5000);
                        this.#_cell.updateParams({ input: '' });
                        this.#_input.enable();
                        break;
                    }
                }
            });

            return { capturer, resolve, reject };
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
                this.#_cell.updateParams({
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

    #_capture(): Promise<string | null> {
        if (this.#_promiseWR) {
            return this.#_promiseWR.promise;
        }

        const promiseWR = this.#_promiseWR = Promise.withResolvers<string | null>();
        const { capturer, reject } = this.#_helpers.createCapturer();

        try {
            // Ready to receive input
            this.#_helpers.resetTimeout();

            void capturer.acquire();
        } catch (error) {
            reject(error);
        }

        return promiseWR.promise;
    }

    static capture(
        cell: TerminalCell,
        options?: StdinCaptureOptions
    ) {
        return new TextInputCapture(cell, options).#_capture();
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

export default TextInputCapture;