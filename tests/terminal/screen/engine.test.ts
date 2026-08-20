import { StdoutMock } from "../../mocks/stdout.mock";
import ScreenCell from "../../../src/core/terminal/screen/cell";
import TerminalEntry from "../../../src/core/terminal/screen/terminal-cell";
import ScreenEngine from "../../../src/core/terminal/screen/engine";

jest.mock("../../../src/core/terminal/screen/cursor-position", () => ({
    __esModule: true,
    default: {
        initialized: true,
        row: 1,
        column: 0
    }
}));

describe("ScreenEngine", () => {
    let mock: StdoutMock;
    let engine: ScreenEngine;

    beforeEach(() => {
        mock = new StdoutMock();

        Object.defineProperty(process, "stdout", {
            value: mock,
            configurable: true
        });

        engine = new ScreenEngine();
    });

    afterEach(() => {
        mock.reset();
    });

    describe("create()", () => {
        it("creates an internal ScreenCell by default", () => {
            const cell = engine.create({
                value: "Hello\n"
            });

            expect(cell).toBeInstanceOf(ScreenCell);
        });

        it("creates a TerminalEntry for the external target", () => {
            const entry = engine.create(
                { value: "Hello\n" },
                "external"
            );

            expect(entry).toBeInstanceOf(TerminalEntry);
        });

        it("renders the initial value", () => {
            engine.create({
                value: "Hello\n"
            });

            expect(mock.write).toHaveBeenCalledWith("Hello\n");
        });

        it("renders multiple entries in order", () => {
            engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });
            engine.create({ value: "C\n" });

            expect(mock.write.mock.calls).toEqual([
                ["A\n"],
                ["B\n"],
                ["C\n"]
            ]);
        });

        it("throws when cursor position has not been initialized", () => {
            jest.resetModules();

            jest.isolateModules(() => {
                jest.doMock(
                    "../../../src/core/terminal/screen/cursor-position",
                    () => ({
                        __esModule: true,
                        default: {
                            initialized: false,
                            row: 1,
                            column: 0
                        }
                    })
                );

                const ScreenEngineWithoutCursor = require(
                    "../../../src/core/terminal/screen/engine"
                ).default;

                const instance = new ScreenEngineWithoutCursor();

                expect(() =>
                    instance.create({ value: "Hello\n" })
                ).toThrow(
                    "Attempting to create a cell before cursor position is initialized."
                );
            });
        });
    });

    describe("updates", () => {
        it("rewrites an entry when its height is unchanged", () => {
            const cell = engine.create({
                value: "Hello\n"
            });

            mock.reset();

            cell.update("World\n");

            expect(mock.clearLine).toHaveBeenCalled();
            expect(mock.clearScreenDown).not.toHaveBeenCalled();
            expect(mock.write).toHaveBeenCalledWith("World\n");
        });

        it("does nothing when the rendered value is unchanged", () => {
            const cell = engine.create({
                value: "Hello\n"
            });

            mock.reset();

            cell.update("Hello\n");

            expect(mock.write).not.toHaveBeenCalled();
            expect(mock.clearLine).not.toHaveBeenCalled();
            expect(mock.clearScreenDown).not.toHaveBeenCalled();
        });

        it("cascades when an entry height changes", () => {
            const a = engine.create({
                value: "A\n"
            });

            engine.create({
                value: "B\n"
            });

            mock.reset();

            a.update("A\nA2\n");

            expect(mock.clearScreenDown).toHaveBeenCalled();

            expect(mock.write).toHaveBeenCalledWith("A\nA2\n");
            expect(mock.write).toHaveBeenCalledWith("B\n");
        });

        it("does not cascade when an entry value changes without changing height", () => {
            const a = engine.create({
                value: "A\n"
            });

            engine.create({
                value: "B\n"
            });

            mock.reset();

            a.update("Updated A\n");

            expect(mock.clearScreenDown).not.toHaveBeenCalled();
            expect(mock.write).toHaveBeenCalledWith("Updated A\n");
            expect(mock.write).not.toHaveBeenCalledWith("B\n");
        });

        it("re-renders entries below an entry whose height decreases", () => {
            const a = engine.create({
                value: "A\nA2\nA3\n"
            });

            engine.create({
                value: "B\n"
            });

            mock.reset();

            a.update("A\n");

            expect(mock.clearScreenDown).toHaveBeenCalled();

            expect(mock.write).toHaveBeenCalledWith("A\n");
            expect(mock.write).toHaveBeenCalledWith("B\n");
        });
    });

    describe("cursor positioning", () => {
        it("positions entries according to their accumulated height", () => {
            engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });
            engine.create({ value: "C\n" });

            expect(mock.cursorTo).toHaveBeenCalledWith(0, 0);
            expect(mock.cursorTo).toHaveBeenCalledWith(0, 2);
            expect(mock.cursorTo).toHaveBeenCalledWith(0, 4);
        });

        it("restores the cursor to the end of the rendered output", () => {
            engine.create({
                value: "A\n"
            });

            engine.create({
                value: "B\n"
            });

            mock.reset();

            const cell = engine.create({
                value: "C\n"
            });

            mock.reset();

            cell.update("Updated\n");

            expect(mock.cursorTo).toHaveBeenLastCalledWith(0, 6);
        });

        it("restores the cursor to the new end after a height change", () => {
            const cell = engine.create({
                value: "A\n"
            });

            engine.create({
                value: "B\n"
            });

            mock.reset();

            cell.update("A\nA2\n");

            expect(mock.cursorTo).toHaveBeenLastCalledWith(0, 5);
        });
    });

    describe("newLine()", () => {
        it("reserves one line in the layout", () => {
            engine.newLine();

            engine.create({
                value: "A\n"
            });

            expect(mock.cursorTo).toHaveBeenCalledWith(0, 1);
        });
    });

    describe("clear()", () => {
        it("moves to the beginning of the managed output", () => {
            engine.create({
                value: "A\n"
            });

            mock.reset();

            engine.clear();

            expect(mock.cursorTo).toHaveBeenCalledWith(0, 0);
        });

        it("clears the current line", () => {
            engine.create({
                value: "A\n"
            });

            mock.reset();

            engine.clear();

            expect(mock.clearLine).toHaveBeenCalledWith(1);
        });

        it("clears everything below the managed output", () => {
            engine.create({
                value: "A\n"
            });

            mock.reset();

            engine.clear();

            expect(mock.clearScreenDown).toHaveBeenCalled();
        });

        it("resets the layout", () => {
            engine.create({
                value: "A\n"
            });

            engine.clear();
            mock.reset();

            engine.create({
                value: "B\n"
            });

            expect(mock.write).toHaveBeenCalledWith("B\n");
            expect(mock.cursorTo).toHaveBeenCalledWith(0, 0);
        });
    });
});