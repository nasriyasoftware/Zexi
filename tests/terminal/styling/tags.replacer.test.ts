import { ANSI } from "../../../src/core/terminal/styling/ansi";
import TagsReplacer from "../../../src/core/terminal/styling/tags";

describe("TagsReplacer", () => {
    describe("basic replacements", () => {
        test("replaces reset tag", () => {
            const input = "hello <:reset>world";
            const output = TagsReplacer.replace(input);

            expect(output).toBe(`hello ${ANSI.reset}world`);
        });

        test("replaces standard color tags", () => {
            const input = "hello <:color:blue>world<:reset>";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `hello ${ANSI.color.fg.normal.blue}world${ANSI.reset}`
            );
        });

        test("replaces bright color tags", () => {
            const input = "hello <:color:bright-blue>world";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `hello ${ANSI.color.fg.bright.blue}world`
            );
        });

        test("replaces background color tags", () => {
            const input = "hello <:color-bg:blue>world";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `hello ${ANSI.color.bg.normal.blue}world`
            );
        });

        test("replaces bright background color tags", () => {
            const input = "hello <:color-bg:bright-blue>world";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `hello ${ANSI.color.bg.bright.blue}world`
            );
        });

        test("replaces style tags", () => {
            const input = "hello <:style:bold>world";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `hello ${ANSI.style.bold}world`
            );
        });
    });

    describe("fallback behavior (non-strict)", () => {
        test("preserves unknown color tags", () => {
            const input = "hello <:color:unknown>world";

            const output = TagsReplacer.replace(input, false);

            expect(output).toBe("hello <:color:unknown>world");
        });

        test("preserves unknown style tags", () => {
            const input = "hello <:style:weird>world";

            const output = TagsReplacer.replace(input, false);

            expect(output).toBe("hello <:style:weird>world");
        });
    });

    describe("strict mode", () => {
        test("removes unknown color tags", () => {
            const input = "hello <:color:unknown>world";

            const output = TagsReplacer.replace(input, true);

            expect(output).toBe("hello world");
        });

        test("removes unknown style tags", () => {
            const input = "hello <:style:weird>world";

            const output = TagsReplacer.replace(input, true);

            expect(output).toBe("hello world");
        });
    });

    describe("multiple replacements", () => {
        test("handles mixed tags in one string", () => {
            const input =
                "<:color:blue>hello<:reset> <:style:bold>world<:reset>";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `${ANSI.color.fg.normal.blue}hello${ANSI.reset} ` +
                `${ANSI.style.bold}world${ANSI.reset}`
            );
        });

        test("handles repeated tags correctly", () => {
            const input = "<:color:blue>one<:color:blue>two<:reset>";

            const output = TagsReplacer.replace(input);

            expect(output).toBe(
                `${ANSI.color.fg.normal.blue}one` +
                `${ANSI.color.fg.normal.blue}two${ANSI.reset}`
            );
        });
    });

    describe("edge cases", () => {
        test("returns empty string unchanged", () => {
            expect(TagsReplacer.replace("")).toBe("");
        });

        test("does not modify plain text", () => {
            expect(TagsReplacer.replace("hello world")).toBe("hello world");
        });

        test("handles malformed tag gracefully", () => {
            const input = "<:color:>";

            const output = TagsReplacer.replace(input, false);

            expect(output).toBe("<:color:>");
        });
    });
});