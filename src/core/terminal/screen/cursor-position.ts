/**
 * Immutable terminal cursor-position data.
 *
 * Represents the row and column reported by the terminal in response to an
 * ANSI cursor-position query.
 *
 * Both coordinates follow the ANSI terminal convention:
 *
 * - `row` is one-based
 * - `column` is one-based
 *
 * The value is immutable so that a captured terminal position cannot be
 * modified after it has been established.
 *
 * @since 1.0.0
 */
type CursorPositionData = Readonly<{
    row: number;
    column: number;
}>;

/**
 * Represents the lifecycle state of the cursor-position initializer.
 *
 * The state progresses through the following lifecycle:
 *
 * ```txt
 * standby
 *    │
 *    ▼
 * initializing
 *    │
 *    ├──► ready
 *    │
 *    └──► failed
 *             │
 *             └──► initializing
 * ```
 *
 * `standby`
 * : No initialization attempt has been made, or the initializer is ready
 *   to be attempted again.
 *
 * `initializing`
 * : A terminal cursor-position query is currently in progress.
 *
 * `ready`
 * : The terminal has successfully reported its cursor position and the
 *   position is available synchronously.
 *
 * `failed`
 * : The most recent initialization attempt failed. The initializer may be
 *   attempted again from this state.
 *
 * @since 1.0.0
 */
type CursorState =
    | 'standby'
    | 'initializing'
    | 'ready'
    | 'failed';

/**
 * Queries the terminal for its current cursor position.
 *
 * The terminal is queried using the ANSI Device Status Report sequence
 * (`CSI 6 n`). The terminal responds through `stdin` with a cursor-position
 * report containing the current row and column.
 *
 * This function is the low-level asynchronous operation used by
 * {@link CursorPosition}. It is not intended to be called directly by
 * consumers of the terminal subsystem.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION REQUIREMENTS
 * ---------------------------------------------------------------------
 *
 * The process must be attached to a TTY through `stdin`.
 *
 * The function temporarily:
 *
 * - enables raw input mode
 * - resumes `stdin`
 * - registers a temporary response listener
 * - waits for the terminal's cursor-position response
 *
 * Once the response is received, or the query fails, `stdin` is restored to
 * its previous operational state.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSE HANDLING
 * ---------------------------------------------------------------------
 *
 * The terminal is expected to respond using the ANSI cursor-position report
 * format:
 *
 * ```txt
 * CSI row ; column R
 * ```
 *
 * Only responses matching this format are processed. Unrelated input
 * received while waiting for the terminal response is ignored.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEANUP
 * ---------------------------------------------------------------------
 *
 * The temporary input state is always removed when the query completes.
 *
 * Cleanup:
 *
 * - removes the response listener
 * - disables raw input mode
 * - pauses `stdin`
 * - clears the pending timeout
 *
 * This prevents the cursor-position query from leaving `stdin` in an altered
 * state after initialization completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 TIMEOUT
 * ---------------------------------------------------------------------
 *
 * The query is aborted after one second if no valid cursor-position response
 * is received.
 *
 * When this occurs:
 *
 * - the temporary input listener is removed
 * - raw mode is disabled
 * - `stdin` is paused
 * - the pending timeout is cleared
 * - the returned promise is rejected
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN VALUE
 * ---------------------------------------------------------------------
 *
 * Resolves with an immutable cursor-position object:
 *
 * ```ts
 * {
 *     row: number;
 *     column: number;
 * }
 * ```
 *
 * Both coordinates are one-based, matching the ANSI cursor-position
 * convention.
 *
 * @returns Promise resolving to the current terminal cursor position
 *
 * @throws Error if `stdin` is not attached to a TTY
 * @throws Error if the terminal does not respond within one second
 *
 * @since 1.0.0
 */
