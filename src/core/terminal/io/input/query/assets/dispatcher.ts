import atomix from "@nasriya/atomix";
import terminalIO from "../../..";
import terminalInput from "../../input.io";
import ZexiPromise from "../../../../../shared/utils/zexi.promise";
import { StdinSession } from "../../assets";
import type { QueryDispatchConfig, QueryHandler, SettleHandler, Settler } from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Coordinates one terminal query and its response over the shared stdin stream.
 *
 * A dispatcher binds one terminal query to a protocol-specific response
 * handler. It writes the query through {@link terminalIO}, routes stdin chunks
 * to that handler, and settles with the value produced by the handler. It does
 * not configure stdin directly. Instead, it requests a session from the shared
 * {@link terminalInput}, which serializes this request with other consumers
 * that also use the controller.
 *
 * Concrete subclasses supply the query bytes, a diagnostic description, a
 * response handler, and optionally a response timeout through
 * {@link QueryDispatchConfig}.
 *
 * ---------------------------------------------------------------------
 * 🔷 DISPATCH LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * A call to {@link dispatch} follows this sequence:
 *
 * 1. If this instance already has an unsettled request, return its promise
 *    instead of creating another session or writing the query again.
 * 2. Create the request's promise settler and a stdin session whose handler
 *    forwards input chunks to the configured response parser.
 * 3. Call `session.start()`. The controller queues the session and resolves
 *    its start signal when this request owns stdin. Time spent waiting for
 *    another session does not count against this dispatcher's response timeout.
 * 4. Confirm that the session status is `Ready`. If the session was canceled
 *    before acquiring stdin, reject the request without writing the query.
 * 5. Start the response timeout and write the configured query through
 *    {@link terminalIO.output.write}.
 * 6. Route each received `Buffer` to the configured handler. A recognized
 *    response resolves the request; a parser exception, write failure, start
 *    failure, or timeout rejects it.
 * 7. Clear the response timer and signal the session to release stdin. The
 *    dispatcher promise settles after sending that signal; the controller
 *    completes stream cleanup before it grants the next queued session.
 *
 * Signaling release and completing stream cleanup are separate events. The
 * dispatcher does not wait for raw mode to be disabled before settling its
 * query promise. The controller retains the active queue task until its
 * listener removal, pause, and cooked-mode restoration have completed, so a
 * later session cannot take ownership during that cleanup.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE HANDLING
 * ---------------------------------------------------------------------
 *
 * The configured {@link QueryHandler} receives each raw `Buffer` chunk and a
 * resolve callback. It is responsible for buffering partial input, recognizing
 * a complete response, and passing the parsed value to that callback. The
 * dispatcher does not parse terminal protocols or redistribute unmatched
 * bytes to other consumers. The stdin controller installs this handler only
 * while this session owns the stream.
 *
 * The handler is expected to be synchronous. If it throws while processing a
 * chunk, the active request is rejected and its session is signaled to finish.
 * Calling the resolve callback more than once has no effect after the request
 * has begun settling.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUTS AND REUSE
 * ---------------------------------------------------------------------
 *
 * The response timeout defaults to `1000` milliseconds. A configured timeout
 * must be an integer from `0` through `2_147_483_647`, inclusive. The timer
 * starts only after the session becomes `Ready` and immediately before the
 * query is written. Waiting in the stdin controller's queue is excluded. A
 * timeout of `0` is accepted and follows Node.js `setTimeout` scheduling
 * semantics.
 *
 * After its active request settles, a dispatcher instance can be used again.
 * Protocol-specific subclasses may keep parser buffers in closures and are
 * responsible for resetting or trimming that state between requests.
 *
 * ---------------------------------------------------------------------
 * 🔷 FAILURE AND SETTLEMENT
 * ---------------------------------------------------------------------
 *
 * The returned promise rejects if the session cannot be acquired, if the
 * session is not `Ready` when its start signal fulfills, if writing the query
 * fails, if the response handler throws, or if the response timeout expires.
 * A synchronous error while releasing or canceling the session is also
 * surfaced; when both the request and cleanup fail, they are combined in an
 * `AggregateError`.
 *
 * The dispatcher observes the session's start promise and converts a start
 * rejection into a rejected query promise. Once the query settles, it signals
 * release or cancellation and relinquishes its reference to the session. Any
 * asynchronous stream-cleanup failure belongs to the controller's queue
 * lifecycle; the dispatcher does not wait for that cleanup or include it in
 * the query result.
 *
 * @typeParam T - Value produced by the protocol-specific response handler.
 * @internal Shared base class for terminal query dispatchers.
 * @since 1.0.0
 */
