/**
 * Receives one raw data chunk from stdin during an active input session.
 *
 * The controller forwards the `Buffer` chunks emitted by its configured stdin
 * stream without parsing or transforming them. The handler is registered when
 * its session reaches the front of the controller's queue and is removed when
 * that session releases stdin.
 *
 * @param data - Raw bytes delivered by stdin for this session.
 * @since 1.0.0
 */
export type StdinHandler = (data: Buffer) => void;

/**
 * Lifecycle states exposed by a {@link StdinSession}.
 *
 * A session normally progresses through:
 *
 * ```text
 * Pending → Queued → Starting → Ready → Releasing → Released
 * ```
 *
 * The states mean:
 *
 * - `Pending` — created, but `start()` has not been called.
 * - `Queued` — a start request was made and is waiting for its queue turn.
 * - `Starting` — the task is configuring stdin for this session.
 * - `Ready` — the handler is installed and this session owns stdin.
 * - `Releasing` — cleanup is running after release or active cancellation.
 * - `Released` — the session completed cleanup after release or active
 *   cancellation.
 * - `Failed` — setup or cleanup failed.
 * - `Cancelled` — a pending or queued session was canceled before acquiring
 *   stdin. A queued task remains in the queue and is skipped when selected.
 *
 * The status is observational. Callers should use the session methods to
 * request or end ownership rather than assigning lifecycle states directly.
 *
 * @since 1.0.0
 */
export type StdinSessionStatus =
    | 'Pending'
    | 'Queued'
    | 'Starting'
    | 'Ready'
    | 'Releasing'
    | 'Released'
    | 'Failed'
    | 'Cancelled';

/**
 * Handle for one consumer's request to use the shared stdin stream.
 *
 * A session begins in `Pending` and is enqueued by its first call to
 * {@link start}. The controller resolves queued sessions one at a time. A
 * session in `Ready` owns stdin until {@link release} or active
 * {@link cancel} signals its task to finish. The controller performs stream
 * cleanup before advancing the queue.
 *
 * The promises used by the session are synchronization signals; they do not
 * carry a result value. Cancellation fulfills these signals as normal control
 * flow. Inspect {@link status} when the caller needs to know whether stdin was
 * acquired or the request was canceled.
 *
 * @since 1.0.0
 */
export interface StdinSession {
    /**
     * Gets the current lifecycle state of this session.
     *
     * After awaiting {@link start}, `Ready` means the session owns stdin. A
     * queued cancellation fulfills the start signal while leaving this value
     * as `Cancelled`.
     *
     * @since 1.0.0
     */
    readonly status: StdinSessionStatus;

    /**
     * Requests a place in the stdin queue and returns the start signal.
     *
     * This method may be called only while the session is `Pending`. It marks
     * the session `Queued` synchronously. The returned promise normally
     * fulfills once the session becomes `Ready`; if canceled while queued, it
     * fulfills immediately as a cancellation signal. A setup failure rejects
     * it. Callers should inspect {@link status} after fulfillment before
     * assuming they own stdin.
     *
     * @returns A promise used to wait for the session's start or cancellation
     * signal.
     * @throws {Error} If the session is not `Pending`.
     * @since 1.0.0
     */
    start: () => Promise<void>;

    /**
     * Signals that an active session has finished using stdin.
     *
     * This is valid only while the session is `Ready`. It fulfills the
     * internal release signal; the queue then removes the handler, pauses
     * stdin, restores cooked mode, and updates the session status. Cleanup is
     * asynchronous, but this method returns `void`.
     *
     * @throws {Error} If the session is not `Ready`.
     * @since 1.0.0
     */
    release: () => void;

    /**
     * Cancels a pending or queued request, or ends an active session.
     *
     * A pending session is canceled without entering the queue. A queued
     * session remains queued so its place is preserved, then is skipped before
     * stdin setup when selected. Canceling a ready session signals normal
     * release and cleanup. Cancellation does not reject the session's
     * synchronization promises.
     *
     * @since 1.0.0
     */
    cancel: () => void;
}
