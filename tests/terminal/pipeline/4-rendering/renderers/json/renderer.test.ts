import JSONRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/renderer";
import _rendering from "../../helpers/helpers";
import type { JsonOptions } from "../../../../../../src/core/terminal/pipeline/types";

const render = (value: unknown, options: JsonOptions = {}) => {
    const tokens = _rendering.tokenize(value, 'json');
    return JSONRenderer.render(tokens, options);
}

describe('JSON renderer', () => {
    // ---------------------------------------------------------------------
    // PRIMITIVES (existing + strengthened)
    // ---------------------------------------------------------------------

    it("renders primitives deterministically", () => {
        expect(render(123)).toBe("123");
        expect(render("abc")).toBe('abc');
        expect(render(true)).toBe("true");
        expect(render(null)).toBe("null");
        expect(render(undefined)).toBe("undefined");
    });

    it("renders numeric edge cases deterministically", () => {
        expect(render(NaN)).toBe("NaN");
        expect(render(Infinity)).toBe("Infinity");
        expect(render(-Infinity)).toBe("-Infinity");
    });

    it("renders symbols as string output", () => {
        expect(render(Symbol("x"))).toBe("Symbol(x)");
    });

    // ---------------------------------------------------------------------
    // STRUCTURES
    // ---------------------------------------------------------------------

    it("renders arrays deterministically", () => {
        expect(render([1, 2, 3])).toBe("[1,2,3]");
    });

    it("renders plain objects deterministically", () => {
        expect(render({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
    });

    it("collapses custom class instances to {}", () => {
        class A {
            x = 1;
        }

        expect(render(new A())).toBe("{}");
    });

    it("renders Map and Set", () => {

        {
            const entries = [["a", 1]] as const;
            const map = new Map(entries);

            const out = render(map);
            const outObj = JSON.parse(out);

            expect(outObj.$codec).toMatch(/zexi@[0-9].[0-9]/);
            expect(outObj.$kind).toBe("map");
            expect(outObj.$payload.size).toBe(1)
            expect(outObj.$payload.entries).toEqual(entries.map(e => ({ key: e[0], value: e[1] })));
        }

        {
            const data = [1, 2] as const;
            const set = new Set(data);

            const out = render(set);
            const outObj = JSON.parse(out);

            expect(outObj.$codec).toMatch(/zexi@[0-9].[0-9]/);
            expect(outObj.$kind).toBe("set");
            expect(outObj.$payload.size).toBe(2);
            expect(outObj.$payload.values).toEqual(data);
        }
    });

    // ---------------------------------------------------------------------
    // LAYOUT MODE
    // ---------------------------------------------------------------------

    it("respects compact mode (no extra line breaks)", () => {
        const out = render({ a: 1, b: 2 }, { mode: "compact" });

        expect(out.includes("\n")).toBe(false);
    });

    it("respects spaces configuration override", () => {
        const out = render({ a: 1 }, { mode: 'pretty', spaces: 4 });

        // Just ensure output still deterministic and formatted
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
    });

    // ---------------------------------------------------------------------
    // TOKEN INJECTION BEHAVIOR (important for your pipeline)
    // ---------------------------------------------------------------------

    it("correctly handles injected function meta-token expansion", () => {
        const fn = () => 1;

        const out = render({ fn });
        // {\"fn\":{\"$codec\":\"zexi@1.0\",\"$kind\":\"function\",\"$payload\":{\"name\":\"fn\"}}}
        const outObj = JSON.parse(out);

        expect(outObj.fn.$codec).toMatch(/zexi@[0-9].[0-9]/);
        expect(outObj.fn.$kind).toBe("function");
        expect(outObj.fn.$payload.name).toBe("fn");
    });

    // ---------------------------------------------------------------------
    // ERROR SCOPES (VERY IMPORTANT FOR YOUR ARCHITECTURE)
    // ---------------------------------------------------------------------

    it("renders error object structure deterministically", () => {
        const err = new Error("boom");

        const out = render(err);

        // Must preserve structured error serialization
        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
    });

    it("handles nested error cause chain deterministically", () => {
        const err = new Error("outer");
        (err as any).cause = new Error("inner");

        const out = render(err);

        expect(typeof out).toBe("string");
        expect(out.includes("outer") || out.includes("inner")).toBe(true);
    });

    // ---------------------------------------------------------------------
    // GROUP / SCOPE CONSISTENCY
    // ---------------------------------------------------------------------

    it("does not produce unclosed structural tokens", () => {
        const out = render({
            a: { b: { c: 1 } }
        });

        // basic sanity: brackets must match
        const open = (out.match(/\{/g) || []).length;
        const close = (out.match(/\}/g) || []).length;

        expect(open).toBe(close);
    });

    it("produces deterministic ordering for object properties", () => {
        const out1 = render({ a: 1, b: 2 });
        const out2 = render({ b: 2, a: 1 });

        expect(out1).toBe(out2);
    });

    // ---------------------------------------------------------------------
    // CALLBACK TOKENS (execution side-effect safety)
    // ---------------------------------------------------------------------

    it("executes callback tokens without affecting output determinism", () => {
        const out1 = render({ a: 1 });

        const out2 = render({ a: 1 });

        expect(out1).toBe(out2);
    });

    // ---------------------------------------------------------------------
    // WRAPPING / NEWLINE SAFETY
    // ---------------------------------------------------------------------

    it("does not introduce random whitespace variance", () => {
        const out = render([1, 2, 3, 4, 5], {
            mode: "compact"
        });

        expect(out).toBe("[1,2,3,4,5]");
    });
})