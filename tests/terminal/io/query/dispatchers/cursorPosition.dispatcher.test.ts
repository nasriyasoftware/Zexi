import StdMocks from "../../../../mocks/std";
import CursorPositionDispatcher from "@/core/terminal/io/input/query/dispatchers/cursorPosition.dispatcher";
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

describe.serial("CursorPositionDispatcher", () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();
    });

    it("writes the cursor query and resolves an immutable position", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const dispatcher = new CursorPositionDispatcher();
        const promise = dispatcher.dispatch();

        await waitFor(() => write.mock.calls.length > 0);

        expect(write).toHaveBeenCalledWith("\x1b[6n");

        emitStdin("\x1b[25;80R");

        const position = await promise;
        expect(position).toEqual({ row: 25, column: 80 });
        expect(Object.isFrozen(position)).toBe(true);

        await waitForCleanup();
    });

    it("assembles a cursor response split across stdin chunks", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const promise = new CursorPositionDispatcher().dispatch();

        await waitFor(() => write.mock.calls.length > 0);

        emitStdin("\x1b[12;");
        emitStdin("34R");

        await expect(promise).resolves.toEqual({ row: 12, column: 34 });
        await waitForCleanup();
    });

    it("ignores malformed responses and rejects when the response times out", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        const promise = new CursorPositionDispatcher(25).dispatch();

        await waitFor(() => write.mock.calls.length > 0);
        emitStdin("\x1b[abc;42R");
        emitStdin("\x1b[18;abcR");

        const error = await promise.then(
            () => { throw new Error("Expected cursor-position query to time out"); },
            reason => reason
        );

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Unable to query cursor position");
        await waitForCleanup();
    });

    it("rejects if the controller cannot enable raw input", async () => {
        const write = spyOn(terminalIO.output, "write").mockReturnValue(true);
        StdMocks.stdin.setRawMode.mockImplementationOnce(() => {
            throw new Error("Raw mode is unavailable");
        });

        const promise = new CursorPositionDispatcher().dispatch();

        await expect(promise).rejects.toBeInstanceOf(AggregateError);
        expect(write).not.toHaveBeenCalled();

        await waitForCleanup();
    });
});
