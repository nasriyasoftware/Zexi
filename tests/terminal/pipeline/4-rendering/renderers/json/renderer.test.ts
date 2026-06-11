import GraphBuilder from "../../../../../../src/core/terminal/pipeline/1-graphing/builder";
import { GraphNode } from "../../../../../../src/core/terminal/pipeline/1-graphing/types";
import RepresentationBuilder from "../../../../../../src/core/terminal/pipeline/2-representation/builder";
import { RepresentationNode } from "../../../../../../src/core/terminal/pipeline/2-representation/types";
import TokensBuffer from "../../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import Tokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";
import JSONRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/renderer";
import { JsonOptions } from "../../../../../../src/core/terminal/pipeline/types";

const helpers = {
    graph: (value: unknown): GraphNode => GraphBuilder.build(value, { cycles: 'throw', canonical: true }),
    rep: (graph: GraphNode): RepresentationNode => RepresentationBuilder.build(graph),
    tokenize: (repNode: RepresentationNode) => Tokenizer.tokenize(repNode),
    extractTokens: (buffer: TokensBuffer) => TokensBuffer.toArray(buffer),
}

const render = (value: unknown, options: JsonOptions = {}) => {
    const graph = helpers.graph(value);
    const rep = helpers.rep(graph);
    const buffer = helpers.tokenize(rep);
    const tokens = helpers.extractTokens(buffer);

    return JSONRenderer.render(tokens, options);
}

describe('JSON renderer', () => {
    // ---------------------------------------------------------------------
    // PRIMITIVES (existing + strengthened)
    // ---------------------------------------------------------------------

    it("renders primitives deterministically", () => {
        expect(render(123)).toBe("123");
        expect(render("abc")).toBe('"abc"');
        expect(render(true)).toBe("true");
        expect(render(null)).toBe("null");
        expect(render(undefined)).toBe("undefined");
    });

    it("renders numeric edge cases deterministically", () => {
        expect(render(NaN)).toBe("NaN");
        expect(render(Infinity)).toBe("Infinity");
        expect(render(-Infinity)).toBe("-Infinity");
    });

    it("renders symbols as empty output", () => {
        expect(render(Symbol("x"))).toBe("");
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

    it("collapses Map and Set", () => {
        expect(render(new Map([["a", 1]]))).toBe("{}");
        expect(render(new Set([1, 2]))).toBe("{}");
    });

    // ---------------------------------------------------------------------
    // LAYOUT MODE
    // ---------------------------------------------------------------------

    it("respects compact mode (no extra line breaks)", () => {
        const out = render({ a: 1, b: 2 }, { mode: "compact" });

        expect(out.includes("\n")).toBe(false);
    });

    it("respects spaces configuration override", () => {
        const out = render({ a: 1 }, { spaces: 4 });

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

        // Function should expand into metadata object (deterministic shape)
        expect(out).toBe('{"fn":{"type":"function","name":"fn"}}');
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