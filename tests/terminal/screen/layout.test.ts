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
            const id = snapshot.add({
                value: "A",
                height: 1
            });

            expect(typeof id).toBe("symbol");

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });
        });

        it("assigns a unique identity to each entry", () => {
            const first = snapshot.add({
                value: "A",
                height: 1
            });

            const second = snapshot.add({
                value: "B",
                height: 1
            });

            expect(first).not.toBe(second);
        });

        it("positions subsequent entries after the accumulated height", () => {
            const a = snapshot.add({ value: "A", height: 1 });
            const b = snapshot.add({ value: "B", height: 2 });
            const c = snapshot.add({ value: "C", height: 3 });

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B",
                height: 2,
                startsAt: cursorPosition.row
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
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
            const id = snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(0, {
                value: "A1",
                height: 2
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
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

            const b = snapshot.add({
                value: "B",
                height: 2
            });

            const before = snapshot.get(b);

            snapshot.update(0, {
                value: "A1",
                height: 2
            });

            expect(snapshot.get(b)).toEqual(before);
            expect(snapshot.height).toBe(4);
        });

        it("shifts all subsequent entries when height increases", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            const b = snapshot.add({
                value: "B",
                height: 1
            });

            const c = snapshot.add({
                value: "C",
                height: 1
            });

            snapshot.update(0, {
                value: "A",
                height: 3
            });

            expect(snapshot.get(0)).toEqual({
                id: expect.any(Symbol),
                index: 0,
                value: "A",
                height: 3,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B",
                height: 1,
                startsAt: cursorPosition.row + 2
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
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

            const b = snapshot.add({
                value: "B",
                height: 2
            });

            const c = snapshot.add({
                value: "C",
                height: 2
            });

            snapshot.update(0, {
                value: "A",
                height: 1
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B",
                height: 2,
                startsAt: cursorPosition.row
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
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

            const b = snapshot.add({
                value: "B",
                height: 2
            });

            snapshot.update(1, {
                value: "B1",
                height: 4
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B1",
                height: 4,
                startsAt: cursorPosition.row
            });

            expect(snapshot.height).toBe(5);
        });

        it("ignores an invalid index", () => {
            const id = snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(999, {
                value: "X",
                height: 5
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(1);
            expect(snapshot.size()).toBe(1);
        });

        it("ignores a negative index", () => {
            const id = snapshot.add({
                value: "A",
                height: 1
            });

            snapshot.update(-1, {
                value: "X",
                height: 5
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
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

        it("retrieves an entry by index", () => {
            const id = snapshot.add({
                value: "A",
                height: 2
            });

            expect(snapshot.get(0)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });
        });

        it("retrieves an entry by ID", () => {
            const id = snapshot.add({
                value: "A",
                height: 2
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });
        });

        it("returns null for an unknown ID", () => {
            snapshot.add({
                value: "A",
                height: 1
            });

            expect(snapshot.get(Symbol())).toBeNull();
        });

        it("returns a read-only view rather than the internal entry", () => {
            const id = snapshot.add({
                value: "A",
                height: 2
            });

            const entry = snapshot.get(id)!;

            expect(entry).not.toBe(snapshot.get(id));
            expect(entry).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });
        });

        it("reflects changes to the entry's current index", () => {
            const a = snapshot.add({ value: "A", height: 1 });
            const b = snapshot.add({ value: "B", height: 1 });
            const c = snapshot.add({ value: "C", height: 1 });

            const bView = snapshot.get(b)!;

            expect(bView.index).toBe(1);

            snapshot.remove(0);

            expect(bView.index).toBe(0);
            expect(snapshot.get(a)).toBeNull();
            expect(snapshot.get(c)!.index).toBe(1);
        });

        it("reflects changes to the entry's starting row", () => {
            snapshot.add({ value: "A", height: 1 });

            const b = snapshot.add({ value: "B", height: 2 });
            const bView = snapshot.get(b)!;

            expect(bView.startsAt).toBe(cursorPosition.row);

            snapshot.update(0, {
                value: "A",
                height: 3
            });

            expect(bView.startsAt).toBe(cursorPosition.row + 2);
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

    describe("remove()", () => {
        it("removes the entry at the specified index", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 2 });
            snapshot.add({ value: "C", height: 3 });

            snapshot.remove(1);

            expect(snapshot.size()).toBe(2);
            expect(snapshot.height).toBe(4);

            expect(snapshot.get(0)).toMatchObject({
                value: "A",
                height: 1
            });

            expect(snapshot.get(1)).toMatchObject({
                value: "C",
                height: 3
            });
        });

        it("shifts subsequent entries upward by the removed height", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 2 });
            snapshot.add({ value: "C", height: 3 });

            const c = snapshot.add({ value: "D", height: 4 });

            snapshot.remove(1);

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
                value: "D",
                height: 4,
                startsAt: cursorPosition.row + 3
            });
        });

        it("does not change entries before the removed entry", () => {
            const a = snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 2 });

            snapshot.remove(1);

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 1,
                startsAt: cursorPosition.row - 1
            });
        });

        it("updates the indexes of subsequent entries dynamically", () => {
            const a = snapshot.add({ value: "A", height: 1 });
            const b = snapshot.add({ value: "B", height: 1 });
            const c = snapshot.add({ value: "C", height: 1 });

            expect(snapshot.get(a)!.index).toBe(0);
            expect(snapshot.get(b)!.index).toBe(1);
            expect(snapshot.get(c)!.index).toBe(2);

            snapshot.remove(0);

            expect(snapshot.get(a)).toBeNull();
            expect(snapshot.get(b)!.index).toBe(0);
            expect(snapshot.get(c)!.index).toBe(1);
        });

        it("does nothing for an index of -1", () => {
            const id = snapshot.add({
                value: "A",
                height: 2
            });

            snapshot.remove(-1);

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(2);
            expect(snapshot.size()).toBe(1);
        });

        it("removes the first entry", () => {
            snapshot.add({ value: "A", height: 2 });
            const b = snapshot.add({ value: "B", height: 3 });

            snapshot.remove(0);

            expect(snapshot.size()).toBe(1);
            expect(snapshot.height).toBe(3);

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 0,
                value: "B",
                height: 3,
                startsAt: cursorPosition.row - 1
            });
        });

        it("removes the last entry without shifting previous entries", () => {
            const a = snapshot.add({ value: "A", height: 2 });
            snapshot.add({ value: "B", height: 3 });

            snapshot.remove(1);

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 2,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(2);
            expect(snapshot.size()).toBe(1);
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
            const previousId = snapshot.add({
                value: "A",
                height: 2
            });

            snapshot.clear();

            const newId = snapshot.add({
                value: "B",
                height: 3
            });

            expect(newId).not.toBe(previousId);

            expect(snapshot.get(newId)).toEqual({
                id: newId,
                index: 0,
                value: "B",
                height: 3,
                startsAt: cursorPosition.row - 1
            });

            expect(snapshot.height).toBe(3);
            expect(snapshot.size()).toBe(1);
        });
    });
});