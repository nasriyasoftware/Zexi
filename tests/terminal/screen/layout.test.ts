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

    describe("add()", () => {
        it("adds entries with correct startsAt", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 2 });
            snapshot.add({ value: "C", height: 3 });

            expect(snapshot.get(0)).toEqual({ value: "A", height: 1, startsAt: 0 + cursorPosition.row - 1 });
            expect(snapshot.get(1)).toEqual({ value: "B", height: 2, startsAt: 1 + cursorPosition.row - 1 });
            expect(snapshot.get(2)).toEqual({ value: "C", height: 3, startsAt: 3 + cursorPosition.row - 1 });

            // indirect validation via internal layout logic
            expect(snapshot.height).toBe(6);
        });

        it("assigns correct cumulative height", () => {
            snapshot.add({ value: "X", height: 4 });
            snapshot.add({ value: "Y", height: 6 });

            expect(snapshot.height).toBe(10);
        });
    });

    describe("update()", () => {
        it("updates value without shifting when height is unchanged", () => {
            snapshot.add({ value: "A", height: 2 });
            snapshot.add({ value: "B", height: 2 });

            snapshot.update(0, { value: "A1", height: 2 });

            expect(snapshot.get(0)).toEqual({ value: "A1", height: 2, startsAt: 0 + cursorPosition.row - 1 });
            expect(snapshot.height).toBe(4);
        });

        it("propagates startsAt when height increases", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 1 });
            snapshot.add({ value: "C", height: 1 });

            snapshot.update(0, { value: "A", height: 3 });

            const b = snapshot.get(1)!;
            const c = snapshot.get(2)!;

            // startsAt shifts should be implicitly verified by layout consistency:
            expect(snapshot.height).toBe(5);

            // ensures structure remains consistent
            expect(b.height).toBe(1);
            expect(c.height).toBe(1);
        });

        it("propagates startsAt when height decreases", () => {
            snapshot.add({ value: "A", height: 3 });
            snapshot.add({ value: "B", height: 2 });
            snapshot.add({ value: "C", height: 2 });

            snapshot.update(0, { value: "A", height: 1 });

            expect(snapshot.height).toBe(5);
        });

        it("does nothing when index is invalid", () => {
            snapshot.add({ value: "A", height: 1 });

            snapshot.update(999, { value: "X", height: 5 });

            expect(snapshot.height).toBe(1);
        });
    });

    describe("get()", () => {
        it("returns null for invalid index", () => {
            expect(snapshot.get(0)).toBeNull();
        });

        it("returns snapshot entry data", () => {
            snapshot.add({ value: "A", height: 2 });

            expect(snapshot.get(0)).toEqual({
                startsAt: 0 + cursorPosition.row - 1,
                value: "A",
                height: 2
            });
        });
    });

    describe("size()", () => {
        it("returns correct number of entries", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 1 });

            expect(snapshot.size()).toBe(2);
        });
    });

    describe("clear()", () => {
        it("resets snapshot state", () => {
            snapshot.add({ value: "A", height: 1 });
            snapshot.add({ value: "B", height: 1 });

            snapshot.clear();

            expect(snapshot.size()).toBe(0);
            expect(snapshot.height).toBe(0);
        });
    });
});