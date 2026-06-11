import WritingLine from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/writer/line/line";

describe("WritingLine", () => {

    const makeLine = () => new WritingLine();

    describe("initial state", () => {

        it("starts empty and not finalized", () => {
            const line = makeLine();

            expect(line.width).toBe(0);
            expect(line.hasContent).toBe(false);
            expect(line.finalized).toBe(false);
            expect(line.toString()).toBe("");
        });
    });

    describe("add()", () => {

        it("adds content and updates width", () => {
            const line = makeLine();

            line.add("A", 2);

            expect(line.hasContent).toBe(true);
            expect(line.width).toBe(2 + 1); // indent + content
            expect(line.toString()).toBe("  A");
        });

        it("applies indentation only once (lazy init)", () => {
            const line = makeLine();

            line.add("A", 3);
            line.add("B", 999); // should NOT override indent

            expect(line.toString()).toBe("   AB");
        });

        it("ignores empty segments", () => {
            const line = makeLine();

            line.add("", 5);
            line.add("A", 5);

            expect(line.toString()).toBe("     A");
            expect(line.width).toBe(6); // 5 spaces + 1 char
        });

        it("throws when adding to finalized line", () => {
            const line = makeLine();

            line.add("A", 1);
            line.finalize();

            expect(() => line.add("B", 1)).toThrow(
                "Invariant violation: cannot add content to a finalized line."
            );
        });
    });

    describe("finalize()", () => {

        it("marks line as immutable", () => {
            const line = makeLine();

            line.add("A", 1);
            line.finalize();

            expect(line.finalized).toBe(true);
        });
    });

    describe("toString()", () => {

        it("renders indentation + concatenated content", () => {
            const line = makeLine();

            line.add("Hello", 2);
            line.add("World");

            expect(line.toString()).toBe("  HelloWorld");
        });

        it("returns empty string for empty line", () => {
            const line = makeLine();

            expect(line.toString()).toBe("");
        });
    });

    describe("cloning (from)", () => {

        it("creates deep copy of line state", () => {
            const original = makeLine();

            original.add("A", 2);
            original.add("B");

            const clone = WritingLine.from(original);

            expect(clone.toString()).toBe(original.toString());
            expect(clone.width).toBe(original.width);
            expect(clone.finalized).toBe(original.finalized);
        });

        it("ensures clone is independent of original mutations", () => {
            const original = makeLine();

            original.add("A", 1);

            const clone = WritingLine.from(original);

            original.add("B");

            expect(clone.toString()).toBe(" A");
            expect(original.toString()).toBe(" AB");
        });

        it("preserves finalized state in clone", () => {
            const original = makeLine();

            original.add("A", 1);
            original.finalize();

            const clone = WritingLine.from(original);

            expect(clone.finalized).toBe(true);
            expect(() => clone.add("B")).toThrow();
        });
    });

    describe("width semantics", () => {

        it("includes indentation + content width", () => {
            const line = makeLine();

            line.add("ABC", 4);

            expect(line.width).toBe(7);
        });

        it("accumulates content width correctly", () => {
            const line = makeLine();

            line.add("A", 2);   // indent 2 + content 1 => 3
            line.add("BC");     // +2 content => total 5

            expect(line.width).toBe(5);
        });
    });
});