import terminalIO from "@/core/terminal/io";
import StdMocks from "../../../mocks/std";

const output = terminalIO.output;

describe("TerminalOutput", () => {
    beforeEach(() => {
        output.flush();
        StdMocks.reset();
    });

    afterEach(() => {
        output.flush();
    });

    it("writes directly to the configured stdout and stderr streams", () => {
        expect(output.write("normal")).toBe(true);
        expect(output.write("problem", { isError: true })).toBe(true);

        expect(StdMocks.controller.getCalls(call =>
            call.source === "stdout" && call.command === "write"
        ).map(call => call.args[0])).toEqual(["normal"]);
        expect(StdMocks.controller.getCalls(call =>
            call.source === "stderr" && call.command === "write"
        ).map(call => call.args[0])).toEqual(["problem"]);
    });

    it("buffers queued writes until flush and preserves their order", () => {
        const descriptor = Object.getOwnPropertyDescriptor(terminalIO, "isReady");
        Object.defineProperty(terminalIO, "isReady", {
            configurable: true,
            value: false
        });

        try {
            expect(output.queue("first")).toBe(true);
            expect(output.queue("second", { isError: true })).toBe(true);

            expect(StdMocks.controller.getCalls(call => call.command === "write"))
                .toHaveLength(0);

            output.flush();

            expect(
                StdMocks.controller.getCalls(call => call.command === "write")
                    .map(call => call.args[0])
            ).toEqual(["first", "second"]);
        } finally {
            if (descriptor) {
                Object.defineProperty(terminalIO, "isReady", descriptor);
            } else {
                Reflect.deleteProperty(terminalIO, "isReady");
            }
        }
    });

    it("writes cursor and erase control sequences through stdout", () => {
        expect(output.cursorTo(4)).toBe(true);
        expect(output.cursorTo(4, 9)).toBe(true);
        expect(output.clearLine(-1)).toBe(true);
        expect(output.clearScreenDown()).toBe(true);

        const writes = StdMocks.controller
            .getCalls(call => call.source === "stdout" && call.command === "write")
            .map(call => call.args[0]);

        expect(writes).toEqual([
            "\x1b[5G",
            "\x1b[10;5H",
            "\x1b[2K",
            "\x1b[0J"
        ]);
    });

    it("derives output TTY status from both configured output streams", () => {
        expect(output.isTTY).toBe(
            StdMocks.stdout.isTTY === true && StdMocks.stderr.isTTY === true
        );
    });
});
