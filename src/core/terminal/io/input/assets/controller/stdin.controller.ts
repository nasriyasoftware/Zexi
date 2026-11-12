import atomix from "@nasriya/atomix";
import ZexiPromise from "../../../../../shared/utils/zexi.promise";
import { TasksQueue } from "@nasriya/atomix/tools";
import type { StdinHandler, StdinSession, StdinSessionStatus } from "./types";
import terminalStreams from "../../../shared/streams";

/**
 * Coordinates exclusive access to the shared terminal standard-input stream.
 *
 * `StdinController` serializes input consumers through one automatically
 * running queue. A consumer creates a session with its data handler, then calls
 * `session.start()` to request an input turn. The controller grants one
 * session at a time and keeps its queue task active until stream cleanup has
 * finished.
 *
 * The controller installs one shared `data` listener on the configured stdin
 * stream the first time a session starts. That listener remains installed and
 * forwards each raw `Buffer` only to the handler stored as the current target.
 * With no active target, input is ignored by the controller. Individual
 * sessions do not add or remove their own listeners.
 *
 * The controller also owns stdin's raw-mode and flowing-state changes:
 *
 * - on session start, select its handler, enable raw mode, and resume stdin;
 * - on release or active cancellation, clear the handler target immediately;
 * - during queued cleanup, pause stdin and restore cooked mode;
 * - do not start the next queued session until that cleanup completes.
 *
 * The controller routes bytes but does not parse them, interpret keys, or
 * choose how a consumer should respond. Those responsibilities stay with the
 * handler supplied when the session is created.
 *
 * ---------------------------------------------------------------------
 * 🔷 SESSION OWNERSHIP AND QUEUEING
 * ---------------------------------------------------------------------
 *
 * Creating a session is passive: it neither changes stdin nor reserves a
 * queue position. Its first `start()` call changes its state to `Queued`
 * synchronously and adds one task to the controller's queue. When that task
 * reaches the front, the controller selects the session's handler and
 * prepares stdin. The start promise fulfills after setup succeeds and the
 * status becomes `Ready`.
 *
 * The queue has one active task. Calling `release()` stops routing input to
 * the current session synchronously, but does not immediately end its queue
 * task. The task then pauses stdin and schedules cooked-mode restoration. The
 * next session cannot become `Ready` until this cleanup finishes.
 *
 * A queued session canceled before its turn remains in the queue to preserve
 * ordering. Its task is skipped when selected and does not change the active
 * session's handler target.
 *
 * Only sessions submitted through the exported {@link stdinController} share
 * this queue and routing state. Code that directly attaches stdin listeners or
 * changes raw mode, pause state, or flowing state bypasses the controller's
 * ownership guarantee.
 *
 * ---------------------------------------------------------------------
 * 🔷 SESSION LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * A normally completed session follows this state sequence:
 *
 * ```text
 * Pending → Queued → Starting → Ready → Releasing → Released
 * ```
 *
 * The consumer typically requests and releases a turn as follows:
 *
 * ```ts
 * const session = stdinController.createSession(chunk => {
 *     // Process raw stdin bytes while this session is active.
 * });
 *
 * await session.start();
 *
 * if (session.status === 'Ready') {
 *     try {
 *         // This session currently receives routed stdin data.
 *     } finally {
 *         session.release();
 *     }
 * }
 * ```
 *
 * `Ready` identifies the one session whose handler is the controller's
 * current routing target. A queued cancellation also fulfills the start
 * signal, but leaves the status as `Cancelled`; callers must inspect the
 * status before assuming they own stdin. A failure during stream setup rejects
 * the start signal.
 *
 * `release()` and `cancel()` are signals, not promises for completed stream
 * cleanup. The caller can continue as soon as routing has stopped; the queue
 * still waits for pause and raw-mode restoration before advancing.
 *
 * ---------------------------------------------------------------------
 * 🔷 CANCELLATION
 * ---------------------------------------------------------------------
 *
 * Canceling a `Pending` session marks it `Cancelled` without enqueuing work.
 * Canceling a `Queued` session marks it `Cancelled` and fulfills its start and
 * release signals immediately. Its task remains queued and is skipped when
 * selected. Neither case clears or replaces the current handler target,
 * because the canceled session has not acquired stdin.
 *
 * Canceling a `Ready` session clears the routing target synchronously and
 * fulfills the release signal. The queue task then follows the ordinary
 * cleanup path and the session finishes as `Released`, not `Cancelled`.
 * Cancellation is normal control flow; it does not reject the session's
 * coordination promises. Repeated attempts to settle those promises have no
 * effect after their first settlement.
 *
 * ---------------------------------------------------------------------
 * 🔷 FAILURE AND CLEANUP
 * ---------------------------------------------------------------------
 *
 * If installing the shared listener, enabling raw mode, or resuming stdin
 * throws, the queue marks the session `Failed`. Its start signal is rejected
 * if it has not already settled. The queue's completion callback attempts to
 * pause stdin, clears the routing target, and schedules cooked-mode restoration
 * before it advances to another task.
 *
 * Cleanup pauses stdin synchronously, then clears the routing target and
 * schedules `setRawMode(false)` with `setImmediate`. A failure while obtaining
 * or pausing stdin rejects cleanup before cooked-mode restoration is
 * scheduled; a restoration failure also rejects cleanup. These failures are
 * reported through the queue task's rejection path. The persistent shared
 * `data` listener is not removed during session cleanup; with its target set
 * to `null`, it ignores input until another session becomes active.
 *
 * The controller does not preserve stdin's prior pause or raw-mode state. It
 * assumes exclusive ownership while a session is active and leaves stdin
 * paused with raw mode disabled after successful cleanup.
 *
 * @internal This controller is used by Zexi's terminal input infrastructure.
 * @since 1.0.0
 */
