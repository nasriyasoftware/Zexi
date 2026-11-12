import terminalIO from "../..";
import terminalStreams from "../streams";
import ZexiPromise from "../../../../shared/utils/zexi.promise";

/**
 * Detects terminal dimension changes by periodically querying the terminal.
 *
 * The detector maintains the most recently detected terminal width and height.
 * It performs an immediate query on its first polling iteration and continues
 * checking for changes at 500-millisecond intervals.
 *
 * Whenever a successful query reports dimensions different from the stored
 * values, the detector updates its dimensions and emits a `resize` event
 * through the terminal event system.
 *
 * The detector supports starting and stopping polling explicitly. Its initial
 * polling iteration can be awaited to ensure the first query has completed.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The initial dimensions are obtained from stdout:
 *
 * - `columns` provides the initial width.
 * - `rows` provides the initial height.
 *
 * If either dimension is unavailable, the detector uses the corresponding
 * fallback value:
 *
 * - Width: `80` columns.
 * - Height: `24` rows.
 *
 * The detector registers a process exit handler that invokes `stop()` to
 * cancel any pending polling timer.
 *
 * ---------------------------------------------------------------------
 * 🔷 POLLING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * When `run()` is called:
 *
 * - The detector creates an identifier for the active polling run.
 * - The first-ever polling iteration starts immediately.
 * - Subsequent iterations are scheduled at 500-millisecond intervals.
 * - Each iteration queries the terminal with a timeout of 1000 milliseconds.
 * - The polling loop continues until its run identifier is cleared.
 *
 * Polling timers are unreferenced so that they do not, by themselves, prevent
 * the Node.js process from exiting.
 *
 * ---------------------------------------------------------------------
 * 🔷 DIMENSION CHANGE DETECTION
 * ---------------------------------------------------------------------
 *
 * A successful query is compared against the stored width and height.
 *
 * If both dimensions are unchanged, no state update or `resize` event occurs.
 *
 * If either dimension changes:
 *
 * - The stored width and height are updated.
 * - A `resize` event is emitted with the newly detected dimensions.
 *
 * Query results belonging to an outdated polling task are ignored.
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR HANDLING
 * ---------------------------------------------------------------------
 *
 * If the terminal size query fails, the detector retains its most recently
 * stored dimensions and continues polling.
 *
 * Errors raised while processing a polling task are ignored, and the task is
 * resolved in the `finally` block so that the polling loop can continue.
 *
 * Errors that escape the polling loop are forwarded to the promise returned
 * by `run()`.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEANUP
 * ---------------------------------------------------------------------
 *
 * Calling `stop()` invalidates the active polling run.
 *
 * Cleanup:
 *
 * - clears the active polling identifier
 * - cancels a pending polling timer
 * - resolves the current polling task, if one exists
 *
 * Resolving the current task allows the polling loop to finish its current
 * iteration and terminate.
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN VALUE
 * ---------------------------------------------------------------------
 *
 * The `width` and `height` getters expose the most recently stored dimensions.
 *
 * The promise returned by `run()` resolves after the initial polling iteration
 * completes. Calling `run()` while polling is already active returns the
 * promise associated with the current startup operation.
 *
 * @since 1.0.0
 */
