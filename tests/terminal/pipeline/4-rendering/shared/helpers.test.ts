import * as helpers from "../../../../../src/core/terminal/pipeline/4-rendering/shared/helpers";
import { DEFAULT_OUTPUT_CONFIG } from "../../../../../src/core/terminal/pipeline/4-rendering/types/types";

describe("resolveRendererConfig (deterministic)", () => {

    describe("json target", () => {

        it("returns pretty configuration", () => {
            const result = helpers.resolveRendererConfig("json", "pretty");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.json().pretty);
        });

        it("returns compact configuration", () => {
            const result = helpers.resolveRendererConfig("json", "compact");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.json().compact);
        });
    });

    describe("debug target", () => {

        it("returns pretty configuration", () => {
            const result = helpers.resolveRendererConfig("debug", "pretty");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.debug().pretty);
        });

        it("returns compact configuration", () => {
            const result = helpers.resolveRendererConfig("debug", "compact");

            expect(result).toEqual(DEFAULT_OUTPUT_CONFIG.debug().compact);
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
            const a = helpers.resolveRendererConfig("debug", "pretty");
            const b = helpers.resolveRendererConfig("debug", "pretty");

            expect(a).toEqual(b);
        });

        it("does not depend on call order", () => {
            const a1 = helpers.resolveRendererConfig("json", "compact");
            const a2 = helpers.resolveRendererConfig("debug", "pretty");

            const b1 = helpers.resolveRendererConfig("debug", "pretty");
            const b2 = helpers.resolveRendererConfig("json", "compact");

            expect(a1).toEqual(b2);
            expect(a2).toEqual(b1);
        });
    });
});

describe("isVisibleToken", () => {

    describe("json normalizer", () => {

        it("returns false for undefined primitives", () => {
            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "undefined",
                    value: undefined
                } as any, "json")
            ).toBe(false);
        });

        it("returns false for symbol primitives", () => {
            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "symbol",
                    value: Symbol("x")
                } as any, "json")
            ).toBe(false);
        });

        it("returns true for visible primitive types", () => {
            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "string",
                    value: "hello"
                } as any, "json")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "number",
                    value: 1
                } as any, "json")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "boolean",
                    value: true
                } as any, "json")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "null",
                    value: null
                } as any, "json")
            ).toBe(true);
        });

        it("always returns true for non-primitive tokens", () => {
            expect(
                helpers.isVisibleToken({
                    kind: "separator"
                } as any, "json")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "object-open"
                } as any, "json")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "property"
                } as any, "json")
            ).toBe(true);
        });
    });

    describe("debug normalizer", () => {

        it("treats every token as visible", () => {
            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "undefined",
                    value: undefined
                } as any, "debug")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "primitive",
                    type: "symbol",
                    value: Symbol("x")
                } as any, "debug")
            ).toBe(true);

            expect(
                helpers.isVisibleToken({
                    kind: "separator"
                } as any, "debug")
            ).toBe(true);
        });
    });

});