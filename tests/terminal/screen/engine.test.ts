import terminalIO from "@/core/terminal/io";
import ScreenCell from "@/core/terminal/screen/tom/cells/cell";
import ScreenEngine from "@/core/terminal/screen/engine";
import TerminalCell from "@/core/terminal/screen/tom/cells/terminal.cell";
import StdMocks from "../../mocks/std";

const originalDescriptors = {
    width: Object.getOwnPropertyDescriptor(terminalIO, "width"),
    height: Object.getOwnPropertyDescriptor(terminalIO, "height"),
    initialCursor: Object.getOwnPropertyDescriptor(terminalIO, "initialCursor"),
    isReady: Object.getOwnPropertyDescriptor(terminalIO, "isReady")
};

const setTerminalReady = () => {
    Object.defineProperties(terminalIO, {
        width: { configurable: true, value: 80 },
        height: { configurable: true, value: 24 },
        initialCursor: {
            configurable: true,
            value: { row: 1, column: 1 }
        },
        isReady: { configurable: true, value: true }
    });
};

const restoreTerminal = () => {
    for (const [key, descriptor] of Object.entries(originalDescriptors)) {
        if (descriptor) {
            Object.defineProperty(terminalIO, key, descriptor);
        } else {
            Reflect.deleteProperty(terminalIO, key);
        }
    }
};

describe("ScreenEngine", () => {
    let engine: ScreenEngine;

    beforeEach(() => {
        StdMocks.reset();
        setTerminalReady();
        engine = new ScreenEngine();
    });

    afterEach(() => {
        engine.clear();
        restoreTerminal();
    });

    it("creates an internal ScreenCell by default", () => {
        expect(engine.create({ value: "Hello" })).toBeInstanceOf(ScreenCell);
    });

    it("creates a TerminalCell for the external target", () => {
        expect(
            engine.create({ value: "Hello" }, "external")
        ).toBeInstanceOf(TerminalCell);
    });

    it("renders initial content through the terminal viewport", () => {
        engine.create({ value: "Hello" });

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Hello");
    });

    it("renders the initial value produced by a template", () => {
        engine.create({
            template: "Hello ${name}",
            params: { name: "World" }
        });

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Hello World");
    });

    it("updates the rendered content when a cell changes", () => {
        const cell = engine.create({ value: "Waiting" });

        StdMocks.reset();
        cell.update("Complete");

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Complete");
    });

    it("clears rendered rows when the last cell is removed", () => {
        const cell = engine.create({ value: "Temporary" });

        StdMocks.reset();
        cell.remove();

        StdMocks.expect.stdout.clearLine.toHaveBeenCalled();
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("");
        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("Temporary");
    });

    it("clears entries and viewport state before rendering new content", () => {
        const previousCell = engine.create({ value: "Same content" });

        StdMocks.reset();
        engine.clear();
        StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();

        StdMocks.reset();
        previousCell.update("Stale content");
        StdMocks.expect.stdout.write.toNot.haveBeenCalled();

        engine.create({ value: "Same content" });
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Same content");
        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("Stale content");
    });
});
