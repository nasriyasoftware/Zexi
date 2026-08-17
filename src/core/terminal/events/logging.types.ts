import type { DeepReadonly, Prettify } from "@nasriya/atomix";
import type { ZexiLogLevel } from "../types";
import type { StackTraceLine } from "../pipeline/1-graphing/types";
import type { TerminalEventBase } from "./types";

/**
 * Event name for a log event at a specific logging level.
 *
 * @example
 * `'log.info'`
 *
 * @example
 * `'log.error'`
 *
 * @since 1.0.0
 */
export type LogEventName = `log.${ZexiLogLevel}`;

/**
 * Maps terminal log event names to their corresponding event handlers.
 *
 * The `log` event receives every log event regardless of its logging level,
 * while level-specific events such as `log.info` and `log.error` receive
 * only events for their respective levels.
 *
 * @example
 * ```ts
 * terminal.events.on('log', event => {
 *     // Receives all log events.
 * });
 *
 * terminal.events.on('log.error', event => {
 *     // Receives only error log events.
 * });
 * ```
 *
 * @since 1.0.0
 */
export type LogEventsMap = Prettify<{
    log: LogEventHandler;
} & {
    [L in ZexiLogLevel as `log.${L}`]: LogEventHandler<L>;
}>

/**
 * Represents a terminal logging event.
 *
 * A logging event contains both the original JavaScript value and the
 * representations produced for event consumers and terminal output.
 *
 * The `value.original` property contains the value supplied to the logging
 * method without transformation. The `value.serialized` property contains
 * the canonical compact serialized representation of that value. The
 * `value.printable` property contains the representation intended for
 * human-readable terminal output and may differ from the serialized value.
 *
 * When stack tracing is enabled, the `trace` property contains both the
 * structured stack trace and its printable representation.
 *
 * The generic parameter determines the logging level represented by the
 * event. For example, `TerminalLogEvent<'error'>` represents a
 * `log.error` event.
 *
 * @typeParam L - Logging level represented by the event.
 *
 * @example
 * ```ts
 * terminal.events.on('log.error', event => {
 *     event.level;           // 'error'
 *     event.name;            // 'log.error'
 *     event.value.original;  // original JavaScript value
 *     event.value.serialized;
 *     event.value.printable;
 * });
 * ```
 *
 * @since 1.0.0
 */
export type TerminalLogEvent<
    L extends ZexiLogLevel = ZexiLogLevel,
> = Prettify<
    TerminalEventBase<`log.${L}`>
    & {
        /**
         * Logging severity of the event.
         *
         * This always corresponds to the logging level encoded in `name`.
         *
         * @since 1.0.0
         */
        level: L;

        /**
         * Representations of the value supplied to the logging method.
         *
         * @since 1.0.0
         */
        value: {
            /**
             * The original JavaScript value supplied to the logging method.
             *
             * This value is not replaced by its rendered representation and
             * allows event consumers to inspect the original data directly.
             *
             * @since 1.0.0
             */
            original: unknown;

            /**
             * Canonical compact serialized representation of the original
             * value.
             *
             * This representation is intended for machine-oriented consumers
             * and does not contain terminal formatting or unnecessary
             * whitespace.
             *
             * @since 1.0.0
             */
            serialized: string;

            /**
             * Human-readable representation of the original value intended
             * for terminal output.
             *
             * The representation depends on the output target selected when
             * the log was created and may contain ANSI styling.
             *
             * @since 1.0.0
             */
            printable: string;
        };

        /**
         * Stack trace captured when caller tracing was requested.
         *
         * This property is omitted when tracing was not enabled.
         *
         * @since 1.0.0
         */
        trace?: {
            /**
             * Structured stack trace produced from the caller's stack.
             *
             * @since 1.0.0
             */
            original: StackTraceLine[];

            /**
             * Human-readable rendering of the stack trace intended for
             * terminal output.
             *
             * @since 1.0.0
             */
            printable: string;
        };
    }
>;

/**
 * Handler invoked when a terminal logging event is emitted.
 *
 * For level-specific events, the generic parameter restricts the event to
 * that logging level. The general `log` event uses the default generic
 * parameter and therefore receives events from every logging level.
 *
 * Events are deeply readonly so handlers cannot mutate the event emitted
 * by the terminal.
 *
 * @typeParam L - Logging level handled by the callback.
 *
 * @since 1.0.0
 */
type LogEventHandler<L extends ZexiLogLevel = ZexiLogLevel> = (event: DeepReadonly<TerminalLogEvent<L>>) => void;