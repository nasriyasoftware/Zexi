import KeyInputParser from "@/core/terminal/io/input/assets/parser/key.input.parser";

async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 1_000;

    while (!predicate() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }

    expect(predicate()).toBe(true);
}

describe("KeyInputParser", () => {
    it("parses ordinary, editing, enter, and control keys in order", async () => {
        const parser = new KeyInputParser();
        const keys: unknown[] = [];
        parser.onKeyInput(key => keys.push(key));

        parser.dataParser(Buffer.from("ab\x7f\r\x03"));

        await waitFor(() => keys.length === 5);

        expect(keys).toEqual([
            { type: "character", value: "a" },
            { type: "character", value: "b" },
            { type: "backspace" },
            { type: "enter" },
            { type: "ctrl", value: "c" }
        ]);
    });

    it("parses arrow-key CSI sequences from buffered input", async () => {
        const parser = new KeyInputParser();
        const keys: unknown[] = [];
        parser.onKeyInput(key => keys.push(key));

        parser.dataParser(Buffer.from("\x1b[A\x1b[B\x1b[C\x1b[D"));

        await waitFor(() => keys.length === 4);

        expect(keys).toEqual([
            { type: "up" },
            { type: "down" },
            { type: "right" },
            { type: "left" }
        ]);
    });

    it("assembles a CSI sequence split across input chunks", async () => {
        const parser = new KeyInputParser();
        const keys: unknown[] = [];
        parser.onKeyInput(key => keys.push(key));

        parser.dataParser(Buffer.from("\x1b["));
        parser.dataParser(Buffer.from("C"));

        await waitFor(() => keys.length === 1);

        expect(keys).toEqual([{ type: "right" }]);
    });

    it("replaces the previously registered key callback", async () => {
        const parser = new KeyInputParser();
        const previous = mock();
        const current = mock();

        parser.onKeyInput(previous);
        parser.onKeyInput(current);
        parser.dataParser(Buffer.from("x"));

        await waitFor(() => current.mock.calls.length === 1);

        expect(previous).not.toHaveBeenCalled();
        expect(current).toHaveBeenCalledWith({
            type: "character",
            value: "x"
        });
    });
});
