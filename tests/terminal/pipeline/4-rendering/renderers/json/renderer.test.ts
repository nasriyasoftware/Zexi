import JSONRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/renderer";
import _rendering from "../../helpers/helpers";
import type { JsonOptions } from "../../../../../../src/core/terminal/pipeline/types";

describe("JSON renderer (integration)", () => {

    // ---------------------------------------------------------------------
    // PRIMITIVES
    // ---------------------------------------------------------------------

    it("renders primitives deterministically", () => {
        expect(render(123)).toBe("123");
        expect(render("abc")).toBe("abc");
        expect(render(true)).toBe("true");
        expect(render(null)).toBe("null");
        expect(render(undefined)).toBe("undefined");
    });

    it("renders numeric edge cases deterministically", () => {
        expect(render(NaN)).toBe("NaN");
        expect(render(Infinity)).toBe("Infinity");
        expect(render(-Infinity)).toBe("-Infinity");
    });

    it("renders symbols as stable string output", () => {
        expect(render(Symbol("x"))).toBe("Symbol(x)");
    });

    it("renders root-scope strings without quotes", () => {
        expect(render("Ahmad")).toBe("Ahmad");
    });

    it("renders root-scope dates without quotes", () => {
        const date = new Date("1996-01-01T00:00:00.000Z");
        expect(render(date)).toBe("1996-01-01T00:00:00.000Z");
    });

    // ---------------------------------------------------------------------
    // STRUCTURES
    // ---------------------------------------------------------------------

    it("renders arrays deterministically", () => {
        expect(render([1, 2, 3])).toBe("[1,2,3]");
    });

    it("renders plain objects deterministically", () => {
        const out1 = render({ a: 1, b: 2 });
        const out2 = render({ b: 2, a: 1 });

        expect(out1).toBe(out2);
        expect(out1).toBe('{"a":1,"b":2}');
    });

    it("collapses custom class instances to empty object", () => {
        class A {
            x = 1;
        }

        expect(render(new A())).toBe("{}");
    });

    it("quotes nested string values", () => {
        const out = render({ a: "Ahmad" });

        expect(out).toBe('{"a":"Ahmad"}');

        const obj = JSON.parse(out);
        expect(obj.a).toBe("Ahmad"); // proves it was properly quoted in JSON form
    });

    it("stringifies nested dates safely", () => {
        const out = render({ d: new Date("1996-01-01T00:00:00.000Z") });

        expect(out).toBe('{"d":"1996-01-01T00:00:00.000Z"}');

        const obj = JSON.parse(out);
        expect(obj.d).toBe("1996-01-01T00:00:00.000Z");
    });

    it("distinguishes root vs nested primitive rendering", () => {
        const root = render("x");
        const nested = render({ a: "x" });

        expect(root).toBe("x");
        expect(JSON.parse(nested).a).toBe("x");
    });

    // ---------------------------------------------------------------------
    // MAP / SET
    // ---------------------------------------------------------------------

    it("renders Map deterministically", () => {
        const map = new Map([["a", 1]]);

        const out = render(map);
        const obj = JSON.parse(out);

        expect(obj.$codec).toMatch(/zexi@\d+\.\d+/);
        expect(obj.$kind).toBe("map");
        expect(obj.$payload.size).toBe(1);
        expect(obj.$payload.entries).toEqual([
            { key: "a", value: 1 }
        ]);
    });

    it("renders Set deterministically", () => {
        const set = new Set([1, 2]);

        const out = render(set);
        const obj = JSON.parse(out);

        expect(obj.$codec).toMatch(/zexi@\d+\.\d+/);
        expect(obj.$kind).toBe("set");
        expect(obj.$payload.size).toBe(2);
        expect(obj.$payload.values).toEqual([1, 2]);
    });

    // ---------------------------------------------------------------------
    // LAYOUT MODE
    // ---------------------------------------------------------------------

    it("respects compact mode", () => {
        const out = render({ a: 1, b: 2 }, { mode: "compact" });

        expect(out.includes("\n")).toBe(false);
        expect(out).toBe('{"a":1,"b":2}');
    });

    it("respects pretty mode configuration", () => {
        const out = render({ a: 1 }, { mode: "pretty", spaces: 4 });

        // Will apply pretty mode, but stays inline because it's a simple object
        expect(out).toBe("{ \"a\": 1 }");
    });

    // ---------------------------------------------------------------------
    // FUNCTION ENVELOPES
    // ---------------------------------------------------------------------

    it("expands function tokens into envelopes deterministically", () => {
        const fn = () => 1;

        const out = render({ fn });
        const obj = JSON.parse(out);

        expect(obj.fn.$codec).toMatch(/zexi@\d+\.\d+/);
        expect(obj.fn.$kind).toBe("function");
        expect(obj.fn.$payload.name).toBe("fn");
    });

    // ---------------------------------------------------------------------
    // ERROR RENDERING
    // ---------------------------------------------------------------------

    it("renders error structure deterministically", () => {
        const err = new Error("boom");
        const out = render(err);

        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
    });

    it("renders nested error cause deterministically", () => {
        const err = new TypeError("outer", { cause: new SyntaxError("inner") });

        const out = render(err);
        const obj = JSON.parse(out);

        expect(obj.$codec).toMatch(/zexi@\d+\.\d+/);
        expect(obj.$kind).toBe("error");
        expect(obj.$payload.name).toBe("TypeError");
        expect(obj.$payload.message).toBe("outer");
        expect(obj.$payload.cause.$codec).toMatch(/zexi@\d+\.\d+/);
        expect(obj.$payload.cause.$kind).toBe("error");
        expect(obj.$payload.cause.$payload.name).toBe("SyntaxError");
        expect(obj.$payload.cause.$payload.message).toBe("inner");
    });

    // ---------------------------------------------------------------------
    // STRUCTURAL CONSISTENCY (LIGHT SANITY CHECK ONLY)
    // ---------------------------------------------------------------------

    it("produces balanced object delimiters", () => {
        const out = render({
            a: { b: { c: 1 } }
        });

        const open = (out.match(/\{/g) || []).length;
        const close = (out.match(/\}/g) || []).length;

        expect(open).toBe(close);
    });

    it("is deterministic for reordered object keys", () => {
        const out1 = render({ a: 1, b: 2 });
        const out2 = render({ b: 2, a: 1 });

        expect(out1).toBe(out2);
    });

    // ---------------------------------------------------------------------
    // DETERMINISM GUARANTEE
    // ---------------------------------------------------------------------

    it("is fully deterministic across repeated renders", () => {
        const v = { a: 1, b: 2 };

        expect(render(v)).toBe(render(v));
        expect(render(v)).toBe(render(v));
    });
});

function render(value: unknown, options: JsonOptions = {}) {
    const tokens = _rendering.tokenize(value, 'json');
    return JSONRenderer.render(tokens, options);
}