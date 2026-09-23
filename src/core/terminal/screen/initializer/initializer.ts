import atomix from "@nasriya/atomix";
import terminalIO, { ZexiTerminalIO } from "../../io/terminal.io";

import type { CursorPosition } from "../../io/types";
import type { ScreenInitState, TerminalScreenState } from "./types";

/**
 * Manages the terminal screen used by Zexi.
 *
 * `ScreenInitializer` establishes the terminal screen state required by Zexi
 * before terminal output and screen layout can be managed.
 *
 * Initialization verifies access to an interactive terminal through the
 * terminal I/O streams and attempts to capture the terminal's initial cursor
 * position. When the position can be queried successfully, Zexi uses the
 * existing terminal screen. When the query fails, Zexi falls back to the
 * alternate screen, providing a known and clean terminal state.
 *
 * The original terminal screen is therefore the default operating mode.
 * The alternate screen is used only when the existing terminal state cannot
 * be safely established.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCREEN SELECTION
 * ---------------------------------------------------------------------
 *
 * ```txt
 * terminal available
 *        │
 *        ├── cursor query succeeds ──► Original
 *        │
 *        └── cursor query fails ─────► Alternate
 * ```
 *
 * When the original screen is selected, the cursor position reported before
 * Zexi begins managing the terminal is permanently retained as the initial
 * position.
 *
 * When the alternate screen is selected, the original screen is preserved
 * and the alternate screen is cleared and positioned at its origin.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * ```txt
 * STANDBY
 *    │
 *    ▼
 * INITIALIZING
 *    │
 *    ├── terminal unavailable ──► FAILED
 *    │
 *    ├── cursor query succeeds ──► READY
 *    │                              │
 *    │                              └── Original
 *    │
 *    └── cursor query fails ──────► READY
 *                                   │
 *                                   └── Alternate
 * ```
 *
 * Initialization is performed at most once. Calls to {@link initialize}
 * after initialization has started have no effect.
 *
 * @since 1.0.0
 */
class ScreenInitializer {
    /**
     * Currently selected terminal screen.
     *
     * `Disabled` indicates that no terminal screen has been selected.
     * `Original` indicates that Zexi is operating on the existing terminal
     * screen.
     * `Alternate` indicates that Zexi has entered the alternate terminal screen.
     * 
     * @since 1.0.0
     */
    #_state: TerminalScreenState = 'Disabled';

    /**
     * Current initialization lifecycle state.
     * @since 1.0.0
     */
    #_initState: ScreenInitState = 'STANDBY';

    /**
     * Cursor position captured from the terminal before Zexi begins managing
     * the screen.
     *
     * This value represents the initial terminal state and is never updated after
     * it has been captured.
     * 
     * @since 1.0.0
     */
    #_initialPosition?: CursorPosition;

    /**
     * One-time handler responsible for restoring the original terminal screen
     * after entering the alternate screen.
     *
     * The handler is assigned only when the alternate screen is entered.
     * 
     * @since 1.0.0
     */
    #_cleanupHandler?: () => void;

    /**
     * Internal operations used during terminal initialization.
     *
     * These helpers isolate terminal detection, cursor-position querying, and
     * screen switching from the initialization state machine itself.
     *
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Determines whether the terminal I/O streams are attached to an
         * interactive terminal.
         *
         * Both the standard input and standard output streams exposed by the
         * terminal I/O interface must be attached to a TTY.
         *
         * @returns `true` when both terminal input and output streams are
         * attached to an interactive terminal.
         *
         * @since 1.0.0
         */
        detectIfTerminalExist: (): boolean => {
            return (
                ZexiTerminalIO.streams.stdin.isTTY === true &&
                ZexiTerminalIO.streams.stdout.isTTY === true
            );
        },

        /**
         * Attempts to capture the terminal's current cursor position.
         *
         * When the query succeeds, the captured position is stored as the
         * initial terminal position and the terminal state is set to `Original`.
         *
         * Query failures are converted into a boolean result so the initializer
         * can fall back to the alternate screen.
         *
         * @returns Promise resolving to `true` when the cursor position was
         * successfully captured, or `false` when the query fails.
         *
         * @since 1.0.0
         */
        queryCursorPosition: async (): Promise<boolean> => {
            try {
                this.#_initialPosition = await terminalIO.queryCursorPosition();
                this.#_state = 'Original';
                return true;
            } catch (error) {
                return false;
            }
        },

        /**
         * Switches between the original and alternate terminal screens.
         *
         * During initialization, this enters the alternate screen, clears its
         * contents, and places the cursor at its origin. A one-time cleanup
         * handler is registered to restore the original screen when the process
         * terminates.
         *
         * When the initializer is already using the alternate screen, this
         * restores the original screen and removes the registered cleanup
         * handlers.
         * 
         * @since 1.0.0
         */
        switchScreen: (): void => {
            if (this.#_state === 'Original' || this.#_initState === 'INITIALIZING') {
                // Switch to alternate screen
                terminalIO.write('[Zexi] Switching to alternate terminal screen...\r\n');
                terminalIO.write('\x1b[?1049h\x1b[2J\x1b[H');

                const leaveScreen = this.#_cleanupHandler = atomix.utils.once(() => {
                    terminalIO.write('\x1b[?1049l');
                    terminalIO.write('[Zexi] Restored original terminal screen.\r\n');
                });

                process.on('exit', leaveScreen);
                process.on('SIGINT', leaveScreen);
                process.on('SIGTERM', leaveScreen);

                this.#_state = 'Alternate';
            } else {
                // Switch to original screen
                process.removeListener('exit', this.#_cleanupHandler!);
                process.removeListener('SIGINT', this.#_cleanupHandler!);
                process.removeListener('SIGTERM', this.#_cleanupHandler!);

                this.#_cleanupHandler!();

                this.#_state = 'Original';
            }
        }
    }

    get initState() { return this.#_initState; }

    /**
     * Current terminal screen selected by the initializer.
     *
     * `Original` indicates that Zexi is using the terminal screen that was
     * already active when initialization began.
     *
     * `Alternate` indicates that Zexi entered the terminal's alternate screen
     * because the existing cursor position could not be queried safely.
     *
     * `Disabled` indicates that no terminal screen has been selected.
     *
     * @returns Current terminal screen state
     *
     * @since 1.0.0
     */
    get state() { return this.#_state; }

    /**
     * Initial terminal cursor row.
     *
     * Returns the row captured from the terminal before Zexi began managing
     * the screen.
     *
     * The coordinate follows the ANSI terminal convention and is one-based.
     *
     * When no initial cursor position has been established, `1` is returned
     * as the default row used by the screen subsystem.
     *
     * @returns Initial terminal cursor row
     *
     * @since 1.0.0
     */
    get row() { return this.#_initialPosition?.row ?? 1; }

    /**
     * Initial terminal cursor column.
     *
     * Returns the column captured from the terminal before Zexi began
     * managing the screen.
     *
     * The coordinate follows the ANSI terminal convention and is one-based.
     *
     * When no initial cursor position has been established, `1` is returned
     * as the default column used by the screen subsystem.
     *
     * @returns Initial terminal cursor column
     *
     * @since 1.0.0
     */
    get column() { return this.#_initialPosition?.column ?? 1; }

    /**
     * Initializes the terminal screen for Zexi.
     *
     * Verifies that the process has access to an interactive terminal and
     * attempts to capture its current cursor position.
     *
     * When the cursor position is queried successfully, the original screen
     * is selected.
     *
     * When the cursor-position query fails, the alternate screen is selected,
     * cleared, and positioned at its origin so that Zexi can operate from a
     * known terminal state.
     *
     * When no interactive terminal is available, initialization transitions
     * to `FAILED` without selecting a terminal screen.
     *
     * Initialization is performed only once. Calls made after initialization
     * has started are ignored.
     *
     * Once terminal initialization has completed, the terminal I/O interface
     * is notified so that any writes buffered during initialization can be
     * flushed.
     *
     * @returns Promise resolved when terminal initialization has completed
     *
     * @since 1.0.0
     */
    async initialize() {
        if (this.#_initState !== 'STANDBY') {
            return;
        }

        this.#_initState = 'INITIALIZING';
        const helpers = this.#_helpers;

        const hasTerminal = helpers.detectIfTerminalExist();

        if (!hasTerminal) {
            this.#_initState = 'FAILED';
            return;
        }

        const querySuccess = await helpers.queryCursorPosition();

        try {
            if (querySuccess) { return; }
            helpers.switchScreen();
        } finally {
            this.#_initState = 'READY';
            terminalIO.onReady();
        }
    }
}

export default ScreenInitializer;