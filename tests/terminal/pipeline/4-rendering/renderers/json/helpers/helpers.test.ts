import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { JSONPipelineFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";

import TOKENS from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import objectPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/object.pass";
import mapPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/map.pass";
import setPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/set.pass";

import LayoutResolver from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver";

import {
    createResolver,
    highlightEnvelope,
    restoreDepth,
    ignoreCurrentGroup,
    abortWriting,
    forceBlock,
    resolvePrimitiveOverflow,
    getLayout
} from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/utils";

// -----------------------------------------------------
// mocks
// -----------------------------------------------------
const mocks = {
    utils: {
        createResolver: mock(() => {
            const ctx = createCtx();

            ctx.tokens.inject(new TOKENS.GroupStart());
            ctx.tokens.next();

            return new LayoutResolver(ctx, new Set(), 'json')
        }),
        abortWriting: mock(),
        forceBlock: mock(),
        resolvePrimitiveOverflow: mock(),
        restoreDepth: mock(),
        ignoreCurrentGroup: mock(),
        getLayout: mock(),
        highlightEnvelope: mock()
    },
    objectPassMock: mock(),
    setPassMock: mock(),
    mapPassMock: mock()
}

mock.module(
    "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/object.pass",
    () => ({ default: mocks.objectPassMock })
);

mock.module(
    "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/set.pass",
    () => ({ default: mocks.setPassMock })
);
mock.module(
    "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/map.pass",
    () => ({ default: mocks.mapPassMock })
);

mock.module(
    "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/utils",
    () => (mocks.utils)
);

/* ------------------------------------------------------------------ */
/* TESTS                                                             */
/* ------------------------------------------------------------------ */

describe("JSONHelpers", () => {

    beforeEach(() => {
        mock.clearAllMocks();
    });

    afterAll(() => {
        mock.restore();
    })

    describe("isVisibleToken", () => {

        it("filters undefined", () => {
            const h = createHelpers();

            expect(
                h.isVisibleToken({
                    kind: "primitive",
                    type: "undefined"
                } as Token)
            ).toBe(false);
        });

        it("filters symbol", () => {
            const h = createHelpers();

            expect(
                h.isVisibleToken({
                    kind: "primitive",
                    type: "symbol"
                } as Token)
            ).toBe(false);
        });

        it("allows primitives", () => {
            const h = createHelpers();

            expect(
                h.isVisibleToken({
                    kind: "primitive",
                    type: "string"
                } as Token)
            ).toBe(true);
        });

        it("allows structural tokens", () => {
            const h = createHelpers();

            expect(
                h.isVisibleToken({
                    kind: "object-open"
                } as Token)
            ).toBe(true);

            expect(
                h.isVisibleToken({
                    kind: "separator"
                } as Token)
            ).toBe(true);
        });
    });

    describe("resolveLayout", () => {

        it("creates resolver with correct config and resolves", () => {
            const ctx = createCtx();
            const h = createHelpers({ ctx });

            const result = h.resolveLayout();

            expect(createResolver).toHaveBeenCalledWith(
                expect.objectContaining({
                    renderer: "json",
                    inlineSafe: expect.any(Set),
                    ctx
                })
            );

            expect(result).toBe("inline");
        });
    });

    describe("abortWriting", () => {

        it("delegates abortWriting with the rendering context", () => {
            const ctx = createCtx();

            const h = createHelpers({ ctx });

            h.abortWriting();

            expect(abortWriting).toHaveBeenCalledTimes(1);
            expect(abortWriting).toHaveBeenCalledWith(ctx);
        });
    });

    describe("restoreDepth", () => {

        it("delegates restoreDepth", () => {
            const h = createHelpers();

            h.restoreDepth();

            expect(restoreDepth).toHaveBeenCalledWith(
                expect.any(Object)
            );
        });
    });

    describe("ignoreCurrentGroup", () => {

        it("delegates ignoreCurrentGroup", () => {
            const h = createHelpers();

            h.ignoreCurrentGroup();

            expect(ignoreCurrentGroup).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    flags: expect.any(Object)
                })
            );
        });
    });

    describe("getLayout", () => {

        it("delegates in compact mode", () => {
            mocks.utils.getLayout.mockReturnValue(null);

            const ctx = createCtx();
            const h = createHelpers({ mode: "compact", ctx });

            expect(h.getLayout()).toBe(null);

            expect(getLayout).toHaveBeenCalledWith({ mode: "compact", ctx }, undefined);
        });

        it("delegates in pretty mode", () => {
            mocks.utils.getLayout.mockReturnValue("inline");

            const ctx = createCtx();
            const h = createHelpers({ mode: "pretty", ctx });

            expect(h.getLayout()).toBe("inline");

            expect(mocks.utils.getLayout).toHaveBeenCalledWith({ mode: "pretty", ctx }, undefined);
        });
    });

    describe("highlightEnvelope", () => {
        
        it("delegates to utils", () => {
            const flags = createFlags();
            const h = createHelpers({ flags });

            const tokens = [
                { kind: "primitive" } as Token
            ];

            h.highlightEnvelope(tokens);

            expect(highlightEnvelope).toHaveBeenCalled();
            expect(highlightEnvelope).toHaveBeenCalledWith(flags, tokens);
        });
    });

    describe("transforms", () => {

        it("object pass forwards ctx and ignoredTokens", () => {
            const h = createHelpers();

            h.transforms.object();

            expect(objectPass).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    ignoredTokens: expect.any(Set)
                }),
                expect.any(JSONHelpers)
            );
        });

        it("set pass forwards ctx and ignoredTokens", () => {
            const h = createHelpers();

            h.transforms.set();

            expect(setPass).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    ignoredTokens: expect.any(Set)
                })
            );
        });

        it("map pass forwards ctx and ignoredTokens", () => {
            const h = createHelpers();

            h.transforms.map();

            expect(mapPass).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    ignoredTokens: expect.any(Set)
                })
            );
        });
    });

    describe("forceBlock", () => {

        it("delegates forceBlock with context and flags", () => {
            const flags = createFlags();
            const ctx = createCtx();

            const h = createHelpers({ ctx, flags });

            h.forceBlock();

            expect(forceBlock).toHaveBeenCalledTimes(1);
            expect(forceBlock).toHaveBeenCalledWith({ ctx, flags });
        });
    });

    describe("resolvePrimitiveOverflow", () => {

        it("delegates primitive overflow resolution", () => {
            const flags = createFlags();
            const ctx = createCtx();

            const h = createHelpers({
                ctx,
                flags,
                mode: "pretty"
            });

            h.resolvePrimitiveOverflow();

            expect(resolvePrimitiveOverflow).toHaveBeenCalledTimes(1);
            expect(resolvePrimitiveOverflow).toHaveBeenCalledWith({
                ctx,
                flags,
                mode: "pretty"
            });
        });

        it("forwards compact mode", () => {
            const flags = createFlags();
            const ctx = createCtx();

            const h = createHelpers({
                ctx,
                flags,
                mode: "compact"
            });

            h.resolvePrimitiveOverflow();

            expect(resolvePrimitiveOverflow).toHaveBeenCalledWith({
                ctx,
                flags,
                mode: "compact"
            });
        });
    });

});

/* ------------------------------------------------------------------ */
/* helpers                                                           */
/* ------------------------------------------------------------------ */

function createHelpers(options?: {
    mode?: "compact" | "pretty";
    flags?: JSONPipelineFlags;
    ignoredTokens?: Token[];
    ctx?: ZexiRenderingContext;
}) {
    return new JSONHelpers({
        ctx: options?.ctx ?? createCtx(),
        flags: options?.flags ?? createFlags(),
        ignoredTokens: new Set(options?.ignoredTokens ?? []),
        mode: options?.mode ?? "compact"
    });
}

function createCtx() {
    return new ZexiRenderingContext([], {
        spaces: 2,
        maxWidth: Infinity
    });
}

function createFlags(): JSONPipelineFlags {
    return {
        ansiEnabled: false,
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    };
}