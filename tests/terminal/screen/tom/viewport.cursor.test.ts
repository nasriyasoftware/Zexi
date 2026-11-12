import EntriesManager from "@/core/terminal/screen/tom/entries/entry.manager";
import TerminalViewport from "@/core/terminal/screen/tom/viewport/viewport";
import terminalIO from "@/core/terminal/io";
import { StdMocks } from "../../../mocks/std";

const originalDescriptors = {
    width: Object.getOwnPropertyDescriptor(terminalIO, "width"),
    height: Object.getOwnPropertyDescriptor(terminalIO, "height"),
    initialCursor: Object.getOwnPropertyDescriptor(terminalIO, "initialCursor")
};

describe("TerminalViewport cursor position", () => {
    beforeEach(() => {
        StdMocks.reset();
        Object.defineProperties(terminalIO, {
            width: { configurable: true, value: 80 },
            height: { configurable: true, value: 24 },
            initialCursor: {
                configurable: true,
                value: { row: 1, column: 1 }
            }
        });
    });

    afterEach(() => {
        for (const [key, descriptor] of Object.entries(originalDescriptors)) {
            if (descriptor) {
                Object.defineProperty(terminalIO, key, descriptor);
            } else {
                Reflect.deleteProperty(terminalIO, key);
            }
        }
    });

    it("moves the cursor to the end of the last entry after rendering", () => {
        const entries = new EntriesManager();
        entries.create("Done");
        const viewport = new TerminalViewport(entries);

        viewport.render();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("\x1b[1;5H", {
            ignoreAnsi: false
        });
    });
});
