import type { DeepReadonly, Prettify } from "@nasriya/atomix";
import type { LogEventsMap } from "./logging.types";

export type {
    LogEventName,
    LogEventsMap,
    TerminalLogEvent
} from './logging.types';

/**
 * Common metadata shared by every terminal event.
 *
 * The base event identifies a particular occurrence through `id`, records
 * when it occurred through `time`, and identifies its event type through
 * `name`.
 *
 * @typeParam N - Name of the event.
 *
 * @internal
 * @since 1.0.0
 */
export interface TerminalEventBase<N extends TerminalEventName> {
    /**
     * Unique identifier of this event occurrence.
     *
     * @since 1.0.0
     */
    id: string;

    /**
     * ISO 8601 timestamp indicating when the event occurred.
     *
     * @since 1.0.0
     */
    time: string;

    /**
     * Name identifying the type of event.
     *
     * @since 1.0.0
     */
    name: N;
}

/**
 * Event emitted when the terminal screen is cleared.
 *
 * @since 1.0.0
 */
export interface TerminalClearEvent extends TerminalEventBase<'clear'> {
    // Clear-specific information may be added here in the future.
}

/**
 * Maps every terminal event name to its corresponding event handler.
 *
 * This includes both the general and level-specific logging events as well
 * as non-logging terminal events.
 *
 * @since 1.0.0
 */
export type TerminalEvents = Prettify<
    LogEventsMap & {
        /**
         * Handler for terminal clear events.
         *
         * @since 1.0.0
         */
        'clear': (
            event: DeepReadonly<TerminalClearEvent>
        ) => void;
    }
>;

/**
 * Union of all event names supported by the terminal.
 *
 * @since 1.0.0
 */
export type TerminalEventName = keyof TerminalEvents;

/**
 * Function used to unsubscribe an event handler.
 *
 * Calling the returned function removes the associated handler from the
 * terminal event dispatcher.
 *
 * @returns `true` when the handler was successfully removed, otherwise
 * `false`.
 *
 * @since 1.0.0
 */
export type UnsubscribeHandler = () => boolean;