class StdinController {
    /**
     * Automatically running queue that serializes stdin sessions.
     *
     * `TasksQueue` uses a concurrency limit of one by default. All session
     * tasks use priority `0`, preserving their enqueue order within this
     * controller. A task waits for the session's release signal, and its
     * asynchronous `onDone` callback completes stream cleanup before the queue
     * advances to another task.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_queue = new TasksQueue({ autoRun: true });

    /**
     * Shared data-listener state used to route stdin to the active session.
     *
     * `handler` is installed on the configured stdin stream only once, on the
     * first session start. It remains attached after sessions finish and
     * forwards input only while `target` is non-null. Starting a session
     * replaces the target; releasing or canceling the active session clears it
     * before its queued cleanup finishes.
     *
     * The session queue guarantees that at most one session is in `Ready`, so
     * this target represents the sole active consumer. The controller does not
     * use this field to parse or buffer input.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_handling = {
        /**
         * Whether the shared routing listener has been attached to stdin.
         *
         * The listener is retained between sessions; only its target changes.
         * This flag prevents adding duplicate copies of the listener when later
         * sessions start.
         *
         * @internal
         * @since 1.0.0
         */
        installed: false,

        /**
         * Handler that currently receives routed stdin chunks, if any.
         *
         * A `null` target means no session is currently receiving input through
         * this controller. It is selected when a queued session starts and
         * cleared immediately when the active session releases or cancels.
         *
         * @internal
         * @since 1.0.0
         */
        target: null as StdinHandler | null,

