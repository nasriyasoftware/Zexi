import ContextPointer from "../../../../../src/core/cli/kernal/assets/runner/context/pointer";

describe("ContextPointer", () => {
    it("starts before the first item", () => {
        const pointer = new ContextPointer(["a", "b"]);

        expect(pointer.index).toBe(-1);
        expect(pointer.peek()).toBe("a");
        expect(pointer.remaining()).toEqual(["a", "b"]);
        expect(pointer.hasNext()).toBe(true);
    });

    it("advances with next and updates index/peek/remaining", () => {
        const pointer = new ContextPointer(["first", "second", "third"]);

        expect(pointer.next()).toBe("first");
        expect(pointer.index).toBe(0);
        expect(pointer.peek()).toBe("second");
        expect(pointer.remaining()).toEqual(["second", "third"]);
        expect(pointer.hasNext()).toBe(true);

        expect(pointer.next()).toBe("second");
        expect(pointer.index).toBe(1);
        expect(pointer.peek()).toBe("third");
        expect(pointer.remaining()).toEqual(["third"]);
        expect(pointer.hasNext()).toBe(true);
    });

    it("returns undefined when next is called at the end", () => {
        const pointer = new ContextPointer(["only"]);

        expect(pointer.next()).toBe("only");
        expect(pointer.hasNext()).toBe(false);
        expect(pointer.peek()).toBeUndefined();
        expect(pointer.remaining()).toEqual([]);
        expect(pointer.index).toBe(0);

        expect(pointer.next()).toBeUndefined();
        expect(pointer.index).toBe(0);
    });

    it("handles empty input", () => {
        const pointer = new ContextPointer([]);

        expect(pointer.hasNext()).toBe(false);
        expect(pointer.peek()).toBeUndefined();
        expect(pointer.next()).toBeUndefined();
        expect(pointer.remaining()).toEqual([]);
        expect(pointer.index).toBe(-1);
    });
});