export class TerminalSizeDetector {
    /**
     * Stores the most recently detected terminal dimensions.
     *
     * The initial values are obtained from stdout, falling back to standard
     * terminal dimensions when the corresponding values are unavailable.
     *
     * @since 1.0.0
     */
    readonly #_dimentions = {
        width: terminalStreams.output.columns ?? 80,
        height: terminalStreams.output.rows ?? 24
    }

    /**
     * Represents the currently active polling task.
     *
     * The task identifies a single polling iteration and provides a promise
     * that allows the polling loop to wait until the iteration completes.
     *
     * @since 1.0.0
     */
    #_task: ZexiPromise | null = null;

    /**
     * Identifies the active polling run.
     *
     * The identifier is created when polling starts and captured by the
     * polling loop. Clearing or replacing it invalidates that loop and causes
     * it to terminate after the current iteration completes.
     *
     * @since 1.0.0
     */
    #_runId: symbol | null = null;

    /**
     * Holds the timer scheduled before the next polling iteration.
     *
     * The timer is cleared when polling stops. It is unreferenced so that the
     * pending delay does not, by itself, prevent the Node.js process from
     * exiting.
     *
     * @since 1.0.0
     */
    #_timeout: NodeJS.Timeout | null = null;

    /**
     * Indicates whether the first-ever polling iteration is pending.
     *
     * The initial iteration runs immediately. Once this flag is cleared, later
     * polling iterations use the configured delay.
     *
     * @since 1.0.0
     */
    #_isFirstRun = true;

    /**
     * Indicates whether a stop operation is currently being processed.
     *
     * This flag prevents re-entrant stop operations while the detector is
     * invalidating the active run and clearing its pending resources.
     *
     * @since 1.0.0
     */
    #_processing = false;

    /**
     * Promise associated with the completion of the initial polling iteration.
     *
     * The promise is created when `run()` starts a new polling run and is
     * returned to callers waiting for the initial query to finish.
     *
     * @since 1.0.0
     */
    #_started: Promise<void> | null = null;

    /**
     * Provides operations for querying terminal dimensions and processing
     * polling tasks.
     *
     * The processor queries the terminal, rejects outdated results, updates
     * stored dimensions when changes are detected, and emits the corresponding
     * `resize` event.
     *
     * ---------------------------------------------------------------------
     * 🔷 QUERY PROCESSING
     * ---------------------------------------------------------------------
     *
     * Each query is associated with a polling task identifier.
     *
     * Before applying the result, the processor verifies that the identifier
     * still belongs to the current task. This prevents results from outdated
     * tasks from modifying the stored dimensions.
     *
     * If the query fails, the last known dimensions are used as the fallback.
     *
     * ---------------------------------------------------------------------
     * 🔷 TASK SETTLEMENT
     * ---------------------------------------------------------------------
     *
     * Each polling task is resolved when processing finishes, regardless of
     * whether the query succeeds or an error is caught.
     *
     * This allows the polling loop to proceed to its next iteration.
     *
     * @since 1.0.0
     */
    readonly #_query = {
        /**
         * Queries the terminal and updates the stored dimensions when a change
         * is detected.
         *
         * The query uses a timeout of 500 milliseconds. If the query fails,
         * the current dimensions are retained.
         *
         * Results are ignored when the supplied identifier does not match the
         * currently active polling task, or when the dimensions are unchanged.
         *
         * @param id - Identifier of the polling task being processed.
         *
         * @since 1.0.0
         */
        processor: async (id: symbol) => {
            const size = await terminalIO.input.query.terminalSize().catch(() => ({ width: this.width, height: this.height }));

            if (
                id !== this.#_task?.id ||
                (
                    size.width === this.#_dimentions.width &&
                    size.height === this.#_dimentions.height
                )
            ) { return; }

            this.#_dimentions.width = size.width;
            this.#_dimentions.height = size.height;

            await terminalIO.events.emit('resize', size);
        },

        /**
         * Executes a polling task and resolves it after processing completes.
         *
         * Any error raised during query processing is ignored. The task is
         * resolved in the `finally` block, ensuring that the polling loop is
         * not left waiting for a failed query.
         *
         * @param task - Polling task to execute.
         *
         * @since 1.0.0
         */
        run: async (task: ZexiPromise) => {
            const { id, resolve } = task;

            try {
                await this.#_query.processor(id);
            } catch (error) {
                // Ignore the error.
            } finally {
                resolve();
            }
        }
    }

    /**
     * Runs the polling loop for the active polling run.
     *
     * The loop creates a new task for each iteration and waits for that task
     * to complete before proceeding. The initial iteration runs immediately
     * when the detector is first started; subsequent iterations are delayed.
     *
     * The startup callback is invoked once, after the first task completes.
     *
     * ---------------------------------------------------------------------
     * 🔷 POLLING LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * Each loop iteration:
     *
     * - creates a new `ZexiPromise` task
     * - starts the query immediately or schedules it after a delay
     * - waits for the task to resolve
     * - clears the task reference if it still points to the completed task
     *
     * The loop terminates when the active run identifier no longer matches
     * the identifier captured at the beginning of the method.
     *
     * ---------------------------------------------------------------------
     * 🔷 STARTUP NOTIFICATION
     * ---------------------------------------------------------------------
     *
     * The supplied callback is invoked after the first polling task completes.
     * This allows `run()` to resolve its startup promise without waiting for
     * subsequent polling iterations.
     *
     * @param onStarted - Callback invoked after the initial polling iteration
     * completes.
     *
     * @since 1.0.0
     */
    async #_process(onStarted: () => void) {
        const runId = this.#_runId;
        let isFirstTask = true;

        while (this.#_runId === runId) {
            const task = this.#_task = new ZexiPromise();

            try {
                if (this.#_isFirstRun) {
                    this.#_isFirstRun = false;
                    void this.#_query.run(task);
                } else {
                    this.#_timeout = setTimeout(async () => {
                        this.#_timeout = null;
                        void this.#_query.run(task);
                    }, 500);

                    this.#_timeout.unref();
                }

                await task.promise;

                if (isFirstTask) {
                    isFirstTask = false;
                    onStarted();
                }
            } finally {
                if (this.#_task === task) {
                    this.#_task = null;
                }
            }
        }
    }

    /**
     * Creates the detector and registers a process exit handler.
     *
     * The exit handler invokes `stop()` to clear any pending polling timer
     * and invalidate the active polling run before the process exits.
     *
     * @since 1.0.0
     */
    constructor() {
        process.on('exit', () => this.stop());
    }

    /**
     * Gets the most recently detected terminal width.
     *
     * The value is initialized from stdout when available and updated whenever
     * a successful query detects a width change.
     *
     * @returns The terminal width in columns.
     *
     * @since 1.0.0
     */
    get width() { return this.#_dimentions.width; }

    /**
     * Gets the most recently detected terminal height.
     *
     * The value is initialized from stdout when available and updated whenever
     * a successful query detects a height change.
     *
     * @returns The terminal height in rows.
     *
     * @since 1.0.0
     */
    get height() { return this.#_dimentions.height; }

    /**
     * Starts terminal dimension polling.
     *
     * If polling is already active, the existing startup promise is returned
     * when available. Otherwise, a new polling run is created.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION
     * ---------------------------------------------------------------------
     *
     * Starting a new run:
     *
     * - assigns a unique identifier to the run
     * - creates a promise for the initial polling iteration
     * - starts the polling loop
     *
     * The initial query runs immediately on the detector's first-ever run.
     * Subsequent iterations are scheduled at 500-millisecond intervals.
     *
     * ---------------------------------------------------------------------
     * 🔷 RETURN VALUE
     * ---------------------------------------------------------------------
     *
     * The returned promise resolves after the initial polling iteration
     * completes. It does not wait for the polling loop to stop.
     *
     * If an error escapes the polling loop before startup completes, the
     * returned promise is rejected with that error.
     *
     * @returns Promise resolved when the initial polling iteration completes.
     *
     * @since 1.0.0
     */
    run(): Promise<void> {
        if (this.#_runId || this.#_processing) {
            return this.#_started ?? Promise.resolve();
        }

        this.#_runId = Symbol();
        const started = Promise.withResolvers<void>();
        this.#_started = started.promise;
        void this.#_process(started.resolve).catch(started.reject);

        return started.promise;
    }

    /**
     * Stops terminal dimension polling.
     *
     * If no polling run is active, or another stop operation is being
     * processed, this method returns without making changes.
     *
     * ---------------------------------------------------------------------
     * 🔷 CLEANUP
     * ---------------------------------------------------------------------
     *
     * Stopping the detector:
     *
     * - marks the detector as processing a stop operation
     * - invalidates the active polling run
     * - clears the pending polling timer, if one exists
     * - resolves the active polling task, if one exists
     * - clears the processing flag
     *
     * Resolving the active task releases the polling loop if it is waiting
     * for that task to complete. The invalidated run identifier prevents the
     * loop from starting another iteration.
     *
     * An already-running terminal size query may still complete, but its result
     * is ignored if its task is no longer current.
     *
     * @since 1.0.0
     */
    stop() {
        if (!this.#_runId || this.#_processing) { return }
        this.#_processing = true;
        this.#_runId = null;

        if (this.#_timeout) {
            clearTimeout(this.#_timeout);
            this.#_timeout = null;
        }

        if (this.#_task) {
            this.#_task.resolve();
            this.#_task = null;
        }

        this.#_processing = false;
    }
}