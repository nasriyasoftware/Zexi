import TraversalDepth from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";
import RenderingWriter from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/writer/writer";

/**
 * Utility: build traversal depth safely
 */
function createDepth(value = 0) {
    const depth = new TraversalDepth();
    while (depth.value < value) {
        depth.increase();
    }
    return depth;
}

/**
 * Utility: split output into logical lines
 */
function lines(output: string): string[] {
    return output.split("\n");
}

describe("RenderingWriter (deterministic)", () => {

    // ---------------------------------------------------------------------
    // INITIAL STATE
    // ---------------------------------------------------------------------
    describe("initial state", () => {

        it("starts empty", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            expect(writer.toString()).toBe("");
        });

        it("is not consumed initially", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            expect(writer.consumed).toBe(false);
        });
    });

    // ---------------------------------------------------------------------
    // STREAMING BEHAVIOR
    // ---------------------------------------------------------------------
    describe("streaming", () => {

        it("writes a single segment", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("hello");

            expect(lines(writer.toString())).toEqual(["hello"]);
        });

        it("accumulates writes into same line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("a");
            writer.write("b");
            writer.write("c");

            expect(lines(writer.toString())).toEqual(["abc"]);
        });

        it("splits on embedded newlines", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("a\nb\nc");

            expect(lines(writer.toString())).toEqual([
                "a",
                "b",
                "c"
            ]);
        });

        it("respects explicit newLine option", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("a", { newLine: true });
            writer.write("b");

            expect(lines(writer.toString())).toEqual([
                "",
                "ab"
            ]);
        });
    });

    // ---------------------------------------------------------------------
    // LINE CONTROL
    // ---------------------------------------------------------------------
    describe("line control", () => {

        it("forces line breaks", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            writer.write("a");
            writer.newLine();
            writer.write("b");

            expect(lines(writer.toString())).toEqual([
                "a",
                "b"
            ]);
        });
    });

    // ---------------------------------------------------------------------
    // INDENTATION
    // ---------------------------------------------------------------------
    describe("indentation", () => {

        it("applies indentation on first write only", () => {
            const writer = new RenderingWriter({
                depth: createDepth(2),
                spaces: 2
            });

            writer.write("x");

            expect(lines(writer.toString())).toEqual([
                "    x"
            ]);
        });

        it("does not reapply indentation within same line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(2),
                spaces: 2
            });

            writer.write("a");
            writer.write("b");
            writer.write("c");

            expect(lines(writer.toString())).toEqual([
                "    abc"
            ]);
        });

        it("does not indent empty lines", () => {
            const writer = new RenderingWriter({
                depth: createDepth(2),
                spaces: 2
            });

            writer.newLine();
            writer.write("x");

            expect(lines(writer.toString())).toEqual([
                "",
                "    x"
            ]);
        });
    });

    // ---------------------------------------------------------------------
    // BRANCHING + CONSUMPTION
    // ---------------------------------------------------------------------
    describe("branching + consumption", () => {

        it("creates independent branch writers", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();
            branch.write("child");

            expect(lines(branch.toString())).toEqual(["child"]);
        });

        it("merges branch into parent correctly", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            writer.write("A");
            writer.write("B", { newLine: true });

            const branch = writer.branches.create();
            branch.write("C");
            branch.write("D");
            branch.newLine();
            branch.write("E");

            writer.consume(branch);

            expect(lines(writer.toString())).toEqual([
                "A",
                "BCD",
                "E"
            ]);
        });

        it("prevents writing while branch is active", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();

            expect(() => writer.write("blocked")).toThrow();

            writer.consume(branch);

            expect(() => writer.write("ok")).not.toThrow();
        });

        it("prevents consuming foreign writer", () => {
            const w1 = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const w2 = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            expect(() => w1.consume(w2)).toThrow();
        });

        it("invalidates branch after consumption", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();
            branch.write("X");

            writer.consume(branch);

            expect(() => branch.write("Y")).toThrow();
        });

        it("prevents double consumption of branches", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const b1 = writer.branches.create();
            const b2 = writer.branches.create();

            writer.consume(b1);

            expect(() => writer.consume(b2)).toThrow();
        });
    });
});