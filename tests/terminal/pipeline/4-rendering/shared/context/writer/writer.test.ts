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
    // 🔷 INITIAL STATE
    // ---------------------------------------------------------------------
    describe("initial state", () => {

        it("starts with empty output", () => {
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
    // 🔷 BASIC STREAMING BEHAVIOR
    // ---------------------------------------------------------------------
    describe("basic writing", () => {

        it("writes a single segment into a line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("hello");

            expect(lines(writer.toString())).toEqual([
                "hello"
            ]);
        });

        it("accumulates multiple writes into the same line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 2
            });

            writer.write("a");
            writer.write("b");
            writer.write("c");

            // Content is streamed into same active line
            expect(lines(writer.toString())).toEqual([
                "abc"
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

        it("splits input correctly on embedded newlines", () => {
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
    });

    // ---------------------------------------------------------------------
    // 🔷 INDENTATION RULES
    // ---------------------------------------------------------------------
    describe("indentation", () => {

        it("applies indentation only on first write of a line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(2), // 2 * 2 = 4 spaces
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

            // Indentation is applied once per line lifecycle only
            expect(lines(writer.toString())).toEqual([
                `${' '.repeat(2 * 2)}abc`
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
    // 🔷 WRAPPING BEHAVIOR
    // ---------------------------------------------------------------------
    describe("wrapping", () => {

        it("wraps deterministically at maxWidth", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0,
                maxWidth: 4
            });

            writer.write("abcdef");

            expect(lines(writer.toString())).toEqual([
                "abcd",
                "ef"
            ]);
        });

        it("continues correctly after wrap", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0,
                maxWidth: 3
            });

            writer.write("abcdef");

            expect(lines(writer.toString())).toEqual([
                "abc",
                "def"
            ]);
        });

        it("preserves full content after wrapping (no loss invariant)", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0,
                maxWidth: 10
            });

            writer.write("hello world test");

            expect(writer.toString().replace(/\n/g, "")).toBe("hello world test");
        });

        it("forces split when no whitespace exists", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0,
                maxWidth: 3
            });

            writer.write("abcdef");

            expect(lines(writer.toString())).toEqual([
                "abc",
                "def"
            ]);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 EXPLICIT LINE CONTROL
    // ---------------------------------------------------------------------
    describe("newLine()", () => {

        it("forces line break between writes", () => {
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
    // 🔷 BRANCHING + CONSUMPTION MODEL
    // ---------------------------------------------------------------------
    describe("branches + consume()", () => {

        it("creates independent branch writers", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();
            branch.write("child");

            expect(lines(branch.toString())).toEqual([
                "child"
            ]);
        });

        it("branch merge replaces ONLY last parent line", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            // ------------------------------------------------------------------
            // Parent baseline state
            // ------------------------------------------------------------------
            writer.write("A");
            writer.write("B", { newLine: true });

            // Parent is now:
            // ["A", "B"]

            // ------------------------------------------------------------------
            // Branch inherits LAST LINE INCLUDING CONTENT ("B")
            // ------------------------------------------------------------------
            const branch = writer.branches.create();

            branch.write("C"); // "BC"
            branch.write("D"); // "BCD"
            branch.newLine();
            branch.write("E");

            // ------------------------------------------------------------------
            // Branch state is:
            // ["BCD", "E"]
            // ------------------------------------------------------------------
            expect(lines(branch.toString())).toEqual([
                "BCD",
                "E",
            ]);

            // ------------------------------------------------------------------
            // Merge behavior:
            // - remove parent's last line ("B")
            // - replace with branch lines
            // ------------------------------------------------------------------
            writer.consume(branch);

            expect(lines(writer.toString())).toEqual([
                "A",
                "BCD",
                "E",
            ]);
        });

        it("preserves parent history after merge", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            writer.write("A");
            writer.newLine();
            writer.write("C");

            const branch = writer.branches.create();
            branch.write("B");

            writer.consume(branch);

            expect(lines(writer.toString())).toEqual([
                "A",
                "CB"
            ]);
        });

        it("prevents foreign writer consumption", () => {
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

        it("invalidates branch after consume", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();
            branch.write("X");

            writer.consume(branch);

            expect(() => branch.write("Y")).toThrow();
        });

        it("blocks writing while branches exist until consume", () => {
            const writer = new RenderingWriter({
                depth: createDepth(0),
                spaces: 0
            });

            const branch = writer.branches.create();

            expect(() => writer.write("blocked")).toThrow();

            writer.consume(branch);

            expect(() => writer.write("allowed")).not.toThrow();
        });

        it("prevents double consumption", () => {
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