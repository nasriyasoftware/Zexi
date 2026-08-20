import stdinInput from "../stdin/stdin.input";
import StdinSession from "./session"
import { EventEmitter } from "@nasriya/atomix/tools";
import type { SessionManagerQueues, SessionMetadata } from "./types";

/**
 * Coordinates access to the process STDIN stream between multiple
 * {@link StdinSession} instances.
 *
 * `StdinSessionsManager` exists because STDIN is a shared resource: only one
 * consumer can safely interpret terminal input at a time.
 *
 * A consumer may create and prepare multiple sessions without waiting for
 * previous sessions to finish:
 *
 * ```ts
 * const first = stdinSessionsManager.create();
 * const second = stdinSessionsManager.create();
 *
 * first.ready();
 * second.ready();
 * ```
 *
 * Both sessions can therefore exist simultaneously, but only one session is
 * allowed to receive input at any given time.
 *
 * ### Session scheduling
 *
 * The manager maintains three logical groups of sessions:
 *
 * ```
 * pending queue → ready queue → active session
 * ```
 *
 * **Pending sessions**
 *
 * Sessions that have been created but have not yet called `session.ready()`.
 *
 * **Ready sessions**
 *
 * Sessions that have called `session.ready()` and are waiting for their turn
 * to receive STDIN.
 *
 * **Active session**
 *
 * The single session currently receiving input from {@link stdinInput}.
 *
 * When the active session calls `release()`, STDIN is transferred to the next
 * session in the ready queue, if one exists. STDIN is stopped only when there
 * are no ready sessions remaining.
 *
 * ### Why readiness is separate from creation
 *
 * Creating a session does not mean that its consumer has finished preparing
 * its input handler.
 *
 * A typical consumer therefore follows this pattern:
 *
 * ```ts
 * const session = stdinSessionsManager.create();
 *
 * session.on('input', key => {
 *     // Handle input.
 * });
 *
 * session.ready();
 * ```
 *
 * This guarantees that the consumer has installed its handlers before the
 * manager can activate the session.
 *
 * ### Ordering guarantee
 *
 * Ready sessions are activated in the same order in which they entered the
 * ready queue.
 *
 * For example:
 *
 * ```text
 * Session A → ready
 * Session B → ready
 * Session C → ready
 * ```
 *
 * results in:
 *
 * ```text
 * A → B → C
 * ```
 *
 * provided each session releases STDIN normally.
 *
 * @internal
 * @since 1.0.0
 */
class StdinSessionsManager {
    /**
     * The session currently receiving STDIN input.
     *
     * At most one session may occupy this slot.
     *
     * The active session is intentionally not stored in either manager queue.
     * It has already been selected for execution and therefore has its own
     * dedicated state.
     *
     * @internal
     */
    #_active: SessionMetadata | null = null;