abstract class QueryDispatcher<T> {
    /**
     * Query text or bytes written when the session acquires stdin.
     *
     * The value is passed unchanged to {@link terminalIO.output.write} after the
     * controller signals that this dispatcher owns the input stream. It may be
     * a string or an already encoded byte sequence.
     *
     * @since 1.0.0
     */
    readonly #_query: string | Uint8Array;

    /**
     * Protocol-specific parser invoked for every stdin data chunk.
     *
     * The handler recognizes and parses a complete response, then calls the
     * active request's resolve callback with the parsed value. Buffering and
     * protocol validation remain the handler's responsibility.
     *
     * @since 1.0.0
     */
    readonly #_queryHandler: QueryHandler<T>;

    /**
     * Human-readable name for this query operation.
     *
     * The description is included in timeout, setup, and cleanup diagnostics so
     * failures identify the terminal operation that could not be completed.
     *
     * @since 1.0.0
     */
    readonly #_description: string;

    /**
     * Maximum response-wait duration in milliseconds.
     *
     * The default is `1000`. The constructor replaces it only after validating
     * a configured timeout as an integer in the supported Node.js timer range.
     *
     * @since 1.0.0
     */
    #_timeoutPeriod: number = 1000;

    /**
     * Timer for the active response wait, or `null` when no timer is pending.
     *
     * The timer is created only after the stdin session becomes `Ready` and is
     * cleared whenever the request begins settlement.
     *
     * @since 1.0.0
     */
    #_timeout: NodeJS.Timeout | null = null;

    /**
     * Stdin session used by the active request, or `null` when this dispatcher
     * has no session reference.
     *
     * The controller owns session ordering and stream setup. This field lets
     * request cleanup release a ready session or cancel a session that did not
     * acquire stdin.
     *
     * @since 1.0.0
     */
    #_session: StdinSession | null = null;

    /**
     * Promise and callbacks for the active request, or `null` while idle.
     *
     * Its presence prevents duplicate calls to {@link dispatch} from enqueuing
     * another session or sending the same query twice. It is cleared after the
     * request settles, allowing the instance to be reused.
     *
     * @since 1.0.0
     */
    #_settler: Settler<T> | null = null;

    /**
     * Operations shared by request creation, response handling, and settlement.
     *
     * These closures use the dispatcher's current session, timer, handler, and
     * settler so that all response, timeout, and failure paths clean up the same
     * active request.
     *
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Creates the promise and guarded settlement callbacks for one query.
         *
         * The local `settling` flag prevents a response and timeout from
         * initiating cleanup at the same time. The `ZexiPromise` settlement
         * state provides a second guard so only the first resolve or reject
         * takes effect. Settlement clears the response timer and signals the
         * session lifecycle before resolving or rejecting the query promise.
         *
         * If that synchronous cleanup step throws while a request is already
         * rejecting, both errors are preserved in an `AggregateError`. If the
         * request had a response value, a cleanup error rejects instead of
         * returning that value. The active settler reference is cleared only if
         * it still points to the promise created here.
         *
         * @returns The active request promise and its resolve/reject callbacks.
         * @since 1.0.0
         */
        createSettler: () => {
            const ct = new ZexiPromise<T>();

            let settling = false;
            const settle: SettleHandler<T> = async (status, value) => {
                if (ct.settled || settling) { return }
                settling = true;

                try {
                    this.#_helpers.cleanup();

                    if (status === 'resolve') {
                        ct.resolve(value as T);
                    } else {
                        ct.reject(value);
                    }
                } catch (cleanupError) {
                    if (status === 'reject') {
                        ct.reject(
                            new AggregateError(
                                [value, cleanupError],
                                `Unable to ${this.#_description}, and terminal cleanup also failed.`
                            )
                        );
                    } else {
                        ct.reject(cleanupError);
                    }
                } finally {
                    if (this.#_settler?.promise === ct.promise) {
                        this.#_settler = null;
                    }

                    settling = false;
                }
            }

            const settler = this.#_settler = {
                promise: ct.promise,
                resolve: (value: T) => settle('resolve', value),
                reject: (error: unknown) => settle('reject', error)
            };

