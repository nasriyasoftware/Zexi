import terminalInput from "./input/input.io";
import terminalOutput from "./output/output.io";
import screenManager from "./shared/screen";
import TerminalSizeDetector from "./shared/size.detector";
import terminalStreams from "./shared/streams";
import { EventEmitter } from "@nasriya/atomix/tools";
import type { CursorPosition } from "./input/query/types";
import type { TerminalIOEvents } from "./output/types";
import type { TerminalIOScreenInitState, TerminalIOScreenState } from "./shared/screen/types";

/**
 * Coordinates the process-wide terminal input, output, screen, and state
 * subsystems.
 *
 * `ZexiTerminalIO` is the boundary consumed by the terminal API and renderer.
 * It composes input and output modules, establishes the original-versus-
 * alternate-screen policy, records the initial cursor position, tracks
 * terminal dimensions, and exposes resize events.
 *
 * Input acquisition and query parsing are delegated to {@link input};
 * physical writes, interception, buffering, and terminal control sequences
 * are delegated to {@link output}. Screen selection and size polling are
 * delegated to their shared managers.
 *
 * The module's default export is the process-wide instance. The static
 * {@link replaceStreams} operation supports controlled stream substitution,
 * such as a test harness; normal terminal operations use the configured
 * streams through the composed modules.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION
 * ---------------------------------------------------------------------
 *
 * {@link initialize} establishes the screen policy, attempts to record the
 * initial cursor position, starts terminal-size detection, flushes output
 * queued during startup, and then marks the terminal initialized and ready.
 * Cursor-position failure is best-effort and does not prevent initialization;
 * size-detector or output-flush failures reject the initialization promise.
 *
 * After successful initialization, subsequent calls return without repeating
 * the screen query, resize polling setup, or output flush.
 *
 * ---------------------------------------------------------------------
 * 🔷 SHARED TERMINAL STATE
 * ---------------------------------------------------------------------
 *
 * The root instance exposes terminal dimensions, the initial cursor
 * observation, effective screen state, and a typed event emitter. The cursor
 * value is the startup observation, not a live position. Resize events are
 * emitted when size polling detects changed dimensions.
 *
 * `isTTY` is true only when the configured stdin, stdout, and stderr streams
 * all report `isTTY === true`. The effective screen state is `Disabled` when
 * the screen manager has disabled screen handling or the current stream
 * configuration is not fully interactive.
 *
 * ---------------------------------------------------------------------
 * 🔷 STREAM REPLACEMENT
 * ---------------------------------------------------------------------
 *
 * {@link replaceStreams} replaces configured stream references after
 * uninstalling interception, then reinstalls interception if it was active.
 * It does not rerun initialization or refresh the stored cursor position and
 * dimensions.
 *
 * @since 1.0.0
 */
export class ZexiTerminalIO {
    /**
     * Detects and maintains the dimensions of the process terminal.
     *
     * The detector is started by {@link initialize} before buffered writes
     * are flushed.
     * Its current dimensions are exposed through {@link width} and
     * {@link height}.
     *
     * This detector describes the process terminal's dimensions; it does
     * not track the dimensions or layout of individual terminal entries.
     *
     * @since 1.0.0
     */
    readonly #_resizeDetector = new TerminalSizeDetector();

    /**
     * Stores the initial cursor position observed from the process terminal.
     *
     * The position defaults to row 1, column 1 until the initial cursor
     * query succeeds. During initialization, the query manager exposed by
     * {@link input} retrieves the terminal's reported cursor position.
     *
     * The stored position represents the initial observation. It is not
     * automatically updated whenever subsequent terminal output moves
     * the cursor.
     *
     * @since 1.0.0
     */
    readonly #_initialCursor = {
        /**
         * The cursor position captured during terminal initialization.
         *
         * Defaults to row 1, column 1 and is updated when the initial cursor
         * position query succeeds. If the query fails, the default position
         * is retained.
         *
         * @since 1.0.0
         */
        position: { row: 1, column: 1 } as CursorPosition,

