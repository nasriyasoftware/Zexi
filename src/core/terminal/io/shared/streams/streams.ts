import { captureStream, restoreStream } from "./helpers";
import type {
    StdoutStream,
    StderrStream,
    StdinStream,
} from "./types";

/**
 * Owns process-stream snapshots and the currently configured stream references.
 *
 * `TerminalStreams` separates startup process streams from the active stream
 * configuration:
 *
 * - `#_PROCESS` retains the stream objects and methods present when this
 *   module is initialized.
 * - `#_CURRENT` tracks the streams used for terminal input and output,
 *   together with the output methods captured for those streams.
 *
 * Stream objects are exposed through getters rather than as a mutable
 * collection. Output code obtains a captured writer and its correct receiver
 * through {@link getWritingCTX}.
 *
 * This class does not install or uninstall interception. Replacement is
 * coordinated by the root terminal I/O layer. `restoreCurrent()` restores
 * methods on the currently configured streams without changing the stream
 * objects; `restoreProcess()` switches the configured references back to
 * the startup process streams.
 *
 * @since 1.0.0
 */
class TerminalStreams {
    readonly #_PROCESS = Object.freeze({
        STREAMS: Object.freeze({
            stdout: process.stdout,
            stderr: process.stderr,
            stdin: process.stdin
        }),
        METHOD_REFERENCES: Object.freeze({
            stdout: captureStream(process.stdout),
            stderr: captureStream(process.stderr),
            console: globalThis.console
        })
    });

    readonly #_CURRENT = Object.freeze({
        STREAMS: Object.seal({ ...this.#_PROCESS.STREAMS }),
        METHOD_REFERENCES: Object.seal({ ...this.#_PROCESS.METHOD_REFERENCES })
    });

    /**
     * Gets the captured writer and configured stream receiver for an output.
     *
     * The pair must be used together: the writer is invoked with `thisCTX` as
     * its receiver so the stream implementation retains its expected
     * behavior.
     *
     * @param isError - Whether the destination is stderr rather than stdout.
     * @returns The captured writer snapshot and its configured stream receiver.
     * @since 1.0.0
     */
    getWritingCTX(isError: boolean) {
        const { STREAMS, METHOD_REFERENCES } = this.#_CURRENT;

        return Object.freeze({
            writer: METHOD_REFERENCES[isError ? 'stderr' : 'stdout'],
            thisCTX: STREAMS[isError ? 'stderr' : 'stdout']
        })
    }

    /**
     * Gets the currently configured stdin stream.
     *
     * @returns The active stdin stream.
     * @since 1.0.0
     */
    get input() { return this.#_CURRENT.STREAMS.stdin; }

    /**
     * Gets the currently configured stdout stream.
     *
     * @returns The active stdout stream.
     * @since 1.0.0
     */
    get output() { return this.#_CURRENT.STREAMS.stdout; }

    /**
     * Gets the currently configured stderr stream.
     *
     * @returns The active stderr stream.
     * @since 1.0.0
     */
    get error() { return this.#_CURRENT.STREAMS.stderr; }

    readonly #_restore = {
        process: {
            stdout: () => {
                const original = this.#_PROCESS.STREAMS.stdout;
                const target = this.#_CURRENT.STREAMS.stdout;

                this.#_CURRENT.STREAMS.stdout = original;
                restoreStream(original, target);
            },
            stderr: () => {
                const original = this.#_PROCESS.STREAMS.stderr;
                const target = this.#_CURRENT.STREAMS.stderr;

                this.#_CURRENT.STREAMS.stderr = original;
                restoreStream(original, target);
            },
            stdin: () => {
                this.#_CURRENT.STREAMS.stdin = this.#_PROCESS.STREAMS.stdin;
            },
            console: () => {
                globalThis.console = this.#_PROCESS.METHOD_REFERENCES.console;
            }
        },

        current: {
            stdout: () => {
                const original = this.#_CURRENT.STREAMS.stdout;
                const target = this.#_CURRENT.METHOD_REFERENCES.stdout;

                restoreStream(original, target);
            },
            stderr: () => {
                const original = this.#_CURRENT.STREAMS.stderr;
                const target = this.#_CURRENT.METHOD_REFERENCES.stderr;

                restoreStream(original, target);
            },
            console: () => {
                globalThis.console = this.#_CURRENT.METHOD_REFERENCES.console;
            }
        }
    }

    /**
     * Reconfigures selected resources to use their startup process resources.
     *
     * For stdout and stderr, the configured stream reference is set back to
     * the startup process stream, then the supported method properties from
     * the stream that was active before the change are copied onto that
     * process stream. Stdin is reset by changing its configured reference.
     * Console restoration assigns the startup global console instance.
     *
     * This method does not uninstall interception; callers must coordinate
     * interception separately.
     *
     * @param target - Process resource to restore, or `all`.
     * @throws {Error} If `target` is not a supported resource name.
     * @since 1.0.0
     */
    restoreProcess(target: 'stdout' | 'stderr' | 'stdin' | 'console' | 'all' = 'all') {
        const restore = this.#_restore.process;

        if (target === 'all') {
            restore.stdout();
            restore.stderr();
            restore.stdin();
            restore.console();
        } else if (['stdout', 'stderr', 'stdin', 'console'].includes(target)) {
            restore[target]();
        } else {
            throw new Error(`Invalid restore target: ${target}`);
        }
    }

    /**
     * Restores captured methods on the currently configured output streams.
     *
     * Unlike {@link restoreProcess}, this method does not change the
     * configured stream objects. It restores stdout/stderr methods and can
     * restore the console instance captured for the current configuration.
     *
     * @param target - Current output resource to restore, or `all`.
     * @throws {Error} If `target` is not a supported resource name.
     * @since 1.0.0
     */
    restoreCurrent(target: 'stdout' | 'stderr' | 'console' | 'all' = 'all') {
        const restore = this.#_restore.current;

        if (target === 'all') {
            restore.stdout();
            restore.stderr();
            restore.console();
        } else if (['stdout', 'stderr'].includes(target)) {
            restore[target]();
        } else {
            throw new Error(`Invalid restore target: ${target}`);
        }
    }

    /**
     * Replaces selected streams in the current terminal I/O configuration.
     *
     * Replacement stdout and stderr methods are captured for subsequent
     * physical writes and interception. Omitted streams retain their current
     * configuration. The caller must ensure interception is inactive before
     * invoking this operation.
     *
     * This changes the terminal I/O configuration; it does not replace the
     * Node.js `process` stream properties. The supplied values must conform
     * to the corresponding Node.js standard-stream interfaces.
     *
     * @param streams - Optional stdout, stderr, and stdin replacements.
     * @param streams.output - Replacement stdout stream.
     * @param streams.error - Replacement stderr stream.
     * @param streams.input - Replacement stdin stream.
     * @since 1.0.0
     */
    replace(
        streams: {
            output?: unknown,
            error?: unknown,
            input?: unknown
        }
    ) {
        if (streams.output) {
            const target = streams.output as StdoutStream;

            this.#_CURRENT.STREAMS.stdout = target;
            this.#_CURRENT.METHOD_REFERENCES.stdout = captureStream(target);
        }

        if (streams.error) {
            const target = streams.error as StderrStream;

            this.#_CURRENT.STREAMS.stderr = target;
            this.#_CURRENT.METHOD_REFERENCES.stderr = captureStream(target);
        }

        if (streams.input) {
            this.#_CURRENT.STREAMS.stdin = streams.input as StdinStream;
        }
    }
}

/**
 * The process-wide manager for configured terminal streams.
 *
 * Input and output modules use this singleton to access the active stdin,
 * stdout, and stderr streams. Output code also uses it to obtain captured
 * stream methods with the correct receiver.
 *
 * @since 1.0.0
 */
const terminalStreams = new TerminalStreams();
export default terminalStreams;