        /**
         * The one listener attached to stdin by this controller.
         *
         * Each emitted chunk is forwarded to the current target. If no session
         * is active, optional chaining makes the listener a no-op for that
         * chunk.
         *
         * @param data - Raw bytes emitted by the configured stdin stream.
         * @internal
         * @since 1.0.0
         */
        handler: (data: Buffer) => {
            this.#_handling.target?.(data);
        }
    }

    /**
     * Performs the low-level stdin setup and teardown for a queue turn.
     *
     * The helper selects a session handler as the routing target, installs the
     * shared listener once, and controls raw mode and stream flow. On stop, it
     * clears the route, pauses stdin, and restores cooked mode. It does not
     * schedule sessions; {@link #_queue} provides that serialization.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_controller = {
        /**
         * Stops routing input and restores stdin after a queue turn.
         *
         * The shared listener remains attached. Cleanup pauses the stream,
         * clears its target so later chunks are not forwarded to the session
         * that just finished, and schedules cooked-mode restoration with
         * `setImmediate`. Deferring `setRawMode(false)` lets the current input
         * turn finish before terminal mode changes.
         *
         * The returned promise fulfills after restoration has been attempted.
         * If obtaining the stream or pausing it throws, the promise rejects
         * before the target is cleared or restoration is scheduled. If
         * restoring cooked mode throws, the promise rejects from the scheduled
         * callback. The queue awaits this promise before starting another
         * session.
         *
         * @returns A promise that fulfills after stdin cleanup completes.
         * @throws The returned promise rejects if a cleanup operation fails.
         * @internal
         * @since 1.0.0
         */
        stop: () => {
            return new Promise<void>((resolve, reject) => {
                try {
                    const stdin = terminalStreams.input;

                    stdin.pause();
                    this.#_handling.target = null;
                    
                    setImmediate(() => {
                        try {
                            stdin.setRawMode?.(false);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
                } catch (err) {
                    reject(err);
                }
            });
        },

        /**
         * Selects the session's handler and prepares stdin for raw input.
         *
         * On the first call, this method attaches the controller's shared data
         * listener and records that installation. Later calls reuse that
         * listener. It sets `target` to the current session's handler, enables
         * raw mode, and resumes stdin so incoming chunks are routed to that
         * target.
         *
         * The queue calls this only for the session at the front of the queue.
         * If listener installation, raw-mode setup, or `resume()` throws, the
         * queue marks the session failed and its completion path clears the
         * target and attempts stream cleanup.
         *
         * @param handler - Receives raw chunks while this session is active.
         * @throws Any synchronous error thrown while installing the listener,
         * enabling raw mode, or resuming stdin.
         * @internal
         * @since 1.0.0
         */
        start: (handler: StdinHandler) => {
            const stdin = terminalStreams.input;
            
            if (!this.#_handling.installed) {
                stdin.on('data', this.#_handling.handler);
                this.#_handling.installed = true;
            }

            this.#_handling.target = handler;

            // Temporarily configure stdin to receive the terminal response
            // without waiting for line-buffered input.
            stdin.setRawMode(true);
            stdin.resume();
        }
    }

    /**
     * Creates a handle for a consumer that needs an exclusive stdin turn.
     *
     * Creation is passive: it does not enqueue work, change the active routing
     * target, install the shared listener, or otherwise alter stdin. The
     * session enters the queue on its first `start()` call. When it reaches the
     * front, the controller selects the supplied handler as the routing target
     * and prepares stdin for raw input.
     *
     * The handler receives raw `Buffer` chunks only while this session is the
     * active `Ready` session. Releasing or canceling that active session clears
     * the target synchronously. The queue then performs stream cleanup before
     * granting the next session. A session canceled while queued remains in
     * order but is skipped when its task is selected.
     *
     * @param handler - Receives each raw chunk routed to this session while it
     * owns the active stdin turn.
     * @returns A session handle exposing its current state and lifecycle
     * operations.
     * @since 1.0.0
     */
    createSession(handler: StdinHandler): StdinSession {
        /**
         * Current lifecycle state for the returned session.
         *
         * State is updated by the queue task and by the session's lifecycle
         * methods. It is intentionally local to this session and does not
         * describe the controller's other queued sessions.
         *
         * @internal
         * @since 1.0.0
         */
        let status: StdinSessionStatus = 'Pending';

        /**
         * Signals used to coordinate the caller with the queued task.
         *
         * `start` normally fulfills once the session is ready. It also fulfills
         * immediately when a pending or queued session is canceled, and rejects
         * if the queue task fails before startup completes. `release` lets an
         * active task continue to its cleanup callback. Both signals use
         * {@link ZexiPromise}, whose first settlement wins; later attempts do
         * not change the result.
         *
         * @internal
         * @since 1.0.0
         */
        const controllers = {
            start: new ZexiPromise<void>(),
            release: new ZexiPromise<void>()
        }

        /**
         * Adds this session to the queue once, after its first `start()` call.
         *
         * The status changes to `Queued` before calling `addTask()`. This is
         * necessary because an idle auto-running queue may begin the task
         * synchronously during `addTask()`. The `once` wrapper prevents a
         * second task from being added for the same session.
         *
         * @internal
         * @since 1.0.0
         */
        const schedule = atomix.utils.once(() => {
            status = 'Queued';

            this.#_queue.addTask({
                type: 'stdin-session',
                priority: 0,
                /**
                 * Acquires stdin for this session and holds the queue turn
                 * until the session's release signal is fulfilled.
                 *
                 * A queued cancellation exits before changing stdin. Otherwise,
                 * this action verifies the expected state, selects the session
                 * handler through the shared router, configures stdin, marks
                 * the session `Ready`, fulfills the start signal, and waits for
                 * `release()` or active-session cancellation. The queue task
                 * remains active while its completion callback restores stdin.
                 *
                 * @internal
                 * @since 1.0.0
                 */
                action: async () => {
                    if (status === 'Cancelled') {
                        return;
                    }

                    if (status !== 'Queued') {
                        throw new Error(`Invariant violation: Attempting to run a scheduled task whle the status is "${status}".`);
                    }

                    // Start the stdin session
                    status = 'Starting';                // #1: Change status to "Starting"
                    this.#_controller.start(handler);   // #2: Start the stdin session
                    status = 'Ready';                   // #3: Change status to "Ready"
                    controllers.start.resolve();        // #4: Signal that the session has started

                    // Await the session to be released
                    await controllers.release.promise;
                },
                /**
                 * Records a task failure and settles the corresponding
                 * coordination signal.
                 *
                 * Before the start signal fulfills, an error rejects that
                 * signal so the caller learns that setup did not complete.
                 * After start, an error is sent to the release signal. The
                 * signal's first-settlement rule prevents a later settlement
                 * from replacing an earlier result.
                 *
                 * @param error - Failure raised by the task or its lifecycle
                 * callback.
                 * @internal
                 * @since 1.0.0
                 */
                onReject: (error) => {
                    status = 'Failed';
                    if (controllers.start.settled) {
                        controllers.release.reject(error);
                    } else {
                        controllers.start.reject(error);
                    }
                },
                /**
                 * Completes this queue turn and performs any required cleanup.
                 *
                 * Canceled sessions skip stream cleanup because they never
                 * acquired stdin. Failed sessions clear the shared routing
                 * target and attempt cleanup to recover from partial setup. A
                 * normal session transitions through `Releasing`, awaits
                 * pause and cooked-mode restoration, and then becomes
                 * `Released`. The `finally` block settles both coordination
                 * signals; repeated settlement is harmless.
                 *
                 * The queue awaits this callback, so the next session cannot
                 * become active until this callback finishes.
                 *
                 * @internal
                 * @since 1.0.0
                 */
                onDone: async () => {
                    try {
                        if (status === 'Cancelled') { return }

                        if (status === 'Failed') {
                            return this.#_controller.stop();
                        }

                        status = 'Releasing';
                        await this.#_controller.stop();
                        status = 'Released';
                    } finally {
                        controllers.release.resolve();
                        controllers.start.resolve();
                    }
                }
            });
        });

        /**
         * Session handle returned to the stdin consumer.
         *
         * The handle closes over its status and coordination signals. It does
         * not expose the queue, shared routing target, or stream-control
         * helper. Consumers request, release, or cancel their turn through
         * this handle without manipulating the controller's shared state.
         *
         * @internal
         * @since 1.0.0
         */
        const session: StdinSession = {
            /**
             * Gets the current state of this session.
             *
             * A consumer can use this after awaiting `start()` to distinguish
             * an active `Ready` session from one that was canceled while
             * waiting in the queue.
             *
             * @returns The current lifecycle state.
             * @since 1.0.0
             */
            get status() { return status; },
            /**
             * Requests an stdin turn and waits for its start signal.
             *
             * The first call is valid only while the session is `Pending`. It
             * changes the status to `Queued` synchronously, schedules one
             * queue task, and returns the session's start promise. The promise
             * normally fulfills after stdin is configured and the status is
             * `Ready`. If the session is canceled while queued, the promise
             * fulfills as a cancellation signal instead; inspect `status`
             * before using stdin. A setup failure rejects the promise.
             *
             * @returns A promise that fulfills when the request starts or is
             * canceled, and rejects if stdin setup fails.
             * @throws {Error} If called when the session is not `Pending`.
             * @since 1.0.0
             */
            start() {
                if (status !== 'Pending') {
                    throw new Error(`Invariant violation: Attempting to schedule a session while it's "${status}".`);
                }

                schedule();
                return controllers.start.promise;
            },
            /**
             * Stops routing input to this session and releases its queue turn.
             *
             * This method is valid only in the `Ready` state. It clears the
             * controller's active handler target synchronously, so later stdin
             * chunks are no longer forwarded to this session. It then fulfills
             * the internal release signal. The queue task pauses stdin,
             * restores cooked mode, and marks the session `Released` before
             * allowing another session to become active. Those cleanup
             * operations are asynchronous; this method itself returns `void`.
             *
             * @throws {Error} If called when the session is not `Ready`.
             * @since 1.0.0
             */
            release: () => {
                if (status !== 'Ready') {
                    throw new Error(`Invariant violation: Attempting to release a session while it's "${status}".`);
                }

                this.#_handling.target = null;
                controllers.release.resolve();
            },
            /**
             * Cancels a pending request or ends an active session's routing.
             *
             * Canceling a `Pending` session marks it `Cancelled`; it has not
             * entered the queue and will not access stdin. Canceling a `Queued`
             * session marks it `Cancelled` and fulfills its start signal
             * immediately. Its task remains queued to preserve order, then is
             * skipped without changing the active session's handler target.
             * Canceling a `Ready` session clears its routing target
             * synchronously, fulfills its release signal, and uses the normal
             * cleanup path, ending in `Released` rather than `Cancelled`.
             *
             * Cancellation is a normal lifecycle outcome. It does not reject
             * either coordination promise. Calling `cancel()` again after a
             * session has already finished does not change the controller's
             * current routing target; repeated signal settlement is harmless.
             *
             * @since 1.0.0
             */
            cancel: () => {
                if (status === 'Pending' || status === 'Queued') {
                    status = 'Cancelled';
                } else if (status === 'Ready') {
                    this.#_handling.target = null;
                }

                controllers.release.resolve();
                controllers.start.resolve();
            }
        }

        return session;
    }
}

/**
 * Shared controller used by terminal input consumers to coordinate stdin.
 *
 * All consumers that need serialized access must create sessions through this
 * instance so they participate in the same queue and stream lifecycle.
 * Creating another `StdinController` would create an independent queue and
 * would not coordinate with this controller's sessions.
 *
 * @internal
 * @since 1.0.0
 */
const stdinController = new StdinController();
export default stdinController;