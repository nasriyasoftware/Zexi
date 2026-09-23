import ScreenLayout from "../../../src/core/terminal/screen/layout";

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
                height: 1,
                isError: false
            });

            expect(typeof id).toBe("symbol");

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 1,
                startsAt: 0,
                isError: false
            });
        });

        it("assigns a unique identity to each entry", () => {
            const first = snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const second = snapshot.add({
                value: "B",
                height: 1,
                isError: false
            });

            expect(first).not.toBe(second);
        });

        it("preserves error-output metadata", () => {
            const id = snapshot.add({
                value: "Error",
                height: 1,
                isError: true
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "Error",
                height: 1,
                startsAt: 0,
                isError: true
            });
        });

        it("positions subsequent entries after the accumulated height", () => {
            const a = snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            const c = snapshot.add({
                value: "C",
                height: 3,
                isError: false
            });

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 1,
                startsAt: 0,
                isError: false
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B",
                height: 2,
                startsAt: 1,
                isError: false
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
                value: "C",
                height: 3,
                startsAt: 3,
                isError: false
            });
        });

        it("accumulates the total layout height", () => {
            snapshot.add({
                value: "X",
                height: 4,
                isError: false
            });

            snapshot.add({
                value: "Y",
                height: 6,
                isError: false
            });

            expect(snapshot.height).toBe(10);
        });
    });

    describe("update()", () => {
        it("updates an entry's value and height", () => {
            const id = snapshot.add({
                value: "A",
                height: 1,
                isError: false
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
                startsAt: 0,
                isError: false
            });

            expect(snapshot.height).toBe(2);
        });

        it("preserves an entry's error-output metadata", () => {
            const id = snapshot.add({
                value: "Error",
                height: 1,
                isError: true
            });

            snapshot.update(0, {
                value: "Updated error",
                height: 2
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "Updated error",
                height: 2,
                startsAt: 0,
                isError: true
            });
        });

        it("does not shift subsequent entries when height is unchanged", () => {
            snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 2,
                isError: false
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
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 1,
                isError: false
            });

            const c = snapshot.add({
                value: "C",
                height: 1,
                isError: false
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
                startsAt: 0,
                isError: false
            });

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 1,
                value: "B",
                height: 1,
                startsAt: 3,
                isError: false
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
                value: "C",
                height: 1,
                startsAt: 4,
                isError: false
            });

            expect(snapshot.height).toBe(5);
        });

        it("shifts all subsequent entries when height decreases", () => {
            snapshot.add({
                value: "A",
                height: 3,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            const c = snapshot.add({
                value: "C",
                height: 2,
                isError: false
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
                startsAt: 1,
                isError: false
            });

            expect(snapshot.get(c)).toEqual({
                id: c,
                index: 2,
                value: "C",
                height: 2,
                startsAt: 3,
                isError: false
            });

            expect(snapshot.height).toBe(5);
        });

        it("updates the last entry without shifting prejest.us entries", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 2,
                isError: false
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
                startsAt: 1,
                isError: false
            });

            expect(snapshot.height).toBe(5);
        });

        it("ignores an invalid index", () => {
            const id = snapshot.add({
                value: "A",
                height: 1,
                isError: false
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
                startsAt: 0,
                isError: false
            });

            expect(snapshot.height).toBe(1);
            expect(snapshot.size()).toBe(1);
        });

        it("ignores a negative index", () => {
            const id = snapshot.add({
                value: "A",
                height: 1,
                isError: false
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
                startsAt: 0,
                isError: false
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
                height: 2,
                isError: false
            });

            expect(snapshot.get(0)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: 0,
                isError: false
            });
        });

        it("retrieves an entry by ID", () => {
            const id = snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: 0,
                isError: false
            });
        });

        it("returns null for an unknown ID", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            expect(snapshot.get(Symbol())).toBeNull();
        });

        it("returns a read-only jest.w rather than the internal entry", () => {
            const id = snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            const entry = snapshot.get(id)!;

            expect(entry).not.toBe(snapshot.get(id));

            expect(entry).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: 0,
                isError: false
            });
        });

        it("reflects changes to the entry's current index", () => {
            const a = snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 1,
                isError: false
            });

            const c = snapshot.add({
                value: "C",
                height: 1,
                isError: false
            });

            const bView = snapshot.get(b)!;

            expect(bView.index).toBe(1);

            snapshot.remove(0);

            expect(bView.index).toBe(0);
            expect(snapshot.get(a)).toBeNull();
            expect(snapshot.get(c)!.index).toBe(1);
        });

        it("reflects changes to the entry's starting row", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            const bView = snapshot.get(b)!;

            expect(bView.startsAt).toBe(1);

            snapshot.update(0, {
                value: "A",
                height: 3
            });

            expect(bView.startsAt).toBe(3);
        });

        it("returns null for an out-of-range index", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            expect(snapshot.get(1)).toBeNull();
            expect(snapshot.get(999)).toBeNull();
        });
    });

    describe("remove()", () => {
        it("removes the entry at the specified index", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            snapshot.add({
                value: "C",
                height: 3,
                isError: false
            });

            snapshot.remove(1);

            expect(snapshot.size()).toBe(2);
            expect(snapshot.height).toBe(4);

            expect(snapshot.get(0)).toMatchObject({
                value: "A",
                height: 1,
                isError: false
            });

            expect(snapshot.get(1)).toMatchObject({
                value: "C",
                height: 3,
                isError: false
            });
        });

        it("shifts subsequent entries upward by the removed height", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            snapshot.add({
                value: "C",
                height: 3,
                isError: false
            });

            const d = snapshot.add({
                value: "D",
                height: 4,
                isError: false
            });

            snapshot.remove(1);

            expect(snapshot.get(d)).toEqual({
                id: d,
                index: 2,
                value: "D",
                height: 4,
                startsAt: 4,
                isError: false
            });
        });

        it("does not change entries before the removed entry", () => {
            const a = snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            snapshot.remove(1);

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 1,
                startsAt: 0,
                isError: false
            });
        });

        it("updates the indexes of subsequent entries dynamically", () => {
            const a = snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 1,
                isError: false
            });

            const c = snapshot.add({
                value: "C",
                height: 1,
                isError: false
            });

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
                height: 2,
                isError: false
            });

            snapshot.remove(-1);

            expect(snapshot.get(id)).toEqual({
                id,
                index: 0,
                value: "A",
                height: 2,
                startsAt: 0,
                isError: false
            });

            expect(snapshot.height).toBe(2);
            expect(snapshot.size()).toBe(1);
        });

        it("removes the first entry", () => {
            snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            const b = snapshot.add({
                value: "B",
                height: 3,
                isError: false
            });

            snapshot.remove(0);

            expect(snapshot.size()).toBe(1);
            expect(snapshot.height).toBe(3);

            expect(snapshot.get(b)).toEqual({
                id: b,
                index: 0,
                value: "B",
                height: 3,
                startsAt: 0,
                isError: false
            });
        });

        it("removes the last entry without shifting prejest.us entries", () => {
            const a = snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            snapshot.add({
                value: "B",
                height: 3,
                isError: false
            });

            snapshot.remove(1);

            expect(snapshot.get(a)).toEqual({
                id: a,
                index: 0,
                value: "A",
                height: 2,
                startsAt: 0,
                isError: false
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
                height: 1,
                isError: false
            });

            expect(snapshot.size()).toBe(1);

            snapshot.add({
                value: "B",
                height: 1,
                isError: false
            });

            expect(snapshot.size()).toBe(2);
        });
    });

    describe("clear()", () => {
        it("removes all entries and resets height", () => {
            snapshot.add({
                value: "A",
                height: 1,
                isError: false
            });

            snapshot.add({
                value: "B",
                height: 2,
                isError: false
            });

            snapshot.clear();

            expect(snapshot.size()).toBe(0);
            expect(snapshot.height).toBe(0);
            expect(snapshot.get(0)).toBeNull();
        });

        it("allows entries to be added again after clearing", () => {
            const previousId = snapshot.add({
                value: "A",
                height: 2,
                isError: false
            });

            snapshot.clear();

            const newId = snapshot.add({
                value: "B",
                height: 3,
                isError: false
            });

            expect(newId).not.toBe(previousId);

            expect(snapshot.get(newId)).toEqual({
                id: newId,
                index: 0,
                value: "B",
                height: 3,
                startsAt: 0,
                isError: false
            });

            expect(snapshot.height).toBe(3);
            expect(snapshot.size()).toBe(1);
        });
    });
});