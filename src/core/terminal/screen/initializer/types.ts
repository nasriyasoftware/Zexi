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
export type ScreenInitState =
    | 'STANDBY'
    | 'INITIALIZING'
    | 'READY'
    | 'FAILED';

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
export type TerminalScreenState =
    | 'Original'
    | 'Alternate'
    | 'Disabled';