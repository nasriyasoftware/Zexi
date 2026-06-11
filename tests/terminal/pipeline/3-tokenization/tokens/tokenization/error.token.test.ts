// Pipeline builders
import GraphBuilder from "../../../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../../../src/core/terminal/pipeline/2-representation/builder";
import Tokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";

// Types
import TokensBuffer from "../../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import type { GraphNode } from "../../../../../../src/core/terminal/pipeline/1-graphing/types";
import type { RepresentationNode } from "../../../../../../src/core/terminal/pipeline/2-representation/types";
import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";

// Helpers
const buildGraph = (value: unknown) => GraphBuilder.build(value, { cycles: "throw", });
const buildRep = (graph: GraphNode) => RepresentationBuilder.build(graph);
const tokenizeRep = (rep: RepresentationNode) => Tokenizer.tokenize(rep);
const removeStack = (error: Error) => {
    try {
        delete (error as any).stack;
    } catch {
        Object.defineProperty(error, "stack", {
            value: undefined,
            configurable: true,
        });
    }

    return error;
}
const injectStack = (error: Error, stack?: string) => {
    Object.defineProperty(error, "stack", {
        value:
            stack ??
            `
            Error: x
            at fn (/a.ts:1:1)
            `.trim(),
        configurable: true,
    });

    return error;
}

const tokenize = (value: unknown) => {
    const graph = buildGraph(value);
    const rep = buildRep(graph);
    return tokenizeRep(rep);
}

describe("Error tokenization (pipeline integration)", () => {
    const toTokens = (buffer: TokensBuffer) => TokensBuffer.toArray(buffer);

    it("emits correct error token stream (no stack, no cause)", () => {
        const error = removeStack(new Error("x"));
        const buffer = tokenize(error);
        const tokens = toTokens(buffer);

        expect(tokens.map(t => t.kind)).toEqual([
            "group-start",
            "error-start",
            "error-data",
            "error-end",
            "group-end"
        ]);
    });

    it("emits correct error token stream (stack only)", () => {
        const error = injectStack(new Error("x"));

        const buffer = tokenize(error);
        const tokens = toTokens(buffer);

        expect(tokens.map(t => t.kind)).toEqual([
            "group-start",
            "error-start",
            "error-data",
            "stack-trace",
            "error-end",
            "group-end"
        ]);
    });

    it("emits correct error token stream (cause only)", () => {
        const cause = removeStack(new Error("root"));
        const error = removeStack(new Error("wrapped", { cause }));

        const buffer = tokenize(error);
        const tokens = toTokens(buffer);

        const kinds = tokens.map(t => t.kind);

        expect(kinds).toEqual([
            "group-start",
            "error-start",
            "error-data",
            "error-cause-start",

            "group-start",
            "error-start",
            "error-data",
            "error-end",
            "group-end",

            "error-cause-end",
            "error-end",
            "group-end"
        ]);
    });

    it("emits correct error token stream (stack + cause)", () => {
        const cause = removeStack(new Error("root"));
        const error = injectStack(new Error("wrapped", { cause }))

        const buffer = tokenize(error);
        const tokens = toTokens(buffer);

        const kinds = tokens.map(t => t.kind);

        expect(kinds).toEqual([
            "group-start",
            "error-start",
            "error-data",
            "error-cause-start",

            "group-start",
            "error-start",
            "error-data",
            "error-end",
            "group-end",

            "error-cause-end",
            "stack-trace",
            "error-end",
            "group-end"
        ]);
    });

    it("keeps group and error scopes properly balanced", () => {
        const buffer = tokenize(new Error("wrapped"));
        const tokens = toTokens(buffer);

        const groupStart = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
        const groupEnd = tokens[tokens.length - 1] as InstanceType<typeof TOKENS.GroupEnd>;

        expect(groupStart.kind).toBe("group-start");
        expect(groupEnd.kind).toBe("group-end");

        expect(groupEnd.groupId).toBe(groupStart.id);
    });

    it("ensures error scope is properly closed before group closes", () => {
        const buffer = tokenize(new Error("wrapped"));
        const tokens = toTokens(buffer);

        const errorEndIndex = tokens.findIndex(t => t.kind === "error-end");
        const groupEndIndex = tokens.findIndex(t => t.kind === "group-end");

        expect(errorEndIndex).toBeGreaterThan(-1);
        expect(groupEndIndex).toBeGreaterThan(-1);
        expect(errorEndIndex).toBeLessThan(groupEndIndex);
    });

    it("preserves deterministic ordering of core error structure", () => {
        const buffer = tokenize(new SyntaxError("x"));
        const tokens = toTokens(buffer);

        expect(tokens[0].kind).toBe("group-start");
        expect(tokens[1].kind).toBe("error-start");
        expect(tokens[2].kind).toBe("error-data");
        expect(tokens[tokens.length - 2].kind).toBe("error-end");
        expect(tokens[tokens.length - 1].kind).toBe("group-end");
    });
});