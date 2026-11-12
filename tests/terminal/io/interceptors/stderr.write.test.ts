import terminalIO from "@/core/terminal/io";
import zexiTerminal from "@/core/terminal/zexi.terminal";
import stderrWriteInterceptor from "@/core/terminal/io/output/interception/interceptors/stderr.write";
import type { TerminalCell } from "@/core/terminal/types";

describe("stderrWriteInterceptor()", () => {
    beforeEach(() => {
        terminalIO.output.interception.intercepting = false;
    });

    afterEach(() => {
        terminalIO.output.interception.intercepting = false;
        mock.restore();
    });

    it("queues the request when interception is disabled", () => {
        const queue = spyOn(terminalIO.output, "queue").mockReturnValue(true);
        const callback = mock();

        expect(stderrWriteInterceptor("Hello", "utf8", callback)).toBe(true);

        expect(queue).toHaveBeenCalledTimes(1);
        expect(queue).toHaveBeenCalledWith("Hello", {
            callback,
            encoding: "utf8",
            isError: true
        });
    });

    it("returns the result from terminalIO.queue() when interception is disabled", () => {
        const queue = spyOn(terminalIO.output, "queue").mockReturnValue(false);

        expect(stderrWriteInterceptor("Hello")).toBe(false);

        expect(queue).toHaveBeenCalledTimes(1);
        expect(queue).toHaveBeenCalledWith("Hello", {
            callback: undefined,
            encoding: undefined,
            isError: true
        });
    });

    it("creates a Zexi entry when interception is enabled", () => {
        terminalIO.output.interception.intercepting = true;

        const createEntry = spyOn(zexiTerminal, "createEntry").mockResolvedValue({} as TerminalCell);

        expect(stderrWriteInterceptor("Hello")).toBe(true);

        expect(createEntry).toHaveBeenCalledTimes(1);
        expect(createEntry).toHaveBeenCalledWith(
            {
                value: "Hello",
                final: true
            },
            {
                log: true,
                level: "info"
            }
        );
    });

    it("removes trailing newlines before creating the entry", () => {
        terminalIO.output.interception.intercepting = true;

        const createEntry = spyOn(zexiTerminal, "createEntry").mockResolvedValue({} as TerminalCell);

        stderrWriteInterceptor("Hello\r\n\n");

        expect(createEntry).toHaveBeenCalledTimes(1);
        expect(createEntry).toHaveBeenCalledWith(
            {
                value: "Hello",
                final: true
            },
            {
                log: true,
                level: "info"
            }
        );
    });

    it("converts binary output to text before creating the entry", () => {
        terminalIO.output.interception.intercepting = true;

        const createEntry = spyOn(zexiTerminal, "createEntry").mockResolvedValue({} as TerminalCell);

        stderrWriteInterceptor(
            new Uint8Array([72, 101, 108, 108, 111]),
            "utf8"
        );

        expect(createEntry).toHaveBeenCalledTimes(1);
        expect(createEntry).toHaveBeenCalledWith(
            {
                value: "Hello",
                final: true
            },
            {
                log: true,
                level: "info"
            }
        );
    });

    it("invokes the original callback after the entry completes", async () => {
        terminalIO.output.interception.intercepting = true;

        const callback = mock();
        stderrWriteInterceptor("Hello", callback);

        expect(callback).not.toHaveBeenCalled();

        await zexiTerminal.drain();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it("writes the fallback output to stderr when entry creation fails", async () => {
        terminalIO.output.interception.intercepting = true;

        spyOn(zexiTerminal, "createEntry").mockRejectedValue(new Error("Something went wrong"));

        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);

        stderrWriteInterceptor("Hello");

        await zexiTerminal.drain();

        expect(write).toHaveBeenCalledTimes(3);

        expect(write).toHaveBeenNthCalledWith(
            1,
            "[Zexi] Failed to print entry: Something went wrong\n",
            { isError: true }
        );

        expect(write).toHaveBeenNthCalledWith(
            2,
            "Something went wrong",
            { isError: true }
        );

        expect(write).toHaveBeenNthCalledWith(
            3,
            "Hello",
            { isError: true }
        );
    });

    it("invokes the original callback when entry creation fails", async () => {
        terminalIO.output.interception.intercepting = true;

        const callback = mock();

        spyOn(zexiTerminal, "createEntry").mockRejectedValue(new Error("Something went wrong"));

        stderrWriteInterceptor("Hello", callback);

        await Promise.resolve(); // rejection continuation (.catch)
        await Promise.resolve(); // subsequent .finally

        expect(callback).toHaveBeenCalledTimes(1);
    });
});