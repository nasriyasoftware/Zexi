import { EventEmitter } from "node:events";
import type CursorPosition from "../../../src/core/terminal/screen/cursor-position";

describe("CursorPosition", () => {
    let cursorPosition: typeof CursorPosition;
    let stdin: EventEmitter & {
        isTTY: boolean;
        setRawMode: jest.Mock;
        resume: jest.Mock;
        pause: jest.Mock;
    };

    let stdoutWrite: jest.SpyInstance;

    beforeEach(() => {
        jest.resetModules();

        stdin = Object.assign(new EventEmitter(), {
            isTTY: true,
            setRawMode: jest.fn(),
            resume: jest.fn(),
            pause: jest.fn()
        });

        Object.defineProperty(process, "stdin", {
            configurable: true,
            value: stdin
        });

        cursorPosition = require(
            "../../../src/core/terminal/screen/cursor-position"
        ).default;

        stdoutWrite = jest
            .spyOn(process.stdout, "write")
            .mockImplementation(() => true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe("initial state", () => {
        it("starts in standby state", () => {
            expect(cursorPosition.state).toBe("standby");
        });

        it("starts uninitialized", () => {
            expect(cursorPosition.initialized).toBe(false);
        });

        it("returns the default row before initialization", () => {
            expect(cursorPosition.row).toBe(1);
        });

        it("returns the default column before initialization", () => {
            expect(cursorPosition.column).toBe(0);
        });
    });

    describe("initialize()", () => {
        it("transitions to initializing while waiting for a response", () => {
            const initialization = cursorPosition.initialize();

            expect(cursorPosition.state).toBe("initializing");
            expect(cursorPosition.initialized).toBe(false);

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            return initialization;
        });

        it("requests the terminal cursor position", async () => {
            const initialization = cursorPosition.initialize();

            expect(stdoutWrite).toHaveBeenCalledWith("\x1b[6n");

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await initialization;
        });

        it("captures the reported cursor position", async () => {
            const initialization = cursorPosition.initialize();

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await initialization;

            expect(cursorPosition.row).toBe(12);
            expect(cursorPosition.column).toBe(34);
        });

        it("transitions to ready after a successful response", async () => {
            const initialization = cursorPosition.initialize();

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await initialization;

            expect(cursorPosition.state).toBe("ready");
            expect(cursorPosition.initialized).toBe(true);
        });

        it("ignores unrelated input", async () => {
            const initialization = cursorPosition.initialize();

            stdin.emit("data", Buffer.from("hello"));
            stdin.emit("data", Buffer.from("\x1b[12;34X"));

            expect(cursorPosition.state).toBe("initializing");
            expect(cursorPosition.initialized).toBe(false);

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await initialization;

            expect(cursorPosition.row).toBe(12);
            expect(cursorPosition.column).toBe(34);
        });

        it("accepts a valid response embedded in unrelated input", async () => {
            const initialization = cursorPosition.initialize();

            stdin.emit(
                "data",
                Buffer.from("unrelated\x1b[12;34Rother")
            );

            await initialization;

            expect(cursorPosition.row).toBe(12);
            expect(cursorPosition.column).toBe(34);
        });

        it("restores stdin after successful initialization", async () => {
            const setRawMode = stdin.setRawMode as jest.Mock;
            const pause = stdin.pause as jest.Mock;

            const initialization = cursorPosition.initialize();

            expect(setRawMode).toHaveBeenCalledWith(true);
            expect((stdin.resume as jest.Mock)).toHaveBeenCalled();

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await initialization;

            expect(setRawMode).toHaveBeenLastCalledWith(false);
            expect(pause).toHaveBeenCalled();
        });

        it("does nothing after successful initialization", async () => {
            const first = cursorPosition.initialize();

            stdin.emit("data", Buffer.from("\x1b[12;34R"));

            await first;

            stdoutWrite.mockClear();

            await cursorPosition.initialize();

            expect(stdoutWrite).not.toHaveBeenCalled();
            expect(cursorPosition.state).toBe("ready");
            expect(cursorPosition.initialized).toBe(true);
            expect(cursorPosition.row).toBe(12);
            expect(cursorPosition.column).toBe(34);
        });

        it("does nothing while initialization is already in progress", async () => {
            const first = cursorPosition.initialize();

            expect(cursorPosition.state).toBe("initializing");

            const second = cursorPosition.initialize();

            expect(cursorPosition.state).toBe("initializing");

            stdin.emit("data", Buffer.from("\x1b[5;8R"));

            await first;
            await second;

            expect(cursorPosition.state).toBe("ready");
            expect(cursorPosition.row).toBe(5);
            expect(cursorPosition.column).toBe(8);
            expect(stdoutWrite).toHaveBeenCalledTimes(1);
        });
    });

    describe("TTY requirements", () => {
        it("fails when stdin is not attached to a TTY", async () => {
            Object.defineProperty(stdin, "isTTY", {
                configurable: true,
                value: false
            });

            await expect(cursorPosition.initialize())
                .rejects
                .toThrow("stdin is not a TTY");

            expect(cursorPosition.state).toBe("failed");
            expect(cursorPosition.initialized).toBe(false);
        });
    });

    describe("timeout", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("fails when the terminal does not respond", async () => {
            const initialization = cursorPosition.initialize();

            jest.advanceTimersByTime(1000);

            await expect(initialization)
                .rejects
                .toThrow("Timeout: No cursor-position response received");

            expect(cursorPosition.state).toBe("failed");
            expect(cursorPosition.initialized).toBe(false);
        });

        it("restores stdin after timeout", async () => {
            const setRawMode = stdin.setRawMode as jest.Mock;
            const pause = stdin.pause as jest.Mock;

            const initialization = cursorPosition.initialize();

            jest.advanceTimersByTime(1000);

            await expect(initialization).rejects.toThrow();

            expect(setRawMode).toHaveBeenLastCalledWith(false);
            expect(pause).toHaveBeenCalled();
        });
    });

    describe("retry", () => {
        it("can be initialized again after failure", async () => {
            jest.useFakeTimers();

            const first = cursorPosition.initialize();

            jest.advanceTimersByTime(1000);

            await expect(first).rejects.toThrow();

            expect(cursorPosition.state).toBe("failed");

            jest.useRealTimers();

            const second = cursorPosition.initialize();

            expect(cursorPosition.state).toBe("initializing");

            stdin.emit("data", Buffer.from("\x1b[20;40R"));

            await second;

            expect(cursorPosition.state).toBe("ready");
            expect(cursorPosition.initialized).toBe(true);
            expect(cursorPosition.row).toBe(20);
            expect(cursorPosition.column).toBe(40);
        });
    });
});