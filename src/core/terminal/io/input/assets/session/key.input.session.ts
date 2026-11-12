import stdinController from "../controller/stdin.controller";
import KeyInputParser from "../parser/key.input.parser";
import type { StdinSession } from "../controller/types";
import type { InputAcquisitionResult, StdinKeyInputConsumerHandler, StdinKeyInputHandlers } from "./types";

/**
 * Provides one consumer with serialized access to stdin and parsed key events.
 *
 * A `KeyInputSession` combines a session from the shared
 * {@link stdinController} with a {@link KeyInputParser}. The controller
 * routes raw stdin chunks to the parser only while this session owns the
 * stream. The parser converts those chunks into `TerminalKey` values,
 * which are delivered to the callback supplied to the constructor.
 *
 * `KeyInputSession` owns the input turn and dispatches keys; it does not build
 * a text value, render terminal output, validate input, or interpret keys for
 * a particular interaction. Those responsibilities belong to its consumer.
 *
 * ---------------------------------------------------------------------
 * 🔷 SESSION CREATION AND ACQUISITION
 * ---------------------------------------------------------------------
 *
 * Construction creates a parser and a passive `Pending` controller session.
 * It does not alter stdin or reserve a place in the queue. Call
 * {@link acquire} to request an exclusive turn:
 *
 * ```ts
 * const session = new KeyInputSession((key, release) => {
 *     if (key.type === 'enter') {
 *         release();
 *     }
 * });
 *
 * const result = await session.acquire();
 *
 * if (result.acquired) {
 *     // This session owns stdin and receives parsed keys.
 * }
 * ```
 *
 * Requests made through the shared controller are serialized. When this
 * session reaches the front of its queue, the controller prepares stdin and
 * routes incoming chunks to its parser. Successful setup changes the status
 * to `Ready`.
 *
 * A normal session follows:
 *
 * ```text
 * Pending → Queued → Starting → Ready → Releasing → Released
 * ```
 *
 * A request may instead become `Cancelled` before acquiring stdin, or
 * `Failed` if stream setup or cleanup fails.
 *
 * ---------------------------------------------------------------------
 * 🔷 KEY CONSUMER
 * ---------------------------------------------------------------------
 *
 * The constructor callback receives each parsed key and a function that ends
 * this session:
 *
 * ```ts
 * const session = new KeyInputSession((key, release) => {
 *     switch (key.type) {
 *         case 'character':
 *             // Update consumer-owned input state.
 *             break;
 *
 *         case 'backspace':
 *             // Edit consumer-owned input state.
 *             break;
 *
 *         case 'enter':
 *             release();
 *             break;
 *     }
 * });
 * ```
 *
 * The consumer decides what each key means and when to finish. The callback
 * is invoked synchronously for each dispatched key; promises returned from
 * it are not awaited.
 *
 * The callback's `release` function and the public {@link release} method
 * follow the same state-aware behavior. While the session is `Ready`, they
 * release the active turn. While it is `Pending` or `Queued`, they cancel the
 * request so it cannot acquire stdin later.
 *
 * ---------------------------------------------------------------------
 * 🔷 ACQUISITION RESULT
 * ---------------------------------------------------------------------
 *
 * {@link acquire} resolves with an {@link InputAcquisitionResult}:
 *
 * - `{ acquired: true }` means the session reached `Ready` and owns stdin.
 * - `{ acquired: false, reason: 'session_cancelled' }` means it was canceled
 *   before acquiring the stream.
 *
 * Cancellation before acquisition is normal control flow and is represented
 * by the result union. Failures while configuring stdin reject the promise.
 * Acquisition is one-shot and is valid only while status is `Pending`.
 *
 * ---------------------------------------------------------------------
 * 🔷 RELEASE AND STREAM CLEANUP
 * ---------------------------------------------------------------------
 *
 * Releasing a `Ready` session stops the controller from routing subsequent
 * stdin chunks to this parser immediately. The controller then pauses stdin
 * and restores cooked mode before starting the next queued session. The
 * release call returns without waiting for that cleanup to finish.
 *
 * Releasing a `Pending` or `Queued` session cancels the request instead.
 * Release does not interrupt parsing already underway; keys remaining in a
 * chunk already delivered to the parser may still be dispatched. The parser
 * is not reset when a session ends.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * - `StdinController` owns the shared stream, queue, and stream lifecycle.
 * - `KeyInputParser` converts raw chunks into normalized keys.
 * - `KeyInputSession` connects one controller session and parser to one
 *   consumer.
 * - The consumer owns interaction state and key semantics.
 *
 * @internal
 * @since 1.0.0
 */
