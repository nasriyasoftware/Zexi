import interceptors from "../../../src/core/terminal/io/interceptors";
import StdMocks from "../../mocks/std";
import terminalIO, { ZexiTerminalIO } from "../../../src/core/terminal/io/terminal.io";
import type { CursorPosition } from "../../../src/core/terminal/io/types";

describe("ZexiTerminalIO", () => {
    let instance: ZexiTerminalIO | undefined;

    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();

        if (!terminalIO.intercepting) {
            terminalIO.intercepting = true;
        }

        instance?.uninstall();
        instance = undefined;
    });

    describe("initial state", () => {
        it("starts with interception enabled", () => {
            terminalIO.intercepting = true;

            expect(terminalIO.intercepting).toBe(true);
        });

        it("starts with interceptors installed", () => {
            expect(terminalIO.installed).toBe(true);
        });

        it("starts before terminal readiness", () => {
            const instance = new ZexiTerminalIO();

            expect(instance.ready).toBe(false);
        });
    });

    describe("intercepting", () => {
        it("disables active interception", () => {
            terminalIO.intercepting = false;

            expect(terminalIO.intercepting).toBe(false);
            expect(terminalIO.installed).toBe(true);
        });

        it("enables active interception", () => {
            terminalIO.intercepting = false;

            terminalIO.intercepting = true;

            expect(terminalIO.intercepting).toBe(true);
            expect(terminalIO.installed).toBe(true);
        });

        it("rejects non-boolean values", () => {
            expect(() => {
                terminalIO.intercepting = "true" as unknown as boolean;
            }).toThrow(TypeError);
        });

        it("does not reinstall already-installed interceptors when enabled", () => {
            const stdoutWrite = ZexiTerminalIO.streams.stdout.write;
            const stderrWrite = ZexiTerminalIO.streams.stderr.write;

            terminalIO.intercepting = true;

            expect(ZexiTerminalIO.streams.stdout.write).toBe(stdoutWrite);
            expect(ZexiTerminalIO.streams.stderr.write).toBe(stderrWrite);
        });

        it("does not change installation state when disabled", () => {
            terminalIO.intercepting = false;

            expect(terminalIO.installed).toBe(true);
        });
    });

    describe("onReady", () => {
        it("exposes the readiness handler", () => {
            expect(terminalIO.onReady).toBeTypeOf("function");
        });

        it("flushes queued writes when the terminal becomes ready", () => {
            const callback = mock();
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            instance.queue("Hello", { callback });

            expect(write).not.toHaveBeenCalled();
            expect(instance.ready).toBe(false);

            instance.onReady();

            expect(write).toHaveBeenCalledTimes(1);
            expect(write).toHaveBeenCalledWith("Hello", callback);
            expect(instance.ready).toBe(true);
        });
    });

    describe("queue()", () => {
        it("buffers output while the terminal is not ready", () => {
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            expect(instance.ready).toBe(false);

            instance.queue("Hello");

            expect(write).not.toHaveBeenCalled();

            instance.onReady();

            expect(write).toHaveBeenCalledTimes(1);
            expect(write).toHaveBeenCalledWith("Hello");
        });

        it("preserves the output stream selection", () => {
            const stdoutWrite = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);
            const stderrWrite = spyOn(ZexiTerminalIO.streams.stderr, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            instance.queue("stdout");
            instance.queue("stderr", { isError: true });

            instance.onReady();

            expect(stdoutWrite).toHaveBeenCalledWith("stdout");
            expect(stderrWrite).toHaveBeenCalledWith("stderr");
        });

        it("preserves encoding and callback", () => {
            const callback = mock();
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            instance.queue("Hello", {
                encoding: "utf8",
                callback
            });

            instance.onReady();

            expect(write).toHaveBeenCalledWith("Hello", "utf8", callback);
        });
    });

    describe("write()", () => {
        it("writes stdout output through the original stdout writer", () => {
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            expect(instance.write("Hello")).toBe(true);
            expect(write).toHaveBeenCalledWith("Hello");
        });

        it("writes stderr output when isError is true", () => {
            const write = spyOn(ZexiTerminalIO.streams.stderr, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            expect(instance.write("Hello", { isError: true })).toBe(true);
            expect(write).toHaveBeenCalledWith("Hello");
        });

        it("forwards the encoding", () => {
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            instance.write("Hello", { encoding: "utf8" });

            expect(write).toHaveBeenCalledWith("Hello", "utf8", undefined);
        });

        it("forwards the callback", () => {
            const callback = mock();
            const write = spyOn(ZexiTerminalIO.streams.stdout, "write")
                .mockReturnValue(true);

            instance = new ZexiTerminalIO();

            instance.write("Hello", { callback });

            expect(write).toHaveBeenCalledWith("Hello", callback);
        });
    });

    describe("cursorTo()", () => {
        it("writes a horizontal cursor-positioning sequence", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            expect(terminalIO.cursorTo(4)).toBe(true);
            expect(write).toHaveBeenCalledWith("\x1b[5G", { callback: undefined });
        });

        it("writes a two-dimensional cursor-positioning sequence", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.cursorTo(4, 9);

            expect(write).toHaveBeenCalledWith("\x1b[10;5H", { callback: undefined });
        });

        it("forwards the callback when used as the second argument", () => {
            const callback = mock();
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.cursorTo(4, callback);

            expect(write).toHaveBeenCalledWith("\x1b[5G", { callback });
        });

        it("forwards the callback when used as the third argument", () => {
            const callback = mock();
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.cursorTo(4, 9, callback);

            expect(write).toHaveBeenCalledWith("\x1b[10;5H", { callback });
        });
    });

    describe("clearLine()", () => {
        it.each([
            [-1, "\x1b[2K"],
            [0, "\x1b[0K"],
            [1, "\x1b[1K"]
        ] as const)(
            "writes the correct sequence for direction %i",
            (direction, sequence) => {
                const write = spyOn(terminalIO, "write").mockReturnValue(true);

                expect(terminalIO.clearLine(direction)).toBe(true);
                expect(write).toHaveBeenCalledWith(sequence, { callback: undefined });
            }
        );

        it("uses direction 0 by default", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.clearLine();

            expect(write).toHaveBeenCalledWith("\x1b[0K", { callback: undefined });
        });

        it("forwards the callback", () => {
            const callback = mock();
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.clearLine(1, callback);

            expect(write).toHaveBeenCalledWith("\x1b[1K", { callback });
        });
    });

    describe("clearScreenDown()", () => {
        it("writes the screen-clear sequence", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            expect(terminalIO.clearScreenDown()).toBe(true);
            expect(write).toHaveBeenCalledWith("\x1b[0J", { callback: undefined });
        });

        it("forwards the callback", () => {
            const callback = mock();
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.clearScreenDown(callback);

            expect(write).toHaveBeenCalledWith("\x1b[0J", { callback });
        });
    });

    describe("moveCursor()", () => {
        it("moves the cursor vertically", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(0, -2);

            expect(write).toHaveBeenCalledWith("\x1b[2A", { callback: undefined });
        });

        it("moves the cursor down", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(0, 3);

            expect(write).toHaveBeenCalledWith("\x1b[3B", { callback: undefined });
        });

        it("moves the cursor horizontally", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(4, 0);

            expect(write).toHaveBeenCalledWith("\x1b[4C", { callback: undefined });
        });

        it("moves the cursor left", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(-4, 0);

            expect(write).toHaveBeenCalledWith("\x1b[4D", { callback: undefined });
        });

        it("combines horizontal and vertical movement", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(4, -2);

            expect(write).toHaveBeenCalledWith("\x1b[2A\x1b[4C", { callback: undefined });
        });

        it("writes nothing when there is no movement", () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(0, 0);

            expect(write).toHaveBeenCalledWith("", { callback: undefined });
        });

        it("forwards the callback", () => {
            const callback = mock();
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminalIO.moveCursor(4, -2, callback);

            expect(write).toHaveBeenCalledWith("\x1b[2A\x1b[4C", { callback });
        });
    });

    describe("queryCursorPosition()", () => {
        it("delegates to the cursor-position helper", async () => {
            const position: CursorPosition = {
                row: 10,
                column: 20
            };

            const query = spyOn(
                await import("../../../src/core/terminal/io/helpers/cursor.position"),
                "default"
            ).mockResolvedValue(position);

            await expect(terminalIO.queryCursorPosition()).resolves.toEqual(position);
            expect(query).toHaveBeenCalledTimes(1);
        });
    });

    describe("uninstall()", () => {
        it("removes the installed interceptors", () => {
            const originals = {
                stdout: ZexiTerminalIO.streams.stdout,
                stderr: ZexiTerminalIO.streams.stderr
            }

            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            const outputWrite = output.write;
            const errorWrite = error.write;

            try {
                terminalIO.replaceStreams({ output, error });

                expect(ZexiTerminalIO.streams.stdout.write).toBe(interceptors.stdoutWrite);
                expect(ZexiTerminalIO.streams.stderr.write).toBe(interceptors.stderrWrite);

                terminalIO.uninstall();

                expect(ZexiTerminalIO.streams.stdout.write).toBe(outputWrite as any);
                expect(ZexiTerminalIO.streams.stderr.write).toBe(errorWrite as any);
            } finally {
                terminalIO.replaceStreams({
                    output: originals.stdout,
                    error: originals.stderr
                });
            }
        });
    });

    describe("replaceStreams()", () => {
        it("replaces the managed terminal streams", () => {
            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            instance = new ZexiTerminalIO();

            instance.replaceStreams({ output, error });

            expect(ZexiTerminalIO.streams.stdout).toBe(output as any);
            expect(ZexiTerminalIO.streams.stderr).toBe(error as any);
        });

        it("rebinds the original stream operations", () => {
            const originals = {
                output: ZexiTerminalIO.streams.stdout,
                error: ZexiTerminalIO.streams.stderr
            }

            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            try {
                const stdoutWrite = spyOn(output, 'write');
                const stderrWrite = spyOn(error, 'write');

                terminalIO.replaceStreams({ output, error });

                terminalIO.write('stdout');
                terminalIO.write('stderr', { isError: true });

                expect(stdoutWrite).toHaveBeenCalledWith('stdout');
                expect(stderrWrite).toHaveBeenCalledWith('stderr');
            } finally {
                terminalIO.replaceStreams({
                    output: originals.output,
                    error: originals.error
                });
            }
        });

        it("restores the replacement streams' original operations when uninstalled", () => {
            const originals = {
                output: ZexiTerminalIO.streams.stdout,
                error: ZexiTerminalIO.streams.stderr
            }

            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            const outputWrite = output.write;
            const errorWrite = error.write;

            try {
                terminalIO.replaceStreams({ output, error });

                expect(ZexiTerminalIO.streams.stdout.write).toBe(interceptors.stdoutWrite);
                expect(ZexiTerminalIO.streams.stderr.write).toBe(interceptors.stderrWrite);

                terminalIO.uninstall();

                expect(ZexiTerminalIO.streams.stdout.write).toBe(outputWrite as any);
                expect(ZexiTerminalIO.streams.stderr.write).toBe(errorWrite as any);
            } finally {
                terminalIO.replaceStreams({
                    output: originals.output,
                    error: originals.error
                });
            }
        });

        it("preserves the interception state when replacing streams", () => {
            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            instance = new ZexiTerminalIO();

            expect(instance.intercepting).toBe(true);
            expect(instance.installed).toBe(true);

            instance.replaceStreams({ output, error });

            expect(instance.intercepting).toBe(true);
            expect(instance.installed).toBe(true);
            expect(output.write).toBe(interceptors.stdoutWrite as typeof output.write);
            expect(error.write).toBe(interceptors.stderrWrite as typeof error.write);
        });

        it("does not enable interception when it was disabled before replacement", () => {
            const output = StdMocks.createNewMock('stdout');
            const error = StdMocks.createNewMock('stderr');

            instance = new ZexiTerminalIO();

            instance.intercepting = false;
            instance.replaceStreams({ output, error });

            expect(instance.intercepting).toBe(false);
            expect(instance.installed).toBe(false);
            expect(output.write).not.toBe(interceptors.stdoutWrite);
            expect(error.write).not.toBe(interceptors.stderrWrite);
        });
    });
});