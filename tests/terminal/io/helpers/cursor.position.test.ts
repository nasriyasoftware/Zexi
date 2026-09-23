import StdMocks from "../../../mocks/std";
import queryCursorPosition from "../../../../src/core/terminal/io/helpers/cursor.position";
import { CURSOR_POSITION_RESPONSE } from "../../../mocks/std/controller";

describe("queryCursorPosition()", () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();
    });

    it("rejects when stdin is not attached to a TTY", async () => {
        StdMocks.stdin.isTTY = false;

        expect(queryCursorPosition()).rejects.toThrow("stdin is not a TTY");

        StdMocks.expect.stdin.setRawMode.toNot.haveBeenCalled();
        StdMocks.expect.stdin.resume.toNot.haveBeenCalled();
        StdMocks.expect.stdin.pause.toNot.haveBeenCalled();
        StdMocks.expect.stdin.on.toNot.haveBeenCalled();
    });

    it("configures stdin and requests the cursor position", async () => {
        const promise = queryCursorPosition();

        StdMocks.expect.stdin.setRawMode.toHaveBeenCalledWith(true);
        StdMocks.expect.stdin.resume.toHaveBeenCalled();
        StdMocks.expect.stdin.on.toHaveBeenCalledWith("data");

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("\x1b[6n", { ignoreAnsi: false });

        expect(promise).resolves.toEqual(CURSOR_POSITION_RESPONSE);
    });

    it("ignores unrelated input", async () => {
        const promise = queryCursorPosition();

        StdMocks.expect.stdin.setRawMode.toHaveBeenCalledWith(true);
        
        StdMocks.stdin.emit("data", Buffer.from("hello"));
        
        StdMocks.expect.stdin.setRawMode.toNot.haveBeenCalledWith(false);
        StdMocks.expect.stdin.off.toNot.haveBeenCalled();
        StdMocks.expect.stdin.pause.toNot.haveBeenCalled();

        expect(promise).resolves.toEqual(CURSOR_POSITION_RESPONSE);
    });

    it("resolves with the cursor position reported by the terminal", async () => {
        const promise = queryCursorPosition();

        StdMocks.stdin.emit("data", Buffer.from("\x1b[25;80R"));

        expect(promise).resolves.toEqual({ row: 25, column: 80 });
    });

    it("returns an immutable cursor position", async () => {
        const promise = queryCursorPosition();

        StdMocks.stdin.emit("data", Buffer.from("\x1b[12;34R"));

        const position = await promise;

        expect(Object.isFrozen(position)).toBe(true);
    });

    it("cleans up stdin after receiving a valid response", async () => {
        const promise = queryCursorPosition();

        StdMocks.stdin.emit("data", Buffer.from("\x1b[12;34R"));

        await promise;

        StdMocks.expect.stdin.off.toHaveBeenCalledWith("data");
        StdMocks.expect.stdin.setRawMode.toHaveBeenCalledWith(false);
        StdMocks.expect.stdin.pause.toHaveBeenCalledTimes(1);
    });

    it("rejects when the terminal does not respond within the timeout", async () => {
        expect(queryCursorPosition(10)).rejects.toThrow("Timeout: No cursor-position response received");
    });

    it("cleans up stdin after timing out", async () => {
        expect(queryCursorPosition(10)).rejects.toThrow("Timeout: No cursor-position response received");

        StdMocks.expect.stdin.off.toHaveBeenCalledWith("data");
        StdMocks.expect.stdin.setRawMode.toHaveBeenCalledWith(false);
        StdMocks.expect.stdin.pause.toHaveBeenCalledTimes(1);
    });

    it("ignores malformed cursor-position responses", async () => {
        const promise = queryCursorPosition(50);

        StdMocks.stdin.emit("data", Buffer.from("\x1b[abc;42R"));
        StdMocks.stdin.emit("data", Buffer.from("\x1b[18;abcR"));

        StdMocks.expect.stdin.off.toNot.haveBeenCalled();

        expect(promise).rejects.toThrow("Timeout: No cursor-position response received");
    });
});