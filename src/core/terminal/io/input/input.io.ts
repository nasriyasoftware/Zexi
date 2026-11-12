import TerminalCell from "../../screen/tom/cells/terminal.cell";
import TerminalQueryManager from "./query/query.manager";
import terminalStreams from "../shared/streams";
import { stdinController, TextInputCapture } from "./assets";
import type { StdinCaptureOptions, StdinHandler, StdinSession } from "./assets";

/**
 * Provides terminal input operations through the shared stdin controller.
 *
 * `TerminalInput` groups three input responsibilities:
 *
 * - {@link createSession} provides serialized access to raw stdin chunks.
 * - {@link capture} provides managed text entry with terminal-cell updates.
 * - {@link query} coordinates terminal protocol requests and their responses.
 *
 * The input module owns stdin TTY inspection and delegates exclusive stream
 * ownership to the shared controller. It does not own terminal output
 * formatting or process-wide initialization.
 *
 * @since 1.0.0
 */
class TerminalInput {
    /**
     * Serializes terminal protocol queries that consume stdin responses.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_querys = new TerminalQueryManager();

    /**
     * Creates a raw stdin session backed by the shared controller.
     *
     * The session is passive when created; it does not reserve stdin until
     * its `start()` method is called. Acquired sessions are serialized by
     * the controller, and its handler receives each raw `Buffer` chunk while
     * it owns the stream. The returned controller session exposes `start()`,
     * `release()`, and `cancel()` lifecycle methods.
     *
     * Use this for low-level input processing. The consumer is responsible
     * for parsing chunks, maintaining interaction state, and presenting any
     * resulting output. For managed text entry, use {@link capture}.
     *
     * @param handler - Receives raw stdin chunks while this session owns the
     * stream. Use {@link capture} when the interaction should instead
     * collect and present a text value.
     * @returns A session handle for requesting and ending an exclusive stdin
     * turn.
     * @see {@link capture}
     * @since 1.0.0
     */
    createSession(handler: StdinHandler): StdinSession {
        return stdinController.createSession(handler);
    }

    /**
     * Captures a text value from stdin and manages its terminal presentation.
     *
     * Text capture supports visible, hidden, and password-style input,
     * configurable Escape-key handling, optional inactivity timeouts, and
     * synchronous or asynchronous custom validation. The returned promise
     * resolves with the entered value when accepted, or `null` when the
     * capture is canceled or times out. The supplied terminal cell is updated
     * as the user types according to the selected privacy mode.
     *
     * @param cell - Terminal cell whose `input` parameter is updated with the
     * current captured value.
     * @param options - Optional privacy, Escape-key, timeout, and validation
     * settings.
     * @returns A promise that resolves to the accepted string or `null` if
     * canceled or timed out.
     * @see {@link createSession}
     * @since 1.0.0
     */
    capture(cell: TerminalCell, options?: StdinCaptureOptions): Promise<string | null> {
        return TextInputCapture.capture(cell, options);
    }

    /**
     * Queries terminal cursor position and dimensions through a serialized
     * query manager.
     *
     * @since 1.0.0
     */
    readonly query = this.#_querys;

    /**
     * Indicates whether the currently configured stdin stream is a TTY.
     *
     * This reports stdin only. The root terminal I/O `isTTY` value combines
     * this state with stdout and stderr.
     *
     * @returns `true` when stdin is a TTY; otherwise, `false`.
     * @since 1.0.0
     */
    get isTTY() { return terminalStreams.input.isTTY === true; }
}

/**
 * The process-wide terminal input module.
 *
 * This singleton provides raw stdin sessions, managed text capture, and
 * serialized terminal queries. Its sessions share the stdin controller's
 * queue, so consumers acquire the configured input stream in turn rather
 * than creating independent stream listeners.
 *
 * @since 1.0.0
 */
const terminalInput = new TerminalInput();
export default terminalInput;