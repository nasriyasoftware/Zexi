import EntriesManager from "@/core/terminal/screen/tom/entries/entry.manager";
import TerminalViewport from "@/core/terminal/screen/tom/viewport/viewport";
import terminalIO from "@/core/terminal/io";
import { StdMocks } from "../../../mocks/std";

const originalDescriptors = {
    width: Object.getOwnPropertyDescriptor(terminalIO, "width"),
    height: Object.getOwnPropertyDescriptor(terminalIO, "height"),
    initialCursor: Object.getOwnPropertyDescriptor(terminalIO, "initialCursor")
};

const setTerminal = (width: number, height: number, cursorRow: number) => {
    Object.defineProperties(terminalIO, {
        width: { configurable: true, value: width },
        height: { configurable: true, value: height },
        initialCursor: {
            configurable: true,
            value: { row: cursorRow, column: 1 }
        }
    });
};

const restoreTerminal = () => {
    for (const [key, descriptor] of Object.entries(originalDescriptors)) {
        if (descriptor) {
            Object.defineProperty(terminalIO, key, descriptor);
        } else {
            Reflect.deleteProperty(terminalIO, key);
        }
    }
};

describe("TerminalViewport row mapping", () => {
    beforeEach(() => {
        StdMocks.reset();
        setTerminal(80, 3, 3);
    });

    afterEach(restoreTerminal);

    it("scrolls as new entries exceed the viewport and keeps updates on their rows", () => {
        const entries = new EntriesManager();
        const viewport = new TerminalViewport(entries);

        const created: Array<{ id: symbol; height: number }> = [];
        for (let i = 1; i <= 4; i++) {
            const result = entries.create(`entry-${i}`);
            created.push(result);
            viewport.updatePosition(result.height, { forNewEntry: true });
            viewport.render();
        }

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("\r\n");

        StdMocks.reset();

        const updatedSecond = entries.update(created[1].id, "updated-entry-2")!;
        viewport.updatePosition(updatedSecond.heightDelta);
        viewport.render();

        const updatedFourth = entries.update(created[3].id, "updated-entry-4")!;
        viewport.updatePosition(updatedFourth.heightDelta);
        viewport.render();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("\x1b[1;1H", {
            ignoreAnsi: false
        });
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("\x1b[3;1H", {
            ignoreAnsi: false
        });
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("updated-entry-2");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("updated-entry-4");
        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("\r\n");
    });

    it("recalculates viewport overflow when an existing entry grows", () => {
        const entries = new EntriesManager();
        const viewport = new TerminalViewport(entries);
        const created = [];

        for (let i = 1; i <= 3; i++) {
            const result = entries.create(`entry-${i}`);
            created.push(result);
            viewport.updatePosition(result.height, { forNewEntry: true });
            viewport.render();
        }

        StdMocks.reset();

        const update = entries.update(
            created[0].id,
            "first-a\nfirst-b\nfirst-c"
        )!;
        viewport.updatePosition(update.heightDelta);
        viewport.render();

        expect(update.heightDelta).toBe(2);
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("first-c");
        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("\r\n");
    });

    it("keeps the last entry on the bottom row across same-height updates after overflow", () => {
        setTerminal(80, 24, 12);

        const entries = new EntriesManager();
        const viewport = new TerminalViewport(entries);
        const created: Array<{ id: symbol; height: number }> = [];

        for (let i = 1; i <= 50; i++) {
            const result = entries.create(`[${i}] Waiting...`);
            created.push(result);
            viewport.updatePosition(result.height, { forNewEntry: true });
            viewport.render();
        }

        StdMocks.reset();

        for (const content of [
            "[50] Progress: 90%",
            "[50] Progress: 100%",
            "[50] Done!"
        ]) {
            const update = entries.update(created[49].id, content)!;
            expect(update.heightDelta).toBe(0);
            viewport.updatePosition(update.heightDelta);
            viewport.render();

            StdMocks.expect.stdout.write.toHaveBeenCalledWith(
                "\x1b[24;1H",
                { ignoreAnsi: false }
            );
        }

        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("\r\n");
    });
});
