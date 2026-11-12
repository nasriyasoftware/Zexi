import StdMocks from "../../../../mocks/std";
import TerminalSizeDispatcher from "@/core/terminal/io/input/query/dispatchers/terminalSize.dispatcher";
import terminalIO from "@/core/terminal/io";

async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 1_000;

    while (!predicate() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }

    expect(predicate()).toBe(true);
}

async function waitForCleanup() {
    await waitFor(() => StdMocks.controller.getCalls(call =>
        call.source === 'stdin' &&
        call.command === 'setRawMode' &&
        call.args[0] === false
    ).length > 0);
}

function emitStdin(data: string) {
    StdMocks.stdin.emit('data', Buffer.from(data));
}

describe.serial("TerminalSizeDispatcher", () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();
    });

    it("writes the window-size query and resolves immutable dimensions", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const promise = new TerminalSizeDispatcher().dispatch();

        await waitFor(() => write.mock.calls.length > 0);

        expect(write).toHaveBeenCalledWith("\x1b[18t");

        emitStdin("\x1b[8;24;80t");

        const size = await promise;
        expect(size).toEqual({ height: 24, width: 80 });
        expect(Object.isFrozen(size)).toBe(true);

        await waitForCleanup();
    });

    it("assembles a window-size response split across stdin chunks", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const promise = new TerminalSizeDispatcher().dispatch();

        await waitFor(() => write.mock.calls.length > 0);

        emitStdin("\x1b[8;24;");
        emitStdin("80t");

        await expect(promise).resolves.toEqual({ height: 24, width: 80 });
        await waitForCleanup();
    });

    it("rejects when the terminal does not answer before the timeout", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const promise = new TerminalSizeDispatcher(25).dispatch();

        await waitFor(() => write.mock.calls.length > 0);

        const error = await promise.then(
            () => { throw new Error("Expected terminal-size query to time out"); },
            reason => reason
        );

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Unable to query terminal size");
        await waitForCleanup();
    });
});
