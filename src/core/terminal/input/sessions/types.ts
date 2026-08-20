import type StdinSession from "./session";
import type { EventEmitter } from "@nasriya/atomix/tools";
import type { StdinInputHandler } from "../stdin/types";

/**
 * Represents the lifecycle state of a {@link StdinSession}.
 *
 * A session progresses through the following lifecycle:
 *
 * ```
 * pending → ready → started → released
 * ```
 *
 * ### `pending`
 *
 * The session has been created and placed into the session manager's pending
 * queue, but it is not yet ready to receive input.
 *
 * A session enters this state immediately when it is created.
 *
 * ### `ready`
 *
 * The session has explicitly indicated that it is ready to receive input by
 * calling `session.ready()`.
 *
 * The session manager moves it from the pending queue to the ready queue.
 * It remains here until it becomes the next session eligible to receive input.
 *
 * ### `started`
 *
 * The session is currently active and is receiving input from `StdinInput`.
 *
 * Only one session may be in this state at a time.
 *
 * ### `released`
 *
 * The session has finished using STDIN and has relinquished its position in
 * the session manager.
 *
 * A released session cannot become active again.
 *
 * @internal
 * @since 1.0.0
 */
type StdinInputSessionState =
    | 'pending'
    | 'ready'
    | 'started'
    | 'released';

/**
 * Internal metadata associated with a STDIN input session.
 *
 * The metadata is maintained by the session manager and contains both the
 * session itself and the manager-owned event channel used to coordinate its
 * lifecycle.
 *
 * The generic state parameter allows the session manager to preserve the
 * relationship between a session's current state and the queue in which it
 * resides.
 *
 * For example:
 *
 * ```ts
 * SessionMetadata<'pending'>
 * ```
 *
 * represents a session that must exist in the pending queue, while:
 *
 * ```ts
 * SessionMetadata<'ready'>
 * ```
 *
 * represents a session that must exist in the ready queue.
 *
 * This state-specific typing is primarily used to make invalid state
 * transitions and queue operations easier to detect during development.
 *
 * @typeParam S - The current lifecycle state of the session.
 *
 * @property state
 * The current lifecycle state of the session.
 *
 * @property session
 * The {@link StdinSession} instance represented by this metadata.
 *
 * @property events
 * Internal event emitter used by the session manager to coordinate the
 * session's lifecycle and forward captured input.
 *
 * @internal
 * @since 1.0.0
 */
export type SessionMetadata<
    S extends StdinInputSessionState = StdinInputSessionState
> = {
    state: S;
    session: StdinSession;
    events: EventEmitter<SessionEventsMap>;
}

/**
 * Internal queues maintained by the STDIN session manager.
 *
 * Sessions are separated into two queues according to their lifecycle state:
 *
 * - `pending` contains sessions that have been created but have not yet
 *   declared themselves ready.
 * - `ready` contains sessions that have declared themselves ready and are
 *   waiting for their turn to receive input.
 *
 * The session manager promotes sessions from `pending` to `ready`, and then
 * selects the next ready session as the active session.
 *
 * Only one session can be active at a time. The active session is tracked
 * separately by the session manager and is therefore not stored in either
 * queue.
 *
 * @property pending
 * Sessions that have been created but are not yet ready.
 *
 * @property ready
 * Sessions that are ready to receive input but are waiting for the currently
 * active session, if any, to release STDIN.
 *
 * @internal
 * @since 1.0.0
 */
export type SessionManagerQueues = {
    pending: SessionMetadata<'pending'>[];
    ready: SessionMetadata<'ready'>[];
}

/**
 * Internal callback invoked when a STDIN session becomes ready.
 *
 * The session manager registers this callback with a session so that it can
 * be notified when `session.ready()` is called.
 *
 * The callback does not receive the session itself because the manager binds
 * the callback to the corresponding session metadata when the session is
 * created.
 *
 * @internal
 * @since 1.0.0
 */
export type SessionReadyEventHandler = () => void;

/**
 * Internal callback invoked when a STDIN session is released.
 *
 * The session manager uses this callback to remove the session from its
 * current queue or active slot and, when appropriate, activate the next
 * waiting session.
 *
 * @internal
 * @since 1.0.0
 */
export type SessionReleaseEventHandler = () => void;

/**
 * Events used internally to coordinate the lifecycle of a
 * {@link StdinSession}.
 *
 * These events are divided into two categories:
 *
 * ### Lifecycle events
 *
 * - `ready` — the session has become ready to receive input.
 * - `start` — the session has become the active STDIN session.
 * - `release` — the session has finished and released STDIN.
 *
 * ### Input events
 *
 * - `input` — a key has been captured from STDIN and is being delivered to
 *   the currently active session.
 *
 * The `input` event is only emitted for the active session. Waiting sessions
 * do not receive input events until they become active.
 *
 * @internal
 * @since 1.0.0
 */
export type SessionEventsMap = {
    /**
     * Emitted when the session transitions from `pending` to `ready`.
     *
     * This is emitted after the session manager has moved the session from the
     * pending queue to the ready queue.
     * 
     * @since 1.0.0
     */
    ready: () => void;

    /**
     * Emitted when the session becomes the active STDIN session.
     *
     * At this point the session is allowed to receive `input` events.
     *
     * Only one session can receive `start` at a time.
     * 
     * @since 1.0.0
     */
    start: () => void;

    /**
     * Emitted when the session releases STDIN.
     *
     * The session manager uses this event to perform the necessary cleanup and
     * determine whether another ready session should become active.
     */
    release: () => void;

    /**
     * Emitted when a key is captured from STDIN for the active session.
     *
     * The session manager forwards the normalized key directly from
     * {@link StdinInput}.
     * 
     * @since 1.0.0
     */
    input: StdinInputHandler;
};