class KeyInputSession {
    /**
     * Converts raw chunks routed to this session into normalized keys.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_parser = new KeyInputParser();

    /**
     * Session through which this key-input session requests exclusive stdin
     * access.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_session: StdinSession;

    /**
     * Connects parsed keys to the consumer and exposes the session release
     * operation to that callback.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_keyInputHandlers: StdinKeyInputHandlers = {
        system: (key) => {
            this.#_keyInputHandlers.consumer?.(key, this.#_release);
        }
    }

    /**
     * Creates a parser and a pending session with the shared stdin
     * controller.
     *
     * Construction is passive: it does not start the session or reserve its
     * place in the controller queue. The session is queued when {@link acquire}
     * is called.
     *
     * @param keyInputHandler - Receives each parsed key and a function that
     * releases this session. The handler is called synchronously; returned
     * promises are not awaited.
     * @since 1.0.0
     */
    constructor(keyInputHandler: StdinKeyInputConsumerHandler) {
        this.#_keyInputHandlers.consumer = keyInputHandler;

        this.#_session = stdinController.createSession(this.#_parser.dataParser);
        this.#_parser.onKeyInput(this.#_keyInputHandlers.system);
    }

    /**
     * Routes release requests according to the session's current lifecycle.
     *
     * A ready session is released; a pending or queued session is canceled so
     * it cannot acquire stdin after the consumer has ended its request.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_release = () => {
        if (this.#_session.status === 'Ready') {
            this.#_session.release();
        } else {
            this.#_session.cancel();
        }
    }

    /**
     * Gets the current lifecycle status of this key-input session.
     *
     * `Ready` means this session currently owns stdin. Use the result of
     * {@link acquire} to distinguish ownership from cancellation before
     * acquisition.
     *
     * @returns The current stdin session status.
     * @since 1.0.0
     */
    get status() { return this.#_session.status; }

    /**
     * Requests this key-input session's one exclusive stdin turn.
     *
     * If another session owns stdin, this request waits in the controller's
     * queue. On completion, the promise resolves with an
     * {@link InputAcquisitionResult}: `acquired: true` means this session is
     * `Ready` and owns stdin; `acquired: false` means it was canceled before
     * acquiring the stream.
     *
     * A queued cancellation fulfills the underlying start signal without
     * acquiring stdin, so this method resolves with
     * `{ acquired: false, reason: 'session_cancelled' }`. A stream setup
     * failure rejects the promise.
     *
     * This is a one-shot operation. It is valid only while status is `Pending`;
     * calling it a second time or after canceling the pending session rejects
     * with an invariant error.
     *
     * @returns A promise for the acquisition outcome.
     * @throws {Error} If called when the session is not `Pending`, or if the
     * controller fails while preparing stdin.
     * @since 1.0.0
     */
    async acquire(): Promise<InputAcquisitionResult> {
        await this.#_session.start();

        if (this.#_session.status === 'Ready') {
            return { acquired: true }
        } else {
            return { acquired: false, reason: 'session_cancelled' }
        }
    }

    /**
     * Releases this key-input session's turn, or cancels its request if stdin
     * has not been acquired yet.
     *
     * If the session is `Ready`, this synchronously stops routing new chunks
     * to it and signals the controller to perform asynchronous stream cleanup.
     * If the session is `Pending` or `Queued`, this cancels the request so it
     * cannot acquire stdin later. Calling this method after the session has
     * already ended has no effect on another session.
     *
     * The method does not wait for controller cleanup to finish. It also does
     * not interrupt parsing of chunks already delivered to this session.
     *
     * @returns `void`
     * @since 1.0.0
     */
    release() {
        this.#_release();
    }
}

export default KeyInputSession;