const getCursorPosition = (): Promise<CursorPositionData> => {
    return new Promise((resolve, reject) => {
        const stdin = process.stdin;

        if (!stdin.isTTY) {
            reject(new Error('stdin is not a TTY'));
            return;
        }

        const refs = {
            /**
             * Timeout used to abort the cursor-position query if the terminal
             * does not respond within the allowed period.
             *
             * @since 1.0.0
             */
            timeout: null as NodeJS.Timeout | null,

            /**
             * Restores `stdin` to its state before the cursor-position query.
             *
             * Removes the temporary response listener, disables raw mode, and
             * pauses the input stream.
             *
             * @since 1.0.0
             */
            cleanup: () => {
                if (refs.timeout) {
                    clearTimeout(refs.timeout);
                    refs.timeout = null;
                }

                stdin.off('data', refs.onData);
                stdin.setRawMode?.(false);
                stdin.pause();
            },

            /**
             * Handles terminal responses received through `stdin`.
             *
             * The handler waits for an ANSI cursor-position response and ignores
             * unrelated input until a matching response is received.
             *
             * @param data - Data received from the terminal input stream.
             *
             * @since 1.0.0
             */
            onData: (data: Buffer) => {
                const response = data.toString();
                const match = response.match(/\x1b\[(\d+);(\d+)R/);

                if (!match) {
                    return;
                }

                refs.cleanup();

                resolve(Object.freeze({
                    row: Number(match[1]),
                    column: Number(match[2])
                }));
            }
        };

        refs.timeout = setTimeout(() => {
            refs.cleanup();
            reject(new Error('Timeout: No cursor-position response received'));
        }, 1000);

        // Temporarily configure stdin to receive the terminal response
        // without waiting for line-buffered input.
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on('data', refs.onData);

        // Request the terminal's current cursor position.
        process.stdout.write('\x1b[6n');
    });
};

/**
 * Stateful terminal cursor-position manager.
 *
 * `CursorPosition` owns the asynchronous process of obtaining the terminal's
 * initial cursor position while exposing the resulting coordinates through a
 * synchronous interface.
 *
 * The separation between initialization and access is intentional. Obtaining
 * the cursor position requires asynchronous communication with the terminal,
 * but the rendering engine must be able to read the established position
 * synchronously while performing terminal operations.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION MODEL
 * ---------------------------------------------------------------------
 *
 * Initialization is performed through {@link initialize}.
 *
 * The initializer may only begin a new query while in either:
 *
 * - `standby`
 * - `failed`
 *
 * Once initialization begins, the state becomes `initializing`.
 *
 * A successful terminal response transitions the state to `ready` and stores
 * the reported cursor position.
 *
 * A failed query transitions the state to `failed`. Initialization may then
 * be attempted again.
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE MACHINE
 * ---------------------------------------------------------------------
 *
 * ```txt
 * standby ──────────────► initializing
 *                            │
 *                            ├────► ready
 *                            │
 *                            └────► failed
 *                                      │
 *                                      └────► initializing
 * ```
 *
 * Calling {@link initialize} while initialization is already in progress, or
 * after successful initialization, has no effect.
 *
 * ---------------------------------------------------------------------
 * 🔷 SYNCHRONOUS ACCESS
 * ---------------------------------------------------------------------
 *
 * Once initialization succeeds, `row` and `column` expose the captured
 * terminal position synchronously.
 *
 * This allows consumers such as the screen renderer to perform synchronous
 * rendering operations without requiring callers to await terminal
 * initialization themselves.
 *
 * Before successful initialization, the accessors return safe default
 * coordinates:
 *
 * - `row` → `1`
 * - `column` → `0`
 *
 * These defaults represent the origin expected by the rendering subsystem
 * before a terminal position has been established.
 *
 * ---------------------------------------------------------------------
 * 🔷 RETRY BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * A failed initialization does not permanently disable the manager.
 *
 * After entering the `failed` state, {@link initialize} may be called again
 * to perform another terminal cursor-position query.
 *
 * @since 1.0.0
 */
class CursorPosition {
    #_state: CursorState = 'standby';
    #_initialized = false;
    #_position?: CursorPositionData;

    /**
     * Current initialization state.
     *
     * Indicates whether the cursor-position manager is idle, initializing,
     * ready, or has encountered an initialization failure.
     *
     * @returns Current cursor-position initialization state
     *
     * @since 1.0.0
     */
    get state() { return this.#_state; }

    /**
     * Indicates whether the terminal cursor position has been initialized
     * successfully.
     *
     * This property becomes `true` only after a cursor-position query has
     * completed successfully.
     *
     * It remains `false` while initialization is pending or has failed.
     *
     * @returns `true` when a valid cursor position has been captured
     *
     * @since 1.0.0
     */
    get initialized() { return this.#_initialized; }

    /**
     * Initializes the terminal cursor position.
     *
     * Performs an asynchronous ANSI cursor-position query and stores the
     * resulting coordinates for synchronous access through {@link row} and
     * {@link column}.
     *
     * Initialization is only performed while the manager is in `standby` or
     * `failed` state. Calls made while initialization is already in progress
     * or after successful initialization are ignored.
     *
     * ---------------------------------------------------------------------
     * 🔷 SUCCESS
     * ---------------------------------------------------------------------
     *
     * When the terminal responds successfully:
     *
     * - the reported position is stored
     * - `state` becomes `ready`
     * - `initialized` becomes `true`
     *
     * ---------------------------------------------------------------------
     * 🔷 FAILURE
     * ---------------------------------------------------------------------
     *
     * If the underlying cursor-position query fails:
     *
     * - `state` becomes `failed`
     * - `initialized` remains `false`
     * - the original error is rethrown
     *
     * A failed initializer may subsequently be retried.
     *
     * @returns Promise resolved when initialization completes successfully
     *
     * @throws Error if the underlying cursor-position query fails
     *
     * @since 1.0.0
     */
    async initialize(): Promise<void> {
        if (!(this.state === 'standby' || this.state === 'failed')) {
            return;
        }

        this.#_state = 'initializing';

        try {
            this.#_position = await getCursorPosition();
            this.#_state = 'ready';
            this.#_initialized = true;
        } catch (error) {
            this.#_state = 'failed';
            throw error;
        }
    }

    /**
     * Current terminal cursor row.
     *
     * Returns the row captured during successful cursor-position
     * initialization.
     *
     * The returned coordinate follows the ANSI convention and is one-based.
     *
     * Before successful initialization, `1` is returned as the default
     * starting row.
     *
     * @returns Current terminal cursor row
     *
     * @since 1.0.0
     */
    get row() {
        return this.#_position?.row ?? 1
    }

    /**
     * Current terminal cursor column.
     *
     * Returns the column captured during successful cursor-position
     * initialization.
     *
     * The returned coordinate follows the ANSI convention and is one-based
     * after successful initialization.
     *
     * Before successful initialization, `0` is returned as the renderer's
     * default column.
     *
     * @returns Current terminal cursor column
     *
     * @since 1.0.0
     */
    get column() {
        return this.#_position?.column ?? 0
    }
}

const cursorPosition = new CursorPosition()
export default cursorPosition;