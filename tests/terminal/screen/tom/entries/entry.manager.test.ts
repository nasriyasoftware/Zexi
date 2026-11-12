import EntriesManager from "@/core/terminal/screen/tom/entries/entry.manager";

describe("EntriesManager", () => {
    let entries: EntriesManager;

    beforeEach(() => {
        entries = new EntriesManager();
    });

    it("creates entries with sequential line positions and output metadata", () => {
        const first = entries.create("first");
        const second = entries.create("error", { isError: true });

        expect(entries.number).toBe(2);
        expect(entries.totalLines).toBe(2);
        expect(entries.entries.map(entry => ({
            startsAt: entry.startsAt,
            isError: entry.isError
        }))).toEqual([
            { startsAt: 1, isError: false },
            { startsAt: 2, isError: true }
        ]);
        expect(first.id).not.toBe(second.id);
    });

    it("reflows subsequent entries when an entry changes height", () => {
        const first = entries.create("first");
        entries.create("second");

        const update = entries.update(first.id, "first\ncontinued");

        expect(update).toEqual({
            start: 1,
            end: 4,
            heightDelta: 1
        });
        expect(entries.entries[1].startsAt).toBe(3);
        expect(entries.totalLines).toBe(3);
    });

    it("removes an entry and reflows the remaining entries", () => {
        const first = entries.create("first");
        entries.create("second");

        const range = entries.remove(first.id);

        expect(range).toEqual({
            start: 1,
            end: 2
        });
        expect(entries.entries).toHaveLength(1);
        expect(entries.entries[0].startsAt).toBe(1);
        expect(entries.totalLines).toBe(1);
    });

    it("clears entries and resets the accumulated line count", () => {
        entries.create("first");
        entries.create("second\ncontinued");

        entries.clear();

        expect(entries.entries).toHaveLength(0);
        expect(entries.number).toBe(0);
        expect(entries.totalLines).toBe(0);
    });
});