        /**
         * Queries the terminal for its current cursor position and updates
         * {@link position} with the returned coordinates.
         *
         * If the query fails, the error is wrapped in a new `Error` with
         * the original error preserved as its cause.
         *
         * @throws {Error} If the cursor-position query fails.
         *
         * @since 1.0.0
         */
        update: async () => {
            try {
                const p = await terminalInput.query.cursorPosition();
                this.#_initialCursor.position = p;
            } catch (e) {
                throw new Error(`Failed to query cursor position: ${e}`, { cause: e });
            }
        }
    };

    /**
     * Tracks completion and output readiness for the terminal's one-time
     * initialization sequence.
     *
     * `isReady` becomes `true` after terminal-size detection has started and
     * all output entries buffered before readiness have been flushed.
     * `initialized` is set immediately afterward to prevent subsequent calls
     * to {@link initialize} from repeating initialization.
     *
     * Both flags remain `false` if a rejecting initialization step fails.
     * Cursor-query failure is intentionally suppressed and does not prevent
     * either flag from being set.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_flags = Object.seal({
        initialized: false,
        isReady: false,
    });

    /**
     * Emits typed events associated with terminal I/O.
     *
     * The available event names and payload types are defined by
     * {@link TerminalIOEvents}.
     *
     * @since 1.0.0
     */
    readonly events = new EventEmitter<TerminalIOEvents>();

    /**
     * Terminal input operations, including raw stdin sessions, text capture,
     * and serialized terminal queries.
     *
     * @since 1.0.0
     */
    readonly input = terminalInput;

    /**
     * Terminal output operations, including physical writes, buffering,
     * interception, and screen-control sequences.
     *
     * @since 1.0.0
     */
    readonly output = terminalOutput;

    /**
     * Indicates whether the terminal has completed initialization and flushed all
     * previously buffered writes.
     *
     * This value remains `false` while the terminal is initializing and throughout
     * the buffer-flushing phase. It becomes `true` only after the entire buffer
     * has been written through the captured methods of the configured output
     * streams.
     *
     * @returns `true` when the terminal is ready; otherwise, `false`.
     *
     * @since 1.0.0
     */
    get isReady() { return this.#_flags.isReady; }

    /**
     * Indicates whether terminal initialization has completed successfully.
     *
     * This flag becomes `true` after the initial cursor attempt, size-detector
     * startup, and buffered-output flush have completed. It remains `false` if
     * one of the rejecting initialization steps fails.
     *
     * @returns Whether initialization has completed.
     *
     * @since 1.0.0
     */
    get initialized() { return this.#_flags.initialized; }

    /**
     * Gets the detected width of the process terminal in columns.
     *
     * @returns The detected terminal width.
     *
     * @since 1.0.0
     */
    get width() { return this.#_resizeDetector.width; }

    /**
     * Gets the detected height of the process terminal in rows.
     *
     * @returns The detected terminal height.
     *
     * @since 1.0.0
     */
    get height() { return this.#_resizeDetector.height; }

    /**
     * Gets the initial cursor position observed during terminal initialization.
     *
     * The returned position is the stored initial observation, not a live
     * cursor-position query. It defaults to row 1, column 1 until the
     * initial cursor query succeeds.
     *
     * @returns The stored initial cursor position.
     *
     * @since 1.0.0
     */
    get initialCursor() { return this.#_initialCursor.position; }

    /**
     * Indicates whether all configured standard streams are interactive TTYs.
     *
     * The configured stdin, stdout, and stderr streams must each report
     * `isTTY === true`.
     *
     * @returns Whether stdin, stdout, and stderr are all TTYs.
     *
     * @since 1.0.0
     */
    get isTTY() {
        return (
            terminalInput.isTTY &&
            terminalOutput.isTTY
        );
    }

    /**
     * Gets the effective process-wide terminal screen state.
     *
     * Returns `Disabled` whenever the stored state is disabled or any of the
     * configured stdin, stdout, or stderr streams is not a TTY.
     *
     * @returns The effective managed-screen state.
     *
     * @since 1.0.0
     */
    get state(): TerminalIOScreenState {
        return (screenManager.state === 'Disabled' || !this.isTTY) ? 'Disabled' : screenManager.state;
    }

    /**
     * Gets the process-wide terminal screen initialization lifecycle state.
     *
     * Unlike {@link state}, this reports the stored lifecycle value directly
     * and is not rewritten when the streams stop being TTYs.
     *
     * @returns The current screen initialization phase.
     *
     * @since 1.0.0
     */
    get initState(): TerminalIOScreenInitState {
        return screenManager.initState;
    }

    /**
     * Initializes screen state, cursor and size tracking, and output
     * readiness.
     *
     * Screen policy is initialized first when its lifecycle is still
     * `STANDBY`. The initial cursor query is then attempted; query failure is
     * suppressed and leaves the default cursor position in place. Size
     * detection must start successfully before buffered output is flushed.
     * After the flush completes, `isReady` and `initialized` become `true`.
     *
     * Calls after successful initialization fulfill without repeating the
     * work. A failure from screen setup, size-detector startup, or output
     * flushing rejects the promise and leaves the completion flags unset.
     *
     * @returns A promise that fulfills when initialization and the initial
     * output flush complete.
     * @throws Any error propagated by screen initialization, size detection,
     * or output flushing.
     * @since 1.0.0
     */
    async initialize() {
        if (this.#_flags.initialized) { return; }

        if (screenManager.initState === 'STANDBY') {
            await screenManager.initialize();
        }

        try {
            await this.#_initialCursor.update();
        } catch (e) {
            // Cursor tracking failed; continue initialization.
        }

        await this.#_resizeDetector.run();

        terminalOutput.flush();

        this.#_flags.isReady = true;
        this.#_flags.initialized = true;
    }

    /**
     * Replaces configured standard streams while preserving interception
     * state.
     *
     * Active interception is uninstalled before the streams are changed, so
     * the replacement output methods can be captured as the originals. If
     * interception was active before replacement, it is enabled again on the
     * replacement streams.
     *
     * This operation supports controlled stream substitution, such as test
     * setup. It changes the terminal I/O configuration; it does not replace
     * Node.js `process` stream properties, rerun initialization, or refresh
     * the stored cursor and dimensions.
     *
     * @param streams - Per-stream replacements. Omitted properties leave the
     * corresponding configured stream unchanged.
     * @param streams.output - Replacement stdout stream.
     * @param streams.error - Replacement stderr stream.
     * @param streams.input - Replacement stdin stream.
     * @since 1.0.0
     */
    static replaceStreams(
        streams: {
            output?: unknown,
            error?: unknown,
            input?: unknown
        }
    ) {
        const interception = terminalOutput.interception;

        const wasIntercepting = interception.intercepting;
        interception.uninstall();

        // Replace the streams
        terminalStreams.replace(streams);

        if (wasIntercepting) {
            interception.intercepting = true; // This installs the interceptors and enables interception
        }
    }
}

/**
 * The process-wide terminal I/O coordinator.
 *
 * This singleton is shared by the terminal API, renderer, input operations,
 * and output operations. Use it to access the composed {@link input} and
 * {@link output} modules, observe terminal state and events, or initialize
 * terminal I/O. Importing the module does not create an additional
 * coordinator.
 *
 * @since 1.0.0
 */
const terminalIO = new ZexiTerminalIO();
export default terminalIO;