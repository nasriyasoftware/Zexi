import type { StdinKeyInputHandler, TerminalKey } from "../parser/types";

/**
 * Receives parsed keys while a key-input session is active.
 *
 * This callback is the interaction boundary: it receives normalized keys and
 * the function for ending the session, while the consumer owns all key
 * interpretation and interaction state. For example:
 *
 * ```ts
 * const session = new KeyInputSession((key, release) => {
 *     if (key.type === 'enter') {
 *         release();
 *     }
 * });
 * ```
 *
 * The callback is invoked synchronously for each dispatched key. If it starts
 * asynchronous work, the session does not wait for that work to complete.
 *
 * Releasing prevents the controller from routing later stdin chunks to the
 * session. It does not interrupt parsing of a chunk already delivered, so
 * additional buffered keys from that chunk may still invoke this callback.
 *
 * @param key - The parsed terminal key.
 * @param release - Ends this session's stdin request. While the session is
 * `Ready`, it stops routing new chunks and signals asynchronous controller
 * cleanup. While the session is `Pending` or `Queued`, it cancels the request
 * so it cannot acquire stdin. It returns without waiting for cleanup.
 * @returns `void`
 * @since 1.0.0
 */
export type StdinKeyInputConsumerHandler = (key: TerminalKey, release: () => void) => void;

/**
 * Separates parser-to-session dispatch from the consumer callback.
 *
 * @internal
 * @since 1.0.0
 */
export interface StdinKeyInputHandlers {
    /**
     * Receives parsed keys from the parser before forwarding them to the
     * consumer.
     */
    system: StdinKeyInputHandler;

    /**
     * Consumer callback installed by the key-input session.
     */
    consumer?: StdinKeyInputConsumerHandler;
}

/**
 * Successful outcome returned when an input session acquires stdin.
 *
 * When `acquire()` resolves with this result, the session status is `Ready`
 * and the key-input session owns the stdin turn until it is released.
 *
 * @since 1.0.0
 */
export interface InputAcquisitionSuccess {
    /**
     * Discriminant indicating that the session acquired stdin.
     *
     * @since 1.0.0
     */
    acquired: true;
}

/**
 * Non-error outcome returned when an input session is canceled before
 * acquiring stdin.
 *
 * This commonly occurs when a queued session is canceled before it reaches
 * the front of the controller's queue. The request did not acquire stdin;
 * consumers should treat this as normal cancellation control flow rather
 * than as a stream setup failure.
 *
 * @since 1.0.0
 */
export interface InputAcquisitionFailure {
    /**
     * Discriminant indicating that the session did not acquire stdin.
     *
     * @since 1.0.0
     */
    acquired: false;

    /**
     * Identifies why acquisition did not occur.
     *
     * @since 1.0.0
     */
    reason: 'session_cancelled';
}

/**
 * Result of requesting an exclusive stdin turn.
 *
 * `acquired` discriminates between a session that owns stdin and one canceled
 * before ownership was granted:
 *
 * ```ts
 * const result = await session.acquire();
 *
 * if (result.acquired) {
 *     // The session owns stdin.
 * } else {
 *     // result.reason === 'session_cancelled'
 * }
 * ```
 *
 * Failures while configuring stdin reject the `acquire()` promise; they are
 * not represented by this union.
 *
 * @since 1.0.0
 */
export type InputAcquisitionResult = InputAcquisitionSuccess | InputAcquisitionFailure;