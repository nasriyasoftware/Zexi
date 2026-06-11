import { parseTokens, constructOptions } from "../../../../../src/core/cli/kernal/assets/runner/helpers";

describe("parseTokens", () => {
    it("collects regular words when no options are present", () => {
        const result = parseTokens(["build", "project", "now"]);

        expect(result).toEqual({
            words: ["build", "project", "now"],
            options: [],
            argsAfterBreak: [],
        });
    });

    it("parses long options with inline and next-token values", () => {
        const result = parseTokens(["run", "--env=prod", "--target", "api", "deploy"]);

        expect(result).toEqual({
            words: ["run", "deploy"],
            options: [
                { name: "env", value: "prod", raw: "--env=prod" },
                { name: "target", value: "api", raw: "--target" },
            ],
            argsAfterBreak: [],
        });
    });

    it("uses the following non-option token as long option value", () => {
        const result = parseTokens(["--verbose", "run"]);

        expect(result).toEqual({
            words: [],
            options: [{ name: "verbose", value: "run", raw: "--verbose" }],
            argsAfterBreak: [],
        });
    });

    it("uses the following non-option token as the last grouped short option value", () => {
        const result = parseTokens(["-abc", "task"]);

        expect(result).toEqual({
            words: [],
            options: [
                { name: "a", value: true, raw: "-abc" },
                { name: "b", value: true, raw: "-abc" },
                { name: "c", value: "task", raw: "-abc" },
            ],
            argsAfterBreak: [],
        });
    });

    it("parses last short option with a following value", () => {
        const result = parseTokens(["run", "-ab", "42", "tail"]);

        expect(result).toEqual({
            words: ["run", "tail"],
            options: [
                { name: "a", value: true, raw: "-ab" },
                { name: "b", value: "42", raw: "-ab" },
            ],
            argsAfterBreak: [],
        });
    });

    it("stops option parsing after '--' and collects remaining args", () => {
        const result = parseTokens(["-a", "start", "--", "--not-option", "-x", "rest"]);

        expect(result).toEqual({
            words: [],
            options: [{ name: "a", value: "start", raw: "-a" }],
            argsAfterBreak: ["--not-option", "-x", "rest"],
        });
    });
});

describe("constructOptions", () => {
    it("normalizes option names and maps values", () => {
        const result = constructOptions([
            { name: "My-Option", value: "value-1", raw: "--My-Option" },
            { name: "v", value: true, raw: "-v" },
            { name: "debug", raw: "--debug" },
        ]);

        expect(result).toEqual({
            "my-option": "value-1",
            v: true,
            debug: undefined,
        });
    });

    it("throws with appended raw input when option name is invalid", () => {
        expect(() =>
            constructOptions([{ name: "1bad", value: "x", raw: "--1bad=x" }]),
        ).toThrow("Must start with a letter | Input: --1bad=x");
    });
});
