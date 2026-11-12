
import TerminalSizeDispatcher from "./dispatchers/terminalSize.dispatcher";
import CursorPositionDispatcher from "./dispatchers/cursorPosition.dispatcher";
import { TasksQueue, type BaseQueueTask } from "@nasriya/atomix/tools";
import type { CursorPosition, TerminalSize } from "./types";

/**
 * Coordinates terminal cursor-position and terminal-size requests through one
 * automatically running task queue.
 *
 * The manager is the queue-facing layer for the concrete query dispatchers.
 * It creates one {@link CursorPositionDispatcher} and one
 * {@link TerminalSizeDispatcher}, then submits work to those instances from
 * {@link cursorPosition} and {@link terminalSize}. The dispatchers perform the
 * terminal protocol work: writing the ANSI query, parsing streamed stdin
 * input, managing raw mode, applying their response timeout, and restoring
 * terminal input state before their promises settle.
 *
 * Serializing requests through one queue prevents these operations from
 * registering competing response listeners on stdin or overlapping their
 * input-state cleanup. The manager itself does not parse terminal responses,
 * write query sequences, or manipulate raw mode.
 *
 * ---------------------------------------------------------------------
 * 🔷 QUEUE AND TASK MODEL
 * ---------------------------------------------------------------------
 *
 * The manager creates one `TasksQueue` with `autoRun: true`. Each public query
 * method creates a promise and adds a task to that queue. A task contains:
 *
 * - a task type identifying cursor-position or terminal-size work
 * - priority `0`
 * - an action that calls the matching dispatcher's `dispatch()` method
 * - `onResolve` and `onReject` callbacks connected to the method's promise
 *
 * Both query types use this same queue, so their execution is coordinated by
 * the queue's scheduling behavior. The manager does not expose queue controls,
 * retry tasks, or provide a method for stopping or clearing pending work.
 *
 * ---------------------------------------------------------------------
 * 🔷 DISPATCHERS AND RESPONSE TIMEOUTS
 * ---------------------------------------------------------------------
 *
 * Dispatcher instances are created with the manager and reused for their
 * respective query type. The concrete cursor-position and terminal-size
 * dispatchers each use a default response timeout of `500` milliseconds.
 * The public manager methods do not accept a timeout argument and do not
 * override that dispatcher configuration.
 *
 * A dispatcher's timeout starts when its queued action begins. Time spent
 * waiting for an earlier queue task does not consume the response timeout.
 * The manager does not add a separate deadline around queue wait time.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESULT AND FAILURE PROPAGATION
 * ---------------------------------------------------------------------
 *
 * Each method returns its own promise. The queue task's `onResolve` callback
 * resolves that promise with the dispatcher's parsed result, and `onReject`
 * rejects it with the task failure. The dispatcher results are frozen
 * `CursorPosition` or `TerminalSize` values; the manager does not transform
 * them.
 *
 * Failures from dispatching, response parsing, timeout, or terminal cleanup
 * are propagated through the task's rejection callback. The dispatcher may
 * combine a query failure with a cleanup failure in an `AggregateError`.
 *
 * @since 1.0.0
 */
class TerminalQueryManager {
    /**
     * Shared automatically running queue used by both terminal query methods.
     *
     * Reusing one queue serializes terminal requests that temporarily listen
     * to the same stdin stream.
     *
     * @since 1.0.0
     */
    readonly #_queue = new TasksQueue({ autoRun: true });

    /**
     * Reusable dispatchers for cursor-position and terminal-size requests.
     *
     * Each dispatcher owns its protocol-specific response parser and uses its
     * concrete class's `500` millisecond default response timeout. The public
     * methods enqueue calls to these instances so they share the manager's
     * serialized execution path.
     *
     * @since 1.0.0
     */
    readonly #_queries = {
        cursorPosition: new CursorPositionDispatcher(),
        terminalSize: new TerminalSizeDispatcher()
    }

    /**
     * Queues a query for the terminal's current cursor position.
     *
     * The method adds a priority-`0` task to the shared queue. When the task
     * runs, it calls the cursor-position dispatcher's `dispatch()` method,
     * which requests the terminal's cursor location and resolves with a frozen
     * object containing one-based `row` and `column` coordinates.
     *
     * The dispatcher uses its configured `500` millisecond response timeout.
     * Time waiting for this task to reach the front of the queue is not
     * included, and this method does not accept a timeout override.
     *
     * @returns A promise that resolves to the terminal's current cursor
     * position, or rejects if the queued dispatch fails.
     *
     * @since 1.0.0
     */
    cursorPosition() {
        const { promise, resolve, reject } = Promise.withResolvers<CursorPosition>();

        const task: BaseQueueTask<CursorPosition> = {
            type: 'query-cursor-position',
            priority: 0,
            action: () => this.#_queries.cursorPosition.dispatch(),
            onResolve: resolve,
            onReject: reject
        }

        this.#_queue.addTask(task);
        return promise;
    }

    /**
     * Queues a query for the terminal's current dimensions.
     *
     * The method adds a priority-`0` task to the shared queue. When the task
     * runs, it calls the terminal-size dispatcher's `dispatch()` method,
     * which requests the current window dimensions and resolves with a frozen
     * object containing `height` and `width` in character cells.
     *
     * The dispatcher uses its configured `500` millisecond response timeout.
     * Time waiting for this task to reach the front of the queue is not
     * included, and this method does not accept a timeout override.
     *
     * @returns A promise that resolves to the terminal's current dimensions,
     * or rejects if the queued dispatch fails.
     *
     * @since 1.0.0
     */
    terminalSize() {
        const { promise, resolve, reject } = Promise.withResolvers<TerminalSize>();

        const task: BaseQueueTask<TerminalSize> = {
            type: 'query-terminal-size',
            priority: 0,
            action: () => this.#_queries.terminalSize.dispatch(),
            onResolve: resolve,
            onReject: reject
        }

        this.#_queue.addTask(task);
        return promise;
    }
}

export default TerminalQueryManager;