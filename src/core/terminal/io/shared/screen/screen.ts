import terminalIO from "../..";
import atomix from "@nasriya/atomix";
import { TerminalIOScreenInitState, TerminalIOScreenState } from "./types";

/**
 * Selects and manages the process-wide terminal screen.
 *
 * `TerminalScreenManager` probes the current cursor position during
 * initialization to decide whether Zexi can use the original screen. If the
 * probe fails on an interactive terminal, it enters the alternate screen.
 * If the configured stdin, stdout, and stderr streams are not all TTYs,
 * screen management is marked failed and no screen is selected.
 *
 * The manager tracks screen selection separately from its initialization
 * lifecycle. A `READY` lifecycle means a policy decision was made; it does
 * not guarantee the selected state remains effective if stream configuration
 * later changes.
 *
 * Entering the alternate screen registers a one-time restoration callback
 * for process exit and termination signals. Switching back removes those
 * listeners and invokes the same callback immediately.
 *
 * Screen output is delegated to the root terminal I/O coordinator. This
 * manager does not own stream interception or terminal-size tracking.
 *
 * @since 1.0.0
 */
class TerminalScreenManager {
    #_state: TerminalIOScreenState = 'Disabled';
    #_initState: TerminalIOScreenInitState = 'STANDBY';
    #_cleanupHandler?: () => void;

    /**
     * Establishes the original-versus-alternate-screen policy.
     *
     * Initialization is valid only from `STANDBY`. A non-TTY configuration
     * transitions to `FAILED` without probing the cursor. On an interactive
     * terminal, a successful cursor query selects the original screen; a
     * failed query selects the alternate screen. The method then transitions
     * to `READY`.
     *
     * Cursor-query failure is handled as the alternate-screen policy and
     * does not reject this method. Calling the method in any other lifecycle
     * state throws.
     *
     * @returns A promise that fulfills after the screen policy is selected.
     * @throws {Error} If initialization has already started.
     * @since 1.0.0
     */
    async initialize() {
        if (this.#_initState !== 'STANDBY') {
            throw new Error(`Invariant violation: Screen initialization must begin in STANDBY state, but was ${this.#_initState}.`);
        }

        this.#_initState = 'INITIALIZING';

        if (!terminalIO.isTTY) {
            this.#_initState = 'FAILED';
            return;
        }

        let queryPassed = false;
        await terminalIO.input.query.cursorPosition().then(() => queryPassed = true).catch(() => { });

        if (queryPassed) {
            this.#_state = 'Original';
        } else {
            // Query failed, switch to alternate screen and update state
            this.switch();
        }

        this.#_initState = 'READY';
    }

    /**
     * Toggles the selected screen between the original and alternate screens.
     *
     * The operation is a no-op when the terminal is not interactive or no
     * screen has been selected. Entering the alternate screen installs
     * process-exit and termination cleanup; returning to the original screen
     * removes those listeners and runs the cleanup immediately.
     *
     * @throws {Error} If the alternate screen is active but its cleanup
     * handler is missing.
     * @since 1.0.0
     */
    switch() {
        if (!terminalIO.isTTY || this.#_state === 'Disabled') { return; }

        if (this.#_state === 'Original' || this.#_initState === 'INITIALIZING') {
            // Switch to alternate screen
            terminalIO.output.write('[Zexi] Switching to alternate terminal this.#_..\r\n');
            terminalIO.output.write('\x1b[?1049h\x1b[2J\x1b[H');

            const leaveScreen = this.#_cleanupHandler = atomix.utils.once(() => {
                terminalIO.output.write('\x1b[?1049l');
                terminalIO.output.write('[Zexi] Restored original terminal this.#_\r\n');
            });

            process.on('exit', leaveScreen);
            process.on('SIGINT', leaveScreen);
            process.on('SIGTERM', leaveScreen);

            this.#_state = 'Alternate';
        } else {
            // Switch to original screen
            if (!this.#_cleanupHandler) {
                throw new Error('Invariant violation: alternate screen cleanup handler not found.');
            }

            process.removeListener('exit', this.#_cleanupHandler);
            process.removeListener('SIGINT', this.#_cleanupHandler);
            process.removeListener('SIGTERM', this.#_cleanupHandler);

            this.#_cleanupHandler();

            this.#_state = 'Original';
        }
    }

    /**
     * Gets the currently selected screen state.
     *
     * @returns `Original`, `Alternate`, or `Disabled`.
     * @since 1.0.0
     */
    get state() { return this.#_state; }

    /**
     * Gets the screen initialization lifecycle state.
     *
     * @returns The current initialization phase.
     * @since 1.0.0
     */
    get initState() { return this.#_initState; }
}

/**
 * The process-wide manager for original and alternate terminal screens.
 *
 * The root terminal I/O coordinator uses this instance to choose a screen
 * during initialization and to perform screen switches through terminal
 * output.
 *
 * @since 1.0.0
 */
const screenManager = new TerminalScreenManager();
export default screenManager;