            return settler;
        },
        /**
         * Clears request timing and signals the stdin session to finish.
         *
         * Cleanup clears the response timer first. If the session is `Ready`,
         * it calls `release()`; otherwise, it calls `cancel()`. This covers a
         * session canceled while waiting as well as a session that did not
         * reach the ready state. The session reference is then cleared.
         *
         * These calls signal the controller; they do not await the controller's
         * asynchronous listener removal, pause, or raw-mode restoration. The
         * controller keeps the queue turn until that work completes.
         *
         * @since 1.0.0
         */
        cleanup: () => {
            if (this.#_timeout) {
                clearTimeout(this.#_timeout);
                this.#_timeout = null;
            }

            if (this.#_session) {
                if (this.#_session.status === 'Ready') {
                    this.#_session.release();
                } else {
                    this.#_session.cancel();
                }

                this.#_session = null;
            }
        },
        /**
         * Routes one raw stdin chunk to the current protocol parser.
         *
         * The handler requires an active settler because it is registered only
         * for an active session. A missing settler indicates that the listener
         * outlived the request that installed it and is treated as an invariant
         * violation. Synchronous parser errors reject the active request.
         *
         * @param data - Raw bytes delivered by the controller's stdin session.
         * @since 1.0.0
         */
        dataHandler: (data: Buffer) => {
            const settler = this.#_settler;

            if (!settler) {
                throw new Error(`Invariant violation: The data handler was not removed before the settler is removed.`)
            }

            try {
                this.#_queryHandler(data, settler.resolve);
            } catch (err) {
                settler.reject(err);
            }
        }
    }

    /**
     * Creates a dispatcher for one query and its response protocol.
     *
     * The configuration supplies the query bytes, parser, and diagnostic
     * description. When `timeout` is provided, it must be an integer from `0`
     * through `2_147_483_647` milliseconds, inclusive. If omitted, the
     * dispatcher uses a `1000` millisecond response timeout.
     *
     * @param config - Query bytes, response handler, diagnostic description,
     * and optional response timeout.
     * @throws {TypeError} If the timeout is not a number or not an integer.
     * @throws {RangeError} If the timeout is outside the supported timer range.
     * @since 1.0.0
     */
    constructor(config: QueryDispatchConfig<T>) {
        this.#_query = config.query;
        this.#_queryHandler = config.handler;
        this.#_description = config.description;

        if (hasOwnProp(config, 'timeout')) {
            const timeout = config.timeout;

            if (!atomix.valueIs.number(timeout)) {
                throw new TypeError(`Expected the timeout duration value (config.timeout) to be a number, but got ${typeof timeout}`)
            }

            if (!atomix.valueIs.integer(timeout)) {
                throw new TypeError(`Expected the timeout duration value (config.timeout) to be an integer, but got ${timeout}`);
            }

            const limits = {
                min: 0,
                max: 2_147_483_647
            }

            if (timeout < limits.min) {
                throw new RangeError(`Expected the timeout duration value (config.timeout) to greater than ${limits.min}, but instead got ${timeout}`)
            }

            if (timeout > limits.max) {
                throw new RangeError(`Expected the timeout duration value (config.timeout) to be less than ${limits.max}, but instead got ${timeout}`)
            }

            this.#_timeoutPeriod = timeout;
        }
    }

    /**
     * Queues the query, writes it when this dispatcher owns stdin, and returns
     * the promise for its parsed response.
     *
     * If this instance already has a request in progress, the same request
     * promise is returned. Otherwise, this method creates a session with the
     * shared stdin controller and requests its queue turn. The query and
     * response timeout begin only after the session reaches `Ready`; queue wait
     * time is not included in the timeout.
     *
     * The configured response handler receives stdin chunks until it recognizes
     * a complete response. A response, timeout, parser error, write error, or
     * session-start failure settles the returned promise. Settlement signals
     * session release or cancellation immediately. The controller completes
     * stream cleanup before granting the next stdin session, but this promise
     * does not wait for raw mode to be disabled.
     *
     * @returns A promise that resolves with the parsed response value.
     * @since 1.0.0
     */
    dispatch() {
        if (this.#_settler) {
            return this.#_settler.promise;
        }

        // Create a promise settler
        const settler = this.#_helpers.createSettler();

        const session = this.#_session = terminalInput.createSession(this.#_helpers.dataHandler);

        session.start().then(() => {
            if (session.status !== 'Ready') {
                const error = new Error(`Invariant violation: The "${this.#_description}" session was "${session.status}", when the query was dispatched.`);
                settler.reject(error);
                return;
            }

            try {
                this.#_timeout = setTimeout(() => {
                    settler?.reject(new Error(`[Timeout Error]: Unable to ${this.#_description}`));
                }, this.#_timeoutPeriod);

                // Unref the timeout to prevent it from blocking the event loop
                this.#_timeout.unref();

                // Send the query
                terminalIO.output.write(this.#_query);
            } catch (err) {
                settler.reject(err);
            }
        }).catch(err => {
            const error = new AggregateError([
                err,
                new Error(`[Internal Error]: Unable to ${this.#_description}`)
            ]);

            settler.reject(error);
        })

        return settler.promise;
    }
}

export default QueryDispatcher;