import ScreenEngine from "../screen/engine";
import { EventEmitter, TasksQueue } from "@nasriya/atomix/tools";
import type { TerminalEvents } from "../events/types";

/**
 * Internal controller for the Zexi terminal subsystem.
 *
 * `ZexiTerminalController` provides the shared runtime services used by the
 * terminal API.
 *
 * The controller centralizes the stateful components that must be shared
 * across terminal instances, including:
 *
 * - the screen rendering engine
 * - the terminal event emitter
 * - the terminal task queue
 *
 * The controller is instantiated once and exported as the terminal subsystem's
 * shared controller instance.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * The controller acts as the coordination layer between the terminal API and
 * its underlying subsystems.
 *
 * Rather than allowing individual terminal instances to create independent
 * rendering engines, event emitters, or task queues, the controller provides a
 * single shared instance of each service.
 *
 * This ensures that:
 *
 * - all terminal instances render through the same screen engine
 * - all terminal events are dispatched through the same event emitter
 * - terminal operations are coordinated through the same task queue
 *
 * ---------------------------------------------------------------------
 * 🔷 LAZY INITIALIZATION
 * ---------------------------------------------------------------------
 *
 * The screen engine, event emitter, and task queue are initialized lazily.
 *
 * Each service is created only when it is first accessed. Subsequent accesses
 * return the same instance.
 *
 * This avoids allocating terminal subsystems that are not used while keeping
 * their lifetime centralized within the controller.
 *
 * ---------------------------------------------------------------------
 * 🔷 TASK QUEUE
 * ---------------------------------------------------------------------
 *
 * The controller owns a shared {@link TasksQueue} used to serialize terminal
 * operations that cannot safely execute concurrently.
 *
 * This is particularly important for operations that require asynchronous
 * initialization while preserving a synchronous public terminal API.
 *
 * For example, obtaining the terminal's initial cursor position requires
 * asynchronous communication with the terminal. The terminal API does not
 * expose this initialization requirement to callers. Instead, initialization
 * is scheduled in the queue before operations that depend on the established
 * cursor position.
 *
 * The queue therefore acts as the synchronization boundary between:
 *
 * - asynchronous terminal initialization
 * - synchronous terminal API calls
 * - screen rendering operations
 * - terminal clearing operations
 *
 * Queue task identifiers may be used to prevent the same logical operation
 * from being scheduled multiple times.
 *
 * ---------------------------------------------------------------------
 * 🔷 EVENT SYSTEM
 * ---------------------------------------------------------------------
 *
 * The controller owns the shared terminal event emitter.
 *
 * The emitter is configured with an unlimited total handler count so that the
 * terminal event system does not impose an artificial listener limit on
 * consumers.
 *
 * @since 1.0.0
 */
class ZexiTerminalController {
    /**
     * Lazily initialized shared screen rendering engine.
     *
     * The engine is created on first access and reused for the lifetime of the
     * controller.
     *
     * Keeping the engine behind the controller ensures that all terminal
     * instances operate on the same rendered screen state.
     *
     * @since 1.0.0
     */
    #_screenEngine?: ScreenEngine;

    /**
     * Lazily initialized shared terminal event emitter.
     *
     * The emitter dispatches events defined by {@link TerminalEvents}.
     *
     * It is created on first access and configured with an unlimited total
     * handler count.
     *
     * @since 1.0.0
     */
    #_events?: EventEmitter<TerminalEvents>;

    /**
     * Lazily initialized shared terminal task queue.
     *
     * The queue is created only when terminal work needs to be scheduled.
     *
     * Keeping the queue lazy avoids allocating synchronization infrastructure
     * when the terminal subsystem has not yet performed any queued operation.
     *
     * @since 1.0.0
     */
    #_queue?: TasksQueue;

    /**
     * Shared terminal task queue.
     *
     * The queue is initialized lazily on first access and reused for the
     * lifetime of the controller.
     *
     * It coordinates terminal operations that must execute in a controlled
     * order, including operations that depend on asynchronous terminal
     * initialization.
     *
     * Tasks may use priorities to establish ordering between different classes
     * of terminal work, while task identifiers can be used to prevent duplicate
     * logical operations from being scheduled.
     *
     * @returns Shared terminal task queue
     *
     * @since 1.0.0
     */
    get queue(): TasksQueue {
        if (!this.#_queue) {
            this.#_queue = new TasksQueue();
        }

        return this.#_queue;
    }

    /**
     * Shared screen rendering engine.
     *
     * The engine is created lazily on first access.
     *
     * All terminal instances use the same engine, ensuring that screen state
     * and positional rendering remain centralized within the terminal
     * subsystem.
     *
     * @returns Shared screen rendering engine
     *
     * @since 1.0.0
     */
    get screenEngine(): ScreenEngine {
        if (!this.#_screenEngine) {
            this.#_screenEngine = new ScreenEngine();
        }

        return this.#_screenEngine;
    }

    /**
     * Shared terminal event emitter.
     *
     * The emitter is created lazily on first access and is configured to allow
     * an unlimited number of registered handlers.
     *
     * @returns Shared terminal event emitter
     *
     * @since 1.0.0
     */
    get events(): EventEmitter<TerminalEvents> {
        if (!this.#_events) {
            this.#_events = new EventEmitter<TerminalEvents>();
            this.#_events.maxTotalHandlers = Infinity;
        }

        return this.#_events;
    }
}

/**
 * Shared controller instance for the Zexi terminal subsystem.
 *
 * Provides centralized access to the terminal's screen engine, event emitter,
 * and task queue.
 *
 * The instance is intentionally created once and reused throughout the
 * lifetime of the process.
 *
 * @since 1.0.0
 */
const ZexiTerminalControllerInstance = new ZexiTerminalController();

export default ZexiTerminalControllerInstance;