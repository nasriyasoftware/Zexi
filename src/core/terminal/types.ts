import type TerminalEntry from "./screen/terminal-cell";
import {
    StdinCaptureOptions,
    StdinCapturePrivacy,
    StdinCustomValidationHandler,
    StdinEscapeBehavior
} from "./input/types";

/**
 * Logging levels supported by Zexi.
 *
 * The levels are ordered from least severe to most severe. The order is
 * significant and is used when determining whether a log event should be
 * printed according to a terminal instance's configured {@link ZexiLogLevel}.
 *
 * The ordering is:
 *
 * `debug` < `info` < `warn` < `error` < `fatal`
 *
 * A terminal configured with a given level prints events at that level or
 * any higher severity level.
 *
 * @since 1.0.0
 */
export const ZEXI_LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

/**
 * A logging severity level supported by Zexi.
 *
 * @see {@link ZEXI_LOG_LEVELS}
 *
 * @since 1.0.0
 */
export type ZexiLogLevel = typeof ZEXI_LOG_LEVELS[number];

/**
 * Selects the renderer used to produce the printable representation of a
 * terminal log value.
 *
 * The selected target affects the representation intended for terminal
 * output. The event's serialized value remains in Zexi's canonical JSON
 * representation regardless of this setting.
 *
 * - `json` — Render the value using the JSON renderer.
 * - `debug` — Render the value using the debug renderer.
 *
 * @since 1.0.0
 */
export type OutputTarget = 'json' | 'debug';

/**
 * Controls the structural layout used by a terminal renderer.
 *
 * - `compact` — Produce a compact representation with minimal whitespace.
 * - `pretty` — Produce a human-readable representation using the renderer's
 *   pretty-printing rules.
 *
 * @since 1.0.0
 */
export type OutputMode = 'compact' | 'pretty';

/**
 * Options controlling how a value is processed by a terminal logging method.
 *
 * These options affect the log operation and its terminal presentation.
 * They do not change the event model itself.
 *
 * @since 1.0.0
 */
export type TerminalLogOptions = {
    /**
     * Selects the renderer used for the printable log representation.
     *
     * When omitted, Zexi uses the debug renderer for `debug()` and the JSON
     * renderer for all other logging methods.
     *
     * @default For `debug()`: `'debug'`.
     * @default For all other log levels: `'json'`.
     */
    target?: OutputTarget;

    /**
     * Indicates whether the caller's stack trace should be captured and
     * included with the resulting log event.
     *
     * When enabled, the event contains both the original structured stack
     * trace and its printable representation.
     *
     * @default false
     */
    trace?: boolean;

    /**
     * Determines whether the resulting log event should be printed to the
     * terminal screen.
     *
     * Event emission is independent of this option. Setting this to `false`
     * suppresses terminal output while the corresponding log events are
     * still emitted.
     *
     * @default true
     */
    print?: boolean;
}

/**
 * Configuration options for a {@link ZexiTerminal} instance.
 *
 * These options configure the behavior of the individual terminal instance.
 * Multiple instances may use different configurations while sharing the
 * underlying terminal screen engine and event emitter.
 *
 * @since 1.0.0
 */
export type ZexiTerminalOptions = {
    /**
     * Minimum severity level that this terminal instance will print.
     *
     * Log events below this level are still created and emitted, but are not
     * printed by this terminal instance.
     *
     * The severity ordering is defined by {@link ZEXI_LOG_LEVELS}.
     *
     * @default `'debug'`
     */
    logLevel?: ZexiLogLevel;

    /**
     * Determines whether log metadata is included in the terminal output.
     *
     * When enabled, printed log messages include the event timestamp and
     * uppercase log level before the logged value.
     *
     * This only affects terminal presentation; the event itself always
     * contains its timestamp and log level.
     *
     * @default false
     */
    includeMetadata?: boolean;
}

/**
 * Configuration options for {@link Terminal.prompt}.
 *
 * These options control how the terminal collects and displays the user's
 * input. When no `entry` is provided, the prompt creates and manages its own
 * terminal entry using the supplied {@link message}. When an existing entry
 * is provided, the prompt uses that entry as the input display and expects
 * it to contain an `input` parameter.
 *
 * @example
 * ```ts
 * const port = await terminal.prompt({
 *     message: 'Enter the port number: ',
 *     onCustomValidation: (value, reject) => {
 *         const port = Number(value);
 *
 *         if (!Number.isInteger(port) || port < 0 || port > 65535) {
 *             reject('Please enter a valid port number between 0 and 65535.');
 *         }
 *     }
 * });
 * ```
 *
 * @example
 * Using an existing terminal entry:
 * ```ts
 * const entry = await terminal.createEntry({
 *     template: 'Port: ${input}',
 *     params: { input: '' }
 * });
 *
 * const port = await terminal.prompt({ entry });
 * ```
 *
 * @see {@link StdinCaptureOptions} for the underlying STDIN capture options.
 * @since 1.0.0
 */
