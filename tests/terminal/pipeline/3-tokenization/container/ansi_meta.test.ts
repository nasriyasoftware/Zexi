import AnsiMeta from "../../../../../src/core/terminal/pipeline/3-tokenization/container/ansi_meta/ansi.meta";
import { ANSI } from "../../../../../src/core/terminal/styling/ansi";
import type { AnsiColor } from "../../../../../src/core/terminal/styling/types";

describe("AnsiMeta", () => {

    it("assigns color only once (write-once semantics)", () => {
        const meta = new AnsiMeta();

        meta.assign("color", "red" as AnsiColor);
        meta.assign("color", "blue" as AnsiColor);

        expect(meta.color).toBe("red");
    });

    it("assigns bgColor only once", () => {
        const meta = new AnsiMeta();

        meta.assign("bgColor", "green" as AnsiColor);
        meta.assign("bgColor", "yellow" as AnsiColor);

        expect(meta.bgColor).toBe("green");
    });

    it("accumulates styles only on first assignment (write-once set)", () => {
        const meta = new AnsiMeta();

        meta.assign("styles", [ANSI.style.bold, ANSI.style.italic]);
        meta.assign("styles", [ANSI.style.underline]);

        expect(meta.styles).toEqual([ANSI.style.bold, ANSI.style.italic]);
        expect(meta.styles).not.toContain(ANSI.style.underline);
    });

    it("deduplicates styles using Set", () => {
        const meta = new AnsiMeta();

        meta.assign("styles", [
            ANSI.style.bold,
            ANSI.style.bold,
            ANSI.style.italic
        ]);

        expect(meta.styles).toEqual([ANSI.style.bold, ANSI.style.italic]);
        expect(meta.styles.length).toBe(2);
    });

    it("returns null for unset color values", () => {
        const meta = new AnsiMeta();

        expect(meta.color).toBeNull();
        expect(meta.bgColor).toBeNull();
    });

    it("returns empty array for unset styles", () => {
        const meta = new AnsiMeta();

        expect(meta.styles).toEqual([]);
    });

    it("stores source metadata when provided", () => {
        const meta = new AnsiMeta();

        meta.assign("color", ANSI.color.fg.normal.red, "map-key");

        const inspected = AnsiMeta.inspect(meta);

        expect(inspected.color.source).toBe("map-key");
    });

    it("inspect returns internal reference", () => {
        const meta = new AnsiMeta();

        meta.assign("color", ANSI.color.fg.normal.red);

        const inspected = AnsiMeta.inspect(meta);
        const inspected2 = AnsiMeta.inspect(meta);

        // confirms it's not a clone (by design)
        expect(inspected).toBe(inspected2);
    });

    it("throws when inspect receives invalid input", () => {
        expect(() => {
            AnsiMeta.inspect({} as any);
        }).toThrow(TypeError);
    });
});