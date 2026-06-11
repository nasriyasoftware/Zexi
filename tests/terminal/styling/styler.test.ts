import consoleStyler from "../../../src/core/terminal/styling/consoleStyler";

const ANSI = consoleStyler.ansi;

describe("ConsoleStyler", () => {
    describe("strip", () => {
        it("removes ANSI escape sequences", () => {
            const input = `${ANSI.color.red}Hello${ANSI.reset}`;
            expect(consoleStyler.strip(input)).toBe("Hello");
        });

        it("returns plain string unchanged", () => {
            expect(consoleStyler.strip("Hello")).toBe("Hello");
        });
    });

    describe("hasANSI", () => {
        it("detects ANSI sequences", () => {
            const input = `${ANSI.color.red}Hello`;
            expect(consoleStyler.hasANSI(input)).toBe(true);
        });

        it("returns false for plain text", () => {
            expect(consoleStyler.hasANSI("Hello")).toBe(false);
        });
    });

    describe("format", () => {
        it("formats with color only", () => {
            const result = consoleStyler.format("Hello", { color: "red" });

            expect(result).toBe(`${ANSI.color.red}Hello${ANSI.reset}`);
        });

        it("formats with single style", () => {
            const result = consoleStyler.format("Hello", { style: "bold" });

            expect(result).toBe(`${ANSI.style.bold}Hello${ANSI.reset}`);
        });

        it("formats with multiple styles", () => {
            const result = consoleStyler.format("Hello", {
                style: ["bold", "underline"]
            });

            expect(result).toBe(
                `${ANSI.style.bold}${ANSI.style.underline}Hello${ANSI.reset}`
            );
        });

        it("formats with color and styles", () => {
            const result = consoleStyler.format("Hello", {
                color: "green",
                style: ["bold"]
            });

            expect(result).toBe(
                `${ANSI.color.green}${ANSI.style.bold}Hello${ANSI.reset}`
            );
        });

        it("does not append reset if no formatting applied", () => {
            const result = consoleStyler.format("Hello");

            expect(result).toBe("Hello");
        });

        it("throws on invalid color", () => {
            expect(() =>
                consoleStyler.format("Hello", { color: "invalid" as any })
            ).toThrow("Unknown color");
        });

        it("throws on invalid style type", () => {
            expect(() =>
                consoleStyler.format("Hello", { style: 123 as any })
            ).toThrow("Expected options.style");
        });

        it("throws on unknown style", () => {
            expect(() =>
                consoleStyler.format("Hello", { style: ["invalid" as any] })
            ).toThrow("Unknown style");
        });
    });

    describe("render", () => {
        it("renders color tags", () => {
            const input = "<:color:red>Hello<:reset>";

            const result = consoleStyler.render(input);

            expect(result).toBe(
                `${ANSI.color.red}Hello${ANSI.reset}`
            );
        });

        it("renders style tags", () => {
            const input = "<:style:bold>Hello<:reset>";

            const result = consoleStyler.render(input);

            expect(result).toBe(
                `${ANSI.style.bold}Hello${ANSI.reset}`
            );
        });

        it("renders mixed tags", () => {
            const input =
                "<:color:green><:style:bold>Hello<:reset>";

            const result = consoleStyler.render(input);

            expect(result).toBe(
                `${ANSI.color.green}${ANSI.style.bold}Hello${ANSI.reset}`
            );
        });

        it("removes unknown tags safely", () => {
            const input = "<:color:unknown>Hello<:reset>";

            const result = consoleStyler.render(input, { strict: true });

            expect(result).toBe(`Hello${ANSI.reset}`);
        });
    });

    describe("tags", () => {
        it("provides correct color tag format", () => {
            expect(consoleStyler.tags.color.red).toBe("<:color:red>");
        });

        it("provides correct style tag format", () => {
            expect(consoleStyler.tags.style.bold).toBe("<:style:bold>");
        });

        it("provides reset tag", () => {
            expect(consoleStyler.tags.reset).toBe("<:reset>");
        });
    });

    describe("ansi exposure", () => {
        it("exposes raw ANSI tokens", () => {
            expect(consoleStyler.ansi.color.red).toBe(ANSI.color.red);
        });
    });
});