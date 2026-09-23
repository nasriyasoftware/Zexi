import ScreenCell from "../../../src/core/terminal/screen/cell";
import ScreenEngine from "../../../src/core/terminal/screen/engine";
import TerminalEntry from "../../../src/core/terminal/screen/terminal-cell";
import StdMocks from "../../mocks/std";

describe("ScreenEngine", () => {
    let engine: ScreenEngine;

    beforeEach(() => {
        StdMocks.reset();
        engine = new ScreenEngine();
    });

    describe("create()", () => {
        it("creates an internal ScreenCell by default", () => {
            const cell = engine.create({ value: "Hello\n" });
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
            engine.create({ value: "Hello\n" });
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Hello\n");
        });

        it("renders multiple entries in order", () => {
            engine.create({ value: "A\n" });
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("A\n");

            engine.create({ value: "B\n" });
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");

            engine.create({ value: "C\n" });
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("C\n");
        });

        it("registers entries independently", () => {
            const a = engine.create({ value: "A\n" });
            const b = engine.create({ value: "B\n" });

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("A\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");

            StdMocks.reset();
            a.update("Updated A\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated A\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");

            StdMocks.reset();
            b.update("Updated B\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated B\n");
        });

        it("renders error entries with the error output option", () => {
            engine.create({
                value: "Error\n",
                isError: true
            });

            StdMocks.expect.stderr.write.toHaveBeenCalledWith("Error\n");
        });
    });

    describe("updates", () => {
        it("rewrites an entry when its height is unchanged", () => {
            const cell = engine.create({ value: "Hello\n" });

            StdMocks.reset();
            cell.update("World\n");

            StdMocks.expect.stdout.clearLine.toHaveBeenCalled();
            StdMocks.expect.stdout.clearScreenDown.toNot.haveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("World\n");
        });

        it("does nothing when the rendered value is unchanged", () => {
            const cell = engine.create({ value: "Hello\n" });

            StdMocks.reset();
            cell.update("Hello\n");

            StdMocks.expect.stdout.write.toNot.haveBeenCalled();
            StdMocks.expect.stdout.clearLine.toNot.haveBeenCalled();
            StdMocks.expect.stdout.clearScreenDown.toNot.haveBeenCalled();
        });

        it("cascades when an entry height changes", () => {
            const a = engine.create({ value: "A\n" });
            const b = engine.create({ value: "B\n" });

            StdMocks.reset();
            a.update("A\nA2\n");

            expect(a.height).toBe(3);
            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("A\nA2\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
        });

        it("does not cascade when an entry value changes without changing height", () => {
            const a = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });

            StdMocks.reset();
            a.update("Updated A\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated A\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");
            StdMocks.expect.stdout.clearScreenDown.toNot.haveBeenCalled();
        });

        it("re-renders entries below an entry whose height decreases", () => {
            const a = engine.create({ value: "A\nA2\nA3\n" });
            engine.create({ value: "B\n" });

            StdMocks.reset();
            a.update("A\n");

            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("A\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
        });

        it("preserves the error state when an error entry is updated", () => {
            const cell = engine.create({
                value: "Error\n",
                isError: true
            });

            StdMocks.reset();
            cell.update("Updated error\n");

            StdMocks.expect.stderr.write.toHaveBeenCalledWith("Updated error\n");
        });
    });

    describe("remove()", () => {
        it("removes an internal ScreenCell through its lifecycle", () => {
            const a = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });

            StdMocks.reset();
            a.remove();

            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
        });

        it("removes an external TerminalEntry through its lifecycle", () => {
            const entry = engine.create(
                { value: "A\n" },
                "external"
            );

            engine.create({ value: "B\n" });

            StdMocks.reset();
            entry.remove();

            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
        });

        it("re-renders entries below the removed entry", () => {
            const a = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });
            engine.create({ value: "C\n" });

            StdMocks.reset();
            a.remove();

            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("C\n");
        });

        it("does not render the removed entry again", () => {
            const a = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });

            a.remove();
            StdMocks.reset();

            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("A\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");
        });

        it("reflows entries after removing an entry from the middle", () => {
            engine.create({ value: "A\n" });
            const b = engine.create({ value: "B\n" });
            engine.create({ value: "C\n" });

            StdMocks.reset();
            b.remove();

            StdMocks.expect.stdout.clearLine.toHaveBeenCalled();
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("C\n");

            // B occupied rows 2-3, and C moves into that position.
            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 2);
        });

        it("allows entries to be removed independently of their original position", () => {
            const a = engine.create({ value: "A\n" });
            const b = engine.create({ value: "B\n" });
            const c = engine.create({ value: "C\n" });

            b.remove();

            StdMocks.reset();
            a.update("Updated A\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated A\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("C\n");

            StdMocks.reset();
            c.update("Updated C\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated C\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("B\n");
            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("C\n");
        });

        it("handles removing entries in arbitrary order", () => {
            const a = engine.create({ value: "A\n" });
            const b = engine.create({ value: "B\n" });
            const c = engine.create({ value: "C\n" });

            StdMocks.reset();
            c.remove();

            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("C\n");

            StdMocks.reset();
            a.remove();

            StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("A\n");
            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");

            StdMocks.reset();
            b.update("Updated B\n");

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("Updated B\n");
        });

        it("does not remove the same entry twice", () => {
            const cell = engine.create({ value: "A\n" });
            cell.remove();

            StdMocks.reset();

            expect(() => { cell.remove(); }).not.toThrow();

            StdMocks.expect.stdout.write.toNot.haveBeenCalled();
            StdMocks.expect.stdout.clearScreenDown.toNot.haveBeenCalled();
        });
    });

    describe("cursor positioning", () => {
        it("positions entries according to their accumulated height", () => {
            engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });
            engine.create({ value: "C\n" });

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 0);
            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 2);
            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 4);
        });

        it("restores the cursor to the end of the rendered output", () => {
            engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });
            const cell = engine.create({ value: "C\n" });

            StdMocks.reset();
            cell.update("Updated\n");

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 6);
        });

        it("restores the cursor to the new end after a height change", () => {
            const cell = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });

            StdMocks.reset();
            cell.update("A\nA2\n");

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 5);
        });

        it("restores the cursor to the new end after removing an entry", () => {
            const a = engine.create({ value: "A\n" });
            engine.create({ value: "B\n" });

            StdMocks.reset();
            a.remove();

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 2);
        });
    });

    describe("newLine()", () => {
        it("reserves one line in the layout", () => {
            engine.newLine();
            engine.create({ value: "A\n" });

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 1);
        });
    });

    describe("clear()", () => {
        it("moves to the beginning of the managed output", () => {
            engine.create({ value: "A\n" });

            StdMocks.reset();
            engine.clear();

            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 0);
        });

        it("clears the current line", () => {
            engine.create({ value: "A\n" });

            StdMocks.reset();
            engine.clear();

            StdMocks.expect.stdout.clearLine.toHaveBeenCalledWith(1);
        });

        it("clears everything below the managed output", () => {
            engine.create({ value: "A\n" });

            StdMocks.reset();
            engine.clear();

            StdMocks.expect.stdout.clearScreenDown.toHaveBeenCalled();
        });

        it("resets the layout", () => {
            engine.create({ value: "A\n" });
            engine.clear();

            StdMocks.reset();
            engine.create({ value: "B\n" });

            StdMocks.expect.stdout.write.toHaveBeenCalledWith("B\n");
            StdMocks.expect.stdout.cursorTo.toHaveBeenCalledWith(0, 0);
        });
    });
});