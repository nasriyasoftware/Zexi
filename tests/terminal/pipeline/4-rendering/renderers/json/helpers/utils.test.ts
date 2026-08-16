import {
    abortWriting,
    createResolver,
    forceBlock,
    getLayout,
    highlightEnvelope,
    ignoreCurrentGroup,
    resolvePrimitiveOverflow,
    restoreDepth
} from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/utils";

import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import keys from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/keys";
import LayoutResolver from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver";
import DataEnvelope from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/data.envelope";
import JSONTokenizer from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import type { JSONPipelineFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";

jest.mock("../../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver");

const LayoutResolverMock = LayoutResolver as unknown as jest.Mock;

describe("JSON utils delegation layer", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("createResolver", () => {
        it("constructs LayoutResolver with correct arguments", () => {
            const ctx = makeCtx();

            createResolver({
                ctx,
                inlineSafe: new Set(["primitive"]),
                renderer: "json"
            });

            expect(LayoutResolverMock).toHaveBeenCalledWith(
                ctx,
                expect.any(Set),
                "json"
            );
        });
    });

    describe("abortWriting", () => {
        it("aborts the current group and restores traversal depth", () => {
            const ctx = makeCtx();

            const abortSpy = jest.spyOn(ctx.scopes, "abort");
            const decreaseSpy = jest.spyOn(ctx.depth, "decrease");

            const id = Symbol("group");

            ctx.scopes.begin({ id });
            ctx.data.set(keys.GROUP, id);
            ctx.data.set(keys.GROUP_DEPTH, ctx.depth.value);

            ctx.depth.increase();

            abortWriting(ctx);

            expect(decreaseSpy).toHaveBeenCalled();
            expect(abortSpy).toHaveBeenCalled();
        });

        it("does not modify layout flags", () => {
            const ctx = makeCtx();

            const id = Symbol("group");

            ctx.scopes.begin({ id });
            ctx.data.set(keys.GROUP, id);
            ctx.data.set(keys.GROUP_DEPTH, ctx.depth.value);

            const flags = createFlags();

            ctx.depth.increase();

            abortWriting(ctx);

            expect(flags.forceNextGroupAsBlock).toBe(false);
        });

        it("throws when no group exists", () => {
            const ctx = makeCtx();

            expect(() => abortWriting(ctx))
                .toThrow(
                    "Invariant violation: Aborting a scope without a current group identifier."
                );
        });

        it("throws when aborting the root scope", () => {
            const ctx = makeCtx();

            ctx.data.set(keys.GROUP, Symbol("g"));
            ctx.data.set(keys.GROUP_DEPTH, 1);

            jest.spyOn(ctx.scopes, "isRoot", "get")
                .mockReturnValue(true);

            expect(() => abortWriting(ctx))
                .toThrow(/root scope/i);
        });
    });

    describe("forceBlock", () => {
        it("aborts the current group", () => {
            const ctx = makeCtx();
            const flags = createFlags();

            const abortSpy = jest.spyOn(ctx.scopes, "abort");

            const id = Symbol("group");

            ctx.scopes.begin({ id });
            ctx.data.set(keys.GROUP, id);
            ctx.data.set(keys.GROUP_DEPTH, ctx.depth.value);

            ctx.depth.increase();

            forceBlock({ ctx, flags });

            expect(abortSpy).toHaveBeenCalled();
        });

        it("requests the next rendering attempt to use block layout", () => {
            const ctx = makeCtx();
            const flags = createFlags();

            const id = Symbol("group");

            ctx.scopes.begin({ id });
            ctx.data.set(keys.GROUP, id);
            ctx.data.set(keys.GROUP_DEPTH, ctx.depth.value);

            ctx.depth.increase();

            forceBlock({ ctx, flags });

            expect(flags.forceNextGroupAsBlock).toBe(true);
        });

        it("propagates abortWriting invariants", () => {
            const ctx = makeCtx();
            const flags = createFlags();

            expect(() => forceBlock({ ctx, flags }))
                .toThrow(
                    "Invariant violation: Aborting a scope without a current group identifier."
                );
        });
    });

    /* ------------------------------------------------------------------ */
    /* PRIMITIVE OVERFLOW RESOLUTION                                     */
    /* ------------------------------------------------------------------ */
    describe("resolvePrimitiveOverflow", () => {
        const prepareTest = (value: unknown) => {
            const flags = createFlags();
            const tokens = JSONTokenizer(value);
            const ctx = new ZexiRenderingContext(tokens, {
                spaces: 2,
                maxWidth: Infinity
            });

            // advance tokens
            while (ctx.tokens.hasNext()) {
                const token = ctx.tokens.next()!;
                if (token.kind === 'group-start') {
                    ctx.scopes.begin({ id: token.id });

                    ctx.data.set(keys.RENDERING_LAYOUT, 'inline');
                    ctx.data.set(keys.GROUP, token.id);
                    ctx.data.set(keys.GROUP_DEPTH, ctx.depth.value);
                }

                if (token.kind === 'indent-start') {
                    ctx.depth.increase();
                    continue;
                }

                if (token.kind === 'primitive') {
                    break;
                }
            }

            return { ctx, flags };
        }

        it("changes the layout to block", () => {
            const { ctx, flags } = prepareTest({ a: { b: 1 } });

            expect(ctx.depth.value).toBe(2);

            resolvePrimitiveOverflow({
                mode: "pretty",
                ctx,
                flags
            });

            expect(flags.forceNextGroupAsBlock).toBe(true);
            expect(ctx.depth.value).toBe(0);
        })

        it("does nothing in compact mode", () => {
            const { ctx, flags } = prepareTest('A');

            expect(ctx.depth.value).toBe(0);
            const original = { ...flags };

            resolvePrimitiveOverflow({
                mode: "compact",
                ctx,
                flags
            });

            expect(flags).toEqual(original);
            expect(ctx.depth.value).toBe(0);
        });

        it("escalates array elements into block layout when inline array overflows", () => {
            const { ctx, flags } = prepareTest([1, 2, 3]);

            ctx.data.set(keys.OBJECT, "Array");

            expect(ctx.depth.value).toBe(1);

            resolvePrimitiveOverflow({
                mode: "pretty",
                ctx,
                flags
            });

            expect(flags.forceNextGroupAsBlock).toBe(true);
            expect(ctx.depth.value).toBe(0);
        });

        it("cascades block layout when primitive is inside a key-value pair", () => {
            const { ctx, flags } = prepareTest({ a: [{ b: 2 }] });

            expect(ctx.depth.value).toBe(3);

            resolvePrimitiveOverflow({
                mode: "pretty",
                ctx,
                flags
            });

            // should force at least one block transition
            expect(flags.forceNextGroupAsBlock).toBe(true);
            expect(ctx.depth.value).toBe(0);
        });
    });

    describe("restoreDepth", () => {
        it("restores depth to snapshot value", () => {
            const ctx = makeCtx();

            ctx.data.set(keys.GROUP_DEPTH, 1);

            ctx.depth.increase();
            ctx.depth.increase();

            restoreDepth(ctx);

            expect(ctx.depth.value).toBe(1);
        });

        it("throws when snapshot is missing", () => {
            const ctx = makeCtx();

            expect(() => restoreDepth(ctx))
                .toThrow(/depth/i);
        });

        it("throws when snapshot is greater than current depth", () => {
            const ctx = makeCtx();

            ctx.data.set(keys.GROUP_DEPTH, 5);

            expect(() => restoreDepth(ctx))
                .toThrow(/greater/i);
        });
    });

    describe("ignoreCurrentGroup", () => {
        it("sets ignore flag when group exists", () => {
            const ctx = makeCtx();
            const flags = createFlags();

            ctx.data.set(keys.GROUP, Symbol("g"));

            ignoreCurrentGroup({ ctx, flags });

            expect(flags.ignoreCurrentGroup).toBe(true);
        });

        it("throws when no group exists", () => {
            const ctx = makeCtx();
            const flags = createFlags();

            expect(() => ignoreCurrentGroup({ ctx, flags }))
                .toThrow(/no active group/i);
        });
    });

    describe("getLayout", () => {
        it("returns null in compact mode", () => {
            const ctx = makeCtx();

            expect(getLayout({ ctx, mode: "compact" })).toBeNull();
        });

        it("returns inline by default", () => {
            const ctx = makeCtx();

            expect(getLayout({ ctx, mode: "pretty" })).toBe("inline");
        });

        it("returns block when set in context", () => {
            const ctx = makeCtx();

            ctx.data.set(keys.RENDERING_LAYOUT, "block");

            expect(getLayout({ ctx, mode: "pretty" })).toBe("block");
        });

        it("returns parent layout when requested", () => {
            const ctx = makeCtx();

            ctx.data.set(keys.RENDERING_LAYOUT, "block");

            expect(
                getLayout({ ctx, mode: "pretty" }, { ofParent: true })
            ).toBe("block");
        });
    });

    describe("highlightEnvelope", () => {
        it("no-ops when ANSI is disabled", () => {
            const flags = createFlags(false);

            expect(() =>
                highlightEnvelope(flags, [])
            ).not.toThrow();
        });

        it("applies styling when ANSI enabled", () => {
            const flags = createFlags(true);

            const tokens = makeEnvelopeTokens();

            highlightEnvelope(flags, tokens);

            const primitives = tokens.filter(t => t.kind === "primitive");
            expect(primitives.length).toBeGreaterThan(0);
        });
    });
});

function makeCtx() {
    return new ZexiRenderingContext([], {
        spaces: 2,
        maxWidth: Infinity
    });
}

function createFlags(ansi = false): JSONPipelineFlags {
    return {
        ansiEnabled: ansi,
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    };
}

function makeEnvelopeTokens(): readonly Token[] {
    const env = new DataEnvelope('map', { size: 1 });
    const res = env.tokenize(JSONTokenizer);
    return res.tokens.start;
}