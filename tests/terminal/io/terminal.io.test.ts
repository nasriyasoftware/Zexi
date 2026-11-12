import terminalIO, { ZexiTerminalIO } from "@/core/terminal/io";

describe("ZexiTerminalIO", () => {
    it("exports a shared process-wide coordinator", async () => {
        const { default: importedTerminalIO } = await import("@/core/terminal/io");

        expect(importedTerminalIO).toBe(terminalIO);
        expect(terminalIO).toBeInstanceOf(ZexiTerminalIO);
    });

    it("composes the input and output modules", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.input).toBe(terminalIO.input);
        expect(instance.output).toBe(terminalIO.output);
    });

    it("starts uninitialized and not ready", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.initialized).toBe(false);
        expect(instance.isReady).toBe(false);
    });

    it("defaults the initial cursor to row one, column one", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.initialCursor).toEqual({
            row: 1,
            column: 1,
        });
    });

    it("exposes terminal dimensions", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.width).toBeTypeOf("number");
        expect(instance.height).toBeTypeOf("number");
    });

    it("reports TTY status only when stdin and both output streams are TTYs", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.isTTY).toBe(
            instance.input.isTTY && instance.output.isTTY
        );
    });

    it("exposes the screen initialization lifecycle", () => {
        const instance = new ZexiTerminalIO();

        expect(instance.initState).toBeOneOf([
            "STANDBY",
            "INITIALIZING",
            "READY",
            "FAILED",
        ]);
    });
});