    /**
     * Queues containing sessions that have not yet become active.
     *
     * - `pending` contains sessions that have not called `ready()`.
     * - `ready` contains sessions that have called `ready()` and are waiting
     *   for their turn.
     *
     * @internal
     */
    readonly #_queues: SessionManagerQueues = {
        pending: [],
        ready: []
    }

    /**
     * Internal callbacks used to react to lifecycle requests originating from
     * individual sessions.
     *
     * These callbacks are installed into each session when it is created.
     *
     * @internal
     */
    readonly #_eventHandlers = {
        /**
         * Handles a session declaring itself ready.
         *
         * The session must currently be in the pending queue. It is removed
         * from that queue, transitioned to `ready`, and appended to the ready
         * queue.
         *
         * After the transition, the manager attempts to activate the next
         * ready session.
         *
         * @param meta
         * Metadata belonging to the session that became ready.
         *
         * @throws {Error}
         * Thrown when the session is not in the expected `pending` state or
         * cannot be found in the pending queue.
         *
         * @internal
         */
        onSessionReady: (meta: SessionMetadata) => {
            if (meta.state !== 'pending') {
                throw new Error(`Invariant violation: A session cannot transition from ${meta.state} to ready.`);
            }

            const index = this.#_queues.pending.indexOf(meta as SessionMetadata<'pending'>);
            if (index === -1) {
                throw new Error('Invariant violation: session not found in pending queue.');
            }

            this.#_queues.pending.splice(index, 1);

            meta.state = 'ready';
            this.#_queues.ready.push(meta as SessionMetadata<'ready'>);

            void meta.events.emit('ready');
            this.#_startNext();
        },

        /**
         * Handles a session releasing its STDIN claim.
         *
         * The action taken depends on the session's current lifecycle state:
         *
         * - `pending` — remove it from the pending queue.
         * - `ready` — remove it from the ready queue.
         * - `started` — release the active session.
         * - `released` — considered an invalid repeated release.
         *
         * Releasing the active session may cause the next ready session to be
         * activated.
         *
         * @param meta
         * Metadata belonging to the session being released.
         *
         * @throws {Error}
         * Thrown when the manager's internal queue/state invariants are
         * violated.
         *
         * @internal
         */
        onSessionRelease: (meta: SessionMetadata) => {
            switch (meta.state) {
                case 'pending': {
                    const index = this.#_queues.pending.indexOf(meta as SessionMetadata<'pending'>);
                    if (index === -1) {
                        throw new Error('Invariant violation: session not found in pending queue.');
                    }

                    this.#_queues.pending.splice(index, 1);
                    meta.state = 'released';
                    break;
                }

                case 'ready': {
                    const index = this.#_queues.ready.indexOf(meta as SessionMetadata<'ready'>);
                    if (index === -1) {
                        throw new Error('Invariant violation: session not found in ready queue.');
                    }

                    this.#_queues.ready.splice(index, 1);
                    meta.state = 'released';
                    break;
                }

                case 'started': {
                    if (this.#_active !== meta) {
                        throw new Error('Invariant violation: A session with state `started` was attempted to be released without being active.');
                    }
                    
                    this.#_releaseActive();
                    break;
                }

                case 'released': {
                    throw new Error(`Invariant violation: Cannot release a session that is already released.`);
                }
            }

            void meta.events.emit('release').then(() => meta.events.remove.allHandlers());
        }
    }

    /**
     * Creates the session manager and attaches it to the STDIN input source.
     *
     * The manager is the sole consumer of {@link stdinInput} input events.
     * Individual sessions do not listen to STDIN directly.
     *
     * When a key is captured, it is forwarded only to the currently active
     * session.
     *
     * This indirection is what allows the manager to serialize multiple
     * independent input sessions over the single process STDIN stream.
     *
     * @internal
     * @since 1.0.0
     */
    constructor() {
        stdinInput.onInput((key) => {
            if (this.#_active === null) {
                return;
            }

            void this.#_active.events.emit('input', key);
        });
    }

    /**
     * Releases the currently active session and attempts to activate the next
     * waiting session.
     *
     * This method is only called after the active session has requested
     * release.
     *
     * STDIN is stopped before the active session is removed. If another
     * session is waiting in the ready queue, {@link #_startNext} immediately
     * transfers STDIN to that session.
     *
     * If no ready session exists, STDIN remains stopped until a session becomes
     * ready.
     *
     * @throws {Error}
     * Thrown when there is no active session or when the active session is
     * already marked as released.
     *
     * @internal
     */
    #_releaseActive() {
        if (this.#_active === null) {
            throw new Error('Invariant violation: There is no active session to remove.');
        }

        if (this.#_active.state === 'released') {
            throw new Error('Invariant violation: The active session is already released and cannot be removed.');
        }

        stdinInput.stop();
        this.#_active = null;

        this.#_startNext();
    }

    /**
     * Attempts to activate the next session waiting in the ready queue.
     *
     * If a session is already active, this method does nothing by design:
     * activating another session would violate the manager's single-active-
     * session invariant.
     *
     * When a ready session exists:
     *
     * 1. It is removed from the ready queue.
     * 2. It becomes the active session.
     * 3. Its `start` event is emitted.
     * 4. After the event completes, STDIN capture is started.
     * 5. The session transitions to `started`.
     *
     * The `start` event is completed before STDIN is started so that a
     * consumer can finish its startup work before any input can be delivered.
     *
     * @throws {Error}
     * Thrown when this method is called while another session is already
     * active.
     *
     * @internal
     */
    #_startNext() {
        if (this.#_active !== null) {
            throw new Error('Invariant violation: There is already an active session.');
        }

        const readySession = this.#_queues.ready.shift() ?? null;
        if (readySession === null) {
            return;
        }

        const active = this.#_active = readySession as SessionMetadata;
        active.events.emit('start').then(() => {
            stdinInput.start();
            active.state = 'started';
        });
    }

    /**
     * Creates a new STDIN input session.
     *
     * The newly created session starts in the `pending` state. It does not
     * receive input until its consumer calls `session.ready()` and the session
     * reaches the front of the ready queue.
     *
     * Creating multiple sessions is safe:
     *
     * ```ts
     * const first = manager.create();
     * const second = manager.create();
     *
     * first.ready();
     * second.ready();
     * ```
     *
     * In this example, `second` waits for `first` to release STDIN.
     *
     * @returns
     * A new session handle that can be configured and then marked ready.
     *
     * @internal
     * @since 1.0.0
     */
    create() {
        const events = new EventEmitter();
        const meta: SessionMetadata<'pending'> = {
            state: 'pending',
            session: new StdinSession(events),
            events
        }

        this.#_queues.pending.push(meta);

        StdinSession.setEvents(meta.session, {
            onReady: () => this.#_eventHandlers.onSessionReady(meta),
            onRelease: () => this.#_eventHandlers.onSessionRelease(meta)
        });

        return meta.session;
    }

    /**
     * Indicates whether a session is currently receiving STDIN input.
     *
     * This is `true` whenever the manager has an active session and `false`
     * when STDIN is not currently owned by any session.
     *
     * @internal
     * @since 1.0.0
     */
    get isActive() {
        return this.#_active !== null;
    }
}

/**
 * The singleton STDIN session manager used internally by the terminal.
 *
 * All terminal input sessions share this manager so that multiple consumers
 * can safely request STDIN without interfering with one another.
 *
 * @internal
 * @since 1.0.0
 */
const stdinSessionsManager = new StdinSessionsManager();
export default stdinSessionsManager;