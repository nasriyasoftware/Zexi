import cursorPosition from "../../../src/core/terminal/screen/cursor-position";
import ScreenLayout from "../../../src/core/terminal/screen/layout";

jest.mock("../../../src/core/terminal/screen/cursor-position", () => ({
    __esModule: true,
    default: {
        initialized: true,
        row: 1,
        column: 0
    }
}));

describe("ScreenLayout", () => {
    let snapshot: ScreenLayout;

    beforeEach(() => {
        snapshot = new ScreenLayout();
    });

    describe("initial state", () => {
        it("starts empty", () => {
            expect(snapshot.size()).toBe(0);
            expect(snapshot.height).toBe(0);
        });
    });

    describe("add()", () => {
        it("adds an entry at the current cursor position", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });
        });

        it("positions subsequent entries after the accumulated height", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 2 });
            snapshot.add({ value: "C", height: 3 });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(1)).toEqual({
                value: "B",
                height: 2,
                startsAt: cursorPosition.row
            });

            expect(snapshot.get(2)).toEqual({
                value: "C",
                height: 3,
                startsAt: cursorPosition.row + 2
            });
        });

        it("accumulates the total layout height", () => {
            snapshot.add({
                value: "X",
                height: 4
            });

            snapshot.add({
                value: "Y",
                height: 6
            });

            expect(snapshot.height).toBe(10);
        });

        it("throws when cursor position has not been initialized", () => {
            // Override the mocked state for this test.
            (cursorPosition as any).initialized = false;

            expect(() => {
                snapshot.add({
                    value: "A",
                    height: 1
                });
            }).toThrow();

            expect(snapshot.size()).toBe(0);
            expect(snapshot.height).toBe(0);

            (cursorPosition as any).initialized = true;
        });
    });

    describe("update()", () => {
        it("updates an entry's value and height", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(0, {
                value: "A1",
                height: 2
            });

            expect(snapshot.get(0)).toEqual({
                value: "A1",
                height: 2,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(2);
        });

        it("does not shift subsequent entries when height is unchanged", () => {
            snapshot.add({
                value: "A",
                height: 2
            });

            snapshot.add({
                value: "B",
                height: 2
            });

            const before = snapshot.get(1);

            snapshot.update(0, {
                value: "A1",
                height: 2
            });

            expect(snapshot.get(0)).toEqual({
                value: "A1",
                height: 2,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(1)).toEqual(before);
            expect(snapshot.height).toBe(4);
        });

        it("shifts all subsequent entries when height increases", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.add({
                value: "B",
                height: 1
            });

            snapshot.add({
                value: "C",
                height: 1
            });

            snapshot.update(0, {
                value: "A",
                height: 3
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 3,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(1)).toEqual({
                value: "B",
                height: 1,
                startsAt: cursorPosition.row + 2
            });

            expect(snapshot.get(2)).toEqual({
                value: "C",
                height: 1,
                startsAt: cursorPosition.row + 3
            });

            expect(snapshot.height).toBe(5);
        });

        it("shifts all subsequent entries when height decreases", () => {
            snapshot.add({
                value: "A",
                height: 3
            });

            snapshot.add({
                value: "B",
                height: 2
            });

            snapshot.add({
                value: "C",
                height: 2
            });

            snapshot.update(0, {
                value: "A",
                height: 1
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(1)).toEqual({
                value: "B",
                height: 2,
                startsAt: cursorPosition.row
            });

            expect(snapshot.get(2)).toEqual({
                value: "C",
                height: 2,
                startsAt: cursorPosition.row + 2
            });

            expect(snapshot.height).toBe(5);
        });

        it("updates the last entry without attempting downstream propagation", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.add({
                value: "B",
                height: 2
            });

            snapshot.update(1, {
                value: "B1",
                height: 4
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(1)).toEqual({
                value: "B1",
                height: 4,
                startsAt: cursorPosition.row
            });

            expect(snapshot.height).toBe(5);
        });

        it("ignores an invalid index", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(999, {
                value: "X",
                height: 5
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(1);
            expect(snapshot.size()).toBe(1);
        });

        it("ignores a negative index", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(-1, {
                value: "X",
                height: 5
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(1);
        });
    });

    describe("get()", () => {
        it("returns null for an empty layout", () => {
            expect(snapshot.get(0)).toBeNull();
        });

        it("returns a snapshot entry", () => {
            snapshot.add({
                value: "A",
                height: 2
            });

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });
        });

        it("returns a copy rather than the internal entry", () => {
            snapshot.add({
                value: "A",
                height: 2
            });

            const entry = snapshot.get(0)!;

            entry.value = "mutated";
            entry.height = 999;
            entry.startsAt = 999;

            expect(snapshot.get(0)).toEqual({
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(2);
        });

        it("returns null for an out-of-range index", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            expect(snapshot.get(1)).toBeNull();
            expect(snapshot.get(999)).toBeNull();
        });
    });

    describe("size()", () => {
        it("returns the number of entries", () => {
            expect(snapshot.size()).toBe(0);

            snapshot.add({
                value: "A",
                height: 1
            });

            expect(snapshot.size()).toBe(1);

            snapshot.add({
                value: "B",
                height: 1
            });

            expect(snapshot.size()).toBe(2);
        });
    });

    describe("clear()", () => {
        it("removes all entries and resets height", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.add({
                value: "B",
                height: 2
            });

            snapshot.clear();

            expect(snapshot.size()).toBe(0);
            expect(snapshot.height).toBe(0);
            expect(snapshot.get(0)).toBeNull();
        });

        it("allows entries to be added again after clearing", () => {
            snapshot.add({
                value: "A",
                height: 2
            });

            snapshot.clear();

            snapshot.add({
                value: "B",
                height: 3
            });

            expect(snapshot.get(0)).toEqual({
                value: "B",
                height: 3,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(3);
            expect(snapshot.size()).toBe(1);
        });
    });
});