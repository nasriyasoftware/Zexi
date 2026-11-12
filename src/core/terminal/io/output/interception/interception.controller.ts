import atomix from "@nasriya/atomix";
import ZexiTerminalControllerInstance from "../../../controller/controller";
import terminalStreams from "../../shared/streams/streams";
import interceptors from "./interceptors";
import { Console } from 'node:console';

/**
 * Manages installation, activation, and removal of terminal interception.
 *
 * This object owns the method-level modifications required for Zexi to
 * intercept operations on the currently configured output streams.
 *
 * Installation and activation are handled separately:
 *
 * - installation replaces configured stream methods with Zexi interceptors
 * - activation enables the interceptors to process operations through Zexi
 * - deactivation leaves the interceptors installed but makes them forward
 *   operations transparently
 * - uninstallation restores captured methods on the configured stream
 *   objects
 *
 * Uninstallation does not replace `process.stdin`, `process.stdout`, or
 * `process.stderr`; stream substitution is a separate operation.
 *
 * The interception lifecycle also owns the signal handlers used to drain
 * pending terminal operations before process termination.
 *
 * @since 1.0.0
 */
export class ProcessStdInterception {
    /**
     * Tracks installation and active interception state.
     *
     * `installed` indicates whether Zexi's interceptors are currently installed on
     * the configured terminal streams.
     *
     * `intercepting` indicates whether those installed interceptors are actively
     * processing terminal operations through Zexi.
     *
     * These states are independent: disabling interception leaves the
     * interceptors installed for transparent forwarding.
     *
     * @since 1.0.0
     */
    readonly #_flags = Object.seal({
        intercepting: false,
        installed: false,
    });

    /**
     * Stores the process termination handler registered while interception is
     * enabled.
     *
     * The handler waits for the terminal controller queue to complete before
     * terminating the process. This prevents pending terminal operations from
     * being abandoned during `SIGINT` or `SIGTERM`.
     *
     * The handler is removed when interception is disabled.
     *
     * @since 1.0.0
     */
    #_drainHandler?: (signal: string) => Promise<void>;

    /**
     * Installs Zexi's terminal interceptors on the configured standard streams and
     * replaces the global console with a Zexi-controlled `Console` instance.
     *
     * Installation is idempotent. If the interceptors are already installed, no
     * changes are made.
     *
     * Configured output-stream methods must have been captured before
     * installation. Attempting to install the interceptors before those
     * methods have been captured indicates an internal lifecycle violation
     * and throws an `Error`.
     *
     * The installed interceptors replace the standard stream methods for:
     *
     * - stdout writes
     * - stderr writes
     * - cursor positioning
     * - relative cursor movement
     * - line clearing
     * - screen clearing
     *
     * After the stream interceptors are installed, a new `Console` instance is
     * created using the configured standard streams and assigned to
     * `globalThis.console`. Creating a new instance ensures that Zexi does not
     * depend on or modify the internal state of a previously created `Console`
     * instance and retains control over the global console output path.
     *
     * Installation does not enable active interception by itself.
     *
     * @throws {Error}
     * Thrown if the configured standard-stream methods have not been captured
     * before installation.
     *
     * @since 1.0.0
     */
    #_install() {
        if (this.#_flags.installed) { return; }

        const { output, error } = terminalStreams
        output.write = interceptors.stdoutWrite;
        error.write = interceptors.stderrWrite;

        output.cursorTo = error.cursorTo = interceptors.cursorTo;
        output.clearLine = error.clearLine = interceptors.clearLine;
        output.clearScreenDown = error.clearScreenDown = interceptors.clearScreenDown;
        output.moveCursor = error.moveCursor = interceptors.moveCursor;

        globalThis.console = new Console({
            stdout: output,
            stderr: error,
        }) as any;

        this.#_flags.installed = true;
    }

    /**
     * Removes Zexi's terminal interceptors from the configured standard streams and
     * restores the original global console instance.
     *
     * If the interceptors are not installed, no changes are made.
     *
     * Each replaced stream method is restored to the function reference
     * captured for the currently configured stream. The restored functions
     * are not bound by Zexi; they are assigned back to the configured streams
     * and retain the stream as their `this` context when invoked normally.
     *
     * The global `console` is restored to the exact instance captured before
     * Zexi installed its interceptors.
     *
     * This operation restores methods and the console instance only; it does
     * not replace the configured stream objects.
     * Active interception and its signal handlers are managed separately by
     * {@link enable} and {@link disable}.
     *
     * @since 1.0.0
     */
    #_uninstall() {
        if (!this.#_flags.installed) { return; }
        terminalStreams.restoreCurrent('all');
        this.#_flags.installed = false;
    }

    /**
     * Enables active Zexi terminal interception.
     *
     * Enabling installs the terminal interceptors if they are not already
     * installed, registers the process signal handlers used to drain pending
     * Zexi work before termination, and marks the terminal as actively
     * intercepting application output.
     *
     * This operation is idempotent. If active interception is already enabled,
     * no changes are made.
     *
     * The process signal handlers are registered for:
     *
     * - `SIGINT`
     * - `SIGTERM`
     *
     * When either signal is received, pending Zexi terminal work is allowed to
     * complete before the process exits with the received termination code.
     *
     * Installation and active interception are separate states. Enabling
     * interception guarantees that the required terminal interceptors are
     * installed, but installing the interceptors alone does not enable active
     * interception.
     *
     * Methods on the configured output streams must have been captured before
     * interception can be enabled. If those methods have not been captured,
     * interceptor installation fails and active interception is not enabled.
     *
     * @throws {Error}
     * Thrown if the configured output-stream methods have not been captured
     * before the terminal interceptors are installed.
     *
     * @since 1.0.0
     */
    #_enable() {
        try {
            if (this.#_flags.intercepting) { return; }

            this.#_drainHandler = atomix.utils.once(async (signal: string) => {
                const ct = ZexiTerminalControllerInstance;
                await ct.queue.untilComplete();

                const code = (() => {
                    switch (signal) {
                        case 'SIGINT': return 130;
                        case 'SIGTERM': return 143;
                        default: return 1;
                    }
                })();

                process.exit(code);
            });

            process.on('SIGINT', this.#_drainHandler);
            process.on('SIGTERM', this.#_drainHandler);
        } finally {
            this.#_install();
            this.#_flags.intercepting = true;
        }
    }

    /**
     * Disables active terminal interception.
     *
     * The installed interceptors are intentionally retained. While interception
     * is disabled, they transparently forward operations to the original
     * captured methods of the configured streams.
     *
     * Any `SIGINT` and `SIGTERM` handlers registered by {@link enable} are
     * removed.
     *
     * Disabling interception does not restore the captured stream methods.
     * Use {@link uninstall} for that.
     *
     * @since 1.0.0
     */
    #_disable() {
        if (!this.#_flags.intercepting) { return; }

        this.#_flags.intercepting = false
        const drainHandler = this.#_drainHandler;

        if (drainHandler) {
            process.removeListener('SIGINT', drainHandler);
            process.removeListener('SIGTERM', drainHandler);
        }
    }

    constructor() {
        this.intercepting = true;
    }

    /**
     * Indicates whether Zexi's terminal interceptors are currently installed
     * on the configured standard streams.
     *
     * This remains `true` after interception is disabled until {@link uninstall}
     * restores the captured methods on the configured stream objects.
     *
     * @returns `true` when the interceptors are installed; otherwise `false`.
     *
     * @since 1.0.0
     */
    get installed() { return this.#_flags.installed; }

    /**
     * Indicates whether Zexi is actively intercepting terminal operations.
     *
     * A value of `false` does not necessarily mean that the interceptors have
     * been removed. The interceptors may remain installed while transparently
     * forwarding operations to the captured methods of the configured streams.
     *
     * @returns `true` when interception is active; otherwise `false`.
     *
     * @since 1.0.0
     */
    get intercepting() { return this.#_flags.intercepting; }

    /**
     * Enables or disables active terminal interception.
     *
     * Setting this property to `true` enables interception and installs the
     * terminal interceptors when necessary.
     *
     * Setting this property to `false` disables active interception but leaves
     * the interceptors installed for transparent forwarding.
     *
     * A non-boolean value is rejected.
     *
     * @param value - Whether active terminal interception should be enabled.
     *
     * @throws TypeError if `value` is not a boolean.
     *
     * @since 1.0.0
     */
    set intercepting(value: boolean) {
        if (typeof value !== 'boolean') {
            throw new TypeError(`Expected \`intercepting\` to be a boolean, received \`${typeof value}\``);
        }

        if (value === true) {
            this.#_enable();
        } else {
            this.#_disable();
        }
    }

    /**
     * Completely removes Zexi's terminal interception from the configured
     * streams.
     *
     * Active interception is disabled first, which also removes the signal
     * handlers registered for process termination.
     *
     * The installed interceptors are then removed and the methods captured
     * for the configured stdout and stderr stream objects are restored.
     *
     * This restores methods only. It does not replace the configured stream
     * objects or change the `process` stream properties.
     *
     * @since 1.0.0
     */
    uninstall() {
        this.#_disable();
        this.#_uninstall();
    }
}

/**
 * The process-wide controller for terminal stream-method interception.
 *
 * The output module and stream interceptors share this instance to coordinate
 * installation, activation, deactivation, and restoration of intercepted
 * methods on the currently configured output streams.
 *
 * @since 1.0.0
 */
const processStdInterception = new ProcessStdInterception();
export default processStdInterception;