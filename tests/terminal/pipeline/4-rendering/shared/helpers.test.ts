import * as helpers from "../../../../../src/core/terminal/pipeline/4-rendering/shared/helpers";
import { DEFAULT_OUTPUT_CONFIG } from "../../../../../src/core/terminal/pipeline/4-rendering/types/types";


describe("resolveRendererConfig (deterministic)", () => {

    describe("terminal target", () => {

        it("returns pretty configuration", () => {
            const result = helpers.resolveRendererConfig("terminal", "pretty");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.terminal.pretty);
        });

        it("returns compact configuration", () => {
            const result = helpers.resolveRendererConfig("terminal", "compact");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.terminal.compact);
        });

        it("does not mutate default config (determinism check)", () => {
            const result = helpers.resolveRendererConfig("terminal", "pretty");
            expect(() => {
                // mutate result defensively
                (result as any).__testMutation = true;
            }).toThrow(TypeError);           
        });
    });

    describe("json target", () => {

        it("returns pretty configuration", () => {
            const result = helpers.resolveRendererConfig("json", "pretty");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.json.pretty);
        });

        it("returns compact configuration", () => {
            const result = helpers.resolveRendererConfig("json", "compact");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.json.compact);
        });
    });

    describe("debug target", () => {

        it("returns pretty configuration", () => {
            const result = helpers.resolveRendererConfig("debug", "pretty");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.debug.pretty);
        });

        it("returns compact configuration", () => {
            const result = helpers.resolveRendererConfig("debug", "compact");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.debug.compact);
        });
    });

    describe("error handling", () => {

        it("throws on invalid target", () => {
            expect(() =>
                helpers.resolveRendererConfig("invalid" as any, "pretty")
            ).toThrow("Unknown output target: invalid");
        });
    });

    describe("determinism guarantees", () => {

        it("always returns same reference structure for repeated calls", () => {
            const a = helpers.resolveRendererConfig("terminal", "pretty");
            const b = helpers.resolveRendererConfig("terminal", "pretty");

            expect(a).toEqual(b);
        });

        it("does not depend on call order", () => {
            const a1 = helpers.resolveRendererConfig("json", "compact");
            const a2 = helpers.resolveRendererConfig("terminal", "pretty");

            const b1 = helpers.resolveRendererConfig("terminal", "pretty");
            const b2 = helpers.resolveRendererConfig("json", "compact");

            expect(a1).toEqual(b2);
            expect(a2).toEqual(b1);
        });
    });
});