export type TerminalPromptOptions = {
    /**
     * An existing terminal entry to use for displaying the prompt and the
     * captured input.
     *
     * When provided, the prompt does not create or finalize an entry of its
     * own. The entry must provide an `input` parameter because the captured
     * value is written to that parameter while the user types.
     *
     * When omitted, the prompt creates an entry using {@link message} and
     * automatically finalizes it when input capture ends.
     * 
     * @since 1.0.0
     */
    entry?: TerminalEntry;

    /**
     * The message displayed before the user's input.
     *
     * This option is used only when {@link entry} is not provided. The
     * resulting entry uses the following template:
     *
     * ```text
     * ${message}${input}
     * ```
     *
     * If omitted, no message is displayed before the input.
     * 
     * @since 1.0.0
     */
    message?: string;

    /**
     * Controls how the user's input is displayed while it is being captured.
     *
     * - `visible` displays the entered text normally.
     * - `password` displays one `*` character for each entered character.
     * - `hidden` does not display the entered value at all.
     *
     * Regardless of the selected privacy mode, the actual value remains
     * available to the prompt and is returned when capture succeeds.
     *
     * @default "visible"
     * @since 1.0.0
     */
    privacy?: StdinCapturePrivacy;

    /**
     * Determines what happens when the user presses the Escape key.
     *
     * - `cancel` cancels the prompt and causes it to resolve with `null`.
     * - `reset` clears the current input and allows the user to start again.
     * - `ignore` does nothing and continues capturing the input.
     *
     * @default "cancel"
     * @since 1.0.0
     */
    escapeBehavior?: StdinEscapeBehavior;

    /**
     * The amount of time, in milliseconds, after which the prompt is
     * automatically cancelled due to inactivity.
     *
     * The timeout is reset whenever the user modifies the input. If this
     * option is omitted, the prompt has no timeout and can remain active
     * indefinitely.
     *
     * The value must be at least `1000` milliseconds.
     * 
     * @since 1.0.0
     */
    timeoutAfter?: number;

    /**
     * A callback used to validate the entered value when the user presses
     * Enter.
     *
     * The callback receives the current input value and a `reject` function.
     * Calling `reject()` marks the input as invalid and displays the supplied
     * validation message. The message is shown to the user before they can
     * continue entering input.
     *
     * The callback may perform asynchronous validation by returning a
     * `Promise`. While asynchronous validation is in progress, the prompt
     * temporarily displays a waiting message and prevents the input from
     * being submitted.
     *
     * If the callback throws or its returned promise rejects, the input is
     * treated as invalid and the error is presented as a validation failure.
     *
     * @example
     * ```ts
     * const email = await terminal.prompt({
     *     message: 'Email: ',
     *     onCustomValidation: (value, reject) => {
     *         if (!value.includes('@')) {
     *             reject('Please enter a valid email address.');
     *         }
     *     }
     * });
     * ```
     *
     * @example
     * Asynchronous validation:
     * ```ts
     * const username = await terminal.prompt({
     *     message: 'Username: ',
     *     onCustomValidation: async (value, reject) => {
     *         const available = await checkUsernameAvailability(value);
     *
     *         if (!available) {
     *             reject('That username is already taken.');
     *         }
     *     }
     * });
     * ```
     * 
     * @since 1.0.0
     */
    onCustomValidation?: StdinCustomValidationHandler;
};

/**
 * Options for configuring a terminal confirmation prompt.
 *
 * @remarks
 * These options control how the confirmation prompt is displayed and how
 * input is handled while waiting for the user to confirm or reject the
 * operation.
 *
 * The prompt accepts a simple yes/no response. Pressing Enter without
 * explicitly selecting an answer uses the configured {@link default} value.
 *
 * @example
 * ```ts
 * const confirmed = await terminal.confirm(
 *     'Are you sure you want to continue?',
 *     {
 *         default: false
 *     }
 * );
 * ```
 *
 * @example
 * ```ts
 * const confirmed = await terminal.confirm(
 *     'Overwrite the existing file?',
 *     {
 *         default: true,
 *         timeoutAfter: 30_000
 *     }
 * );
 *
 * if (confirmed === null) {
 *     // The confirmation timed out or was cancelled.
 * }
 * ```
 */
export type TerminalConfirmOptions = {
    /**
     * An existing terminal entry to use for displaying the confirmation.
     *
     * When provided, the confirmation uses this entry instead of creating a
     * new one. The entry must provide an `input` parameter because the
     * confirmation state is displayed through that parameter.
     *
     * When omitted, the confirmation creates and manages its own terminal
     * entry using the message passed to {@link Terminal.confirm}.
     */
    entry?: TerminalEntry;

    /**
     * The value to use when the user submits the confirmation without
     * explicitly selecting an answer.
     *
     * `true` means the confirmation is granted by default, while `false`
     * means it is denied by default.
     *
     * @default false
     */
    default?: boolean;

    /**
     * The amount of time, in milliseconds, after which the confirmation is
     * automatically cancelled due to inactivity.
     *
     * When the timeout expires, the confirmation resolves with `null`.
     *
     * If omitted, the confirmation has no timeout and remains active until
     * the user explicitly confirms, denies, or cancels it.
     *
     * The value must be at least `1000` milliseconds.
     */
    timeoutAfter?: number;
};