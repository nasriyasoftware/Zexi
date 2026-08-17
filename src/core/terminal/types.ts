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