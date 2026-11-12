/**
 * Mutable process-wide state and operations used by terminal screen management.
 *
 * The metadata separates the selected-screen state from the screen
 * initialization lifecycle. Initialization can be complete while the
 * effective screen remains disabled, and the effective screen can also be
 * reported as disabled when any configured standard stream is no longer a
 * TTY.
 * The callbacks are owned by terminal I/O and are not application extension
 * points.
 *
 * @since 1.0.0
 */
export interface TerminalIOScreenMetadata {
    /**
     * Currently selected terminal screen.
     *
     * `Disabled` indicates that no terminal screen has been selected.
     * `Original` indicates that Zexi is operating on the existing terminal
     * screen.
     * `Alternate` indicates that Zexi has entered the alternate terminal screen.
     *
     * @default `Disabled`
     * @since 1.0.0
     */
    state: TerminalIOScreenState;

    /**
     * Current initialization lifecycle state.
     *
     * @default `STANDBY`
     * @since 1.0.0
     */
    initState: TerminalIOScreenInitState;

    /**
     * One-time handler responsible for restoring the original terminal screen
     * after entering the alternate screen.
     *
     * The handler is assigned only when the alternate screen is entered.
     *
     * @since 1.0.0
     */
    cleanupHandler?: () => void;

    /**
     * Toggles between the original and alternate terminal screens when a
     * screen is selected and stdin, stdout, and stderr are all TTYs.
     *
     * Entering the alternate screen assigns a cleanup callback that restores
     * the original screen on process exit or termination. Calling this
     * operation while the state is Disabled or the configured standard
     * streams are not all TTYs is a no-op.
     *
     * @since 1.0.0
     */
    switch: () => void;

    /**
     * Establishes the process-wide screen initialization state.
     *
     * The operation transitions from STANDBY to INITIALIZING, marks the
     * lifecycle FAILED when stdin, stdout, and stderr are not all TTYs, and
     * otherwise probes the cursor to choose the screen policy before
     * transitioning to READY. Cursor-query failure is handled by requesting
     * a screen switch; it does not reject this operation.
     *
     * @throws Error if called when the lifecycle is not STANDBY.
     * @returns A promise fulfilled when the screen initialization decision
     * has been recorded.
     *
     * @since 1.0.0
     */
    initialize: () => Promise<void>;
}

/**
 * Identifies the terminal screen currently managed by Zexi.
 *
 * - `Original` — Zexi is operating on the terminal screen that was already
 *   active when initialization began.
 * - `Alternate` — Zexi is operating on the terminal's alternate screen because
 *   the existing screen state could not be safely established.
 * - `Disabled` — no terminal screen has been selected, typically because
 *   initialization has not completed or could not proceed.
 *
 * @since 1.0.0
 */
export type TerminalIOScreenState =
    | 'Original'
    | 'Alternate'
    | 'Disabled';

/**
 * Describes the lifecycle state of terminal screen initialization.
 *
 * - `STANDBY` — initialization has not started.
 * - `INITIALIZING` — terminal availability and initial screen state are being
 *   established.
 * - `READY` — initialization completed and a terminal screen was selected.
 * - `FAILED` — initialization could not proceed because no interactive
 *   terminal was available.
 *
 * @since 1.0.0
 */
export type TerminalIOScreenInitState =
    | 'STANDBY'
    | 'INITIALIZING'
    | 'READY'
    | 'FAILED';