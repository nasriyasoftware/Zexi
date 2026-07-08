import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { JSONPipelineFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";

import objectPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/object.pass";
import mapPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/map.pass";
import setPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/set.pass";

import * as utils from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/utils";

// -----------------------------------------------------
// mocks
// -----------------------------------------------------
jest.mock("../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/object.pass", () => ({
    __esModule: true,
    default: jest.fn()
}));

jest.mock("../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/set.pass", () => ({
    __esModule: true,
    default: jest.fn()
}));

jest.mock("../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/map.pass", () => ({
    __esModule: true,
    default: jest.fn()
}));

jest.mock("../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/utils",
    () => ({
        createResolver: jest.fn(),
        abortWriting: jest.fn(),
        forceBlock: jest.fn(),
        resolvePrimitiveOverflow: jest.fn(),
        restoreDepth: jest.fn(),
        ignoreCurrentGroup: jest.fn(),
        getLayout: jest.fn(),
        highlightEnvelope: jest.fn()
    })
);

const objectPassMock = objectPass as jest.Mock;
const setPassMock = setPass as jest.Mock;
const mapPassMock = mapPass as jest.Mock;

/* ------------------------------------------------------------------ */
/* TESTS                                                             */
/* ------------------------------------------------------------------ */

describe("JSONHelpers", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("isVisibleToken", () => {

        it("filters undefined", () => {
            const h = createHelpers();
            expect(h.isVisibleToken({ kind: "primitive", type: "undefined" } as Token)).toBe(false);
        });

        it("filters symbol", () => {
            const h = createHelpers();
            expect(h.isVisibleToken({ kind: "primitive", type: "symbol" } as Token)).toBe(false);
        });

        it("allows primitives", () => {
            const h = createHelpers();
            expect(h.isVisibleToken({ kind: "primitive", type: "string" } as Token)).toBe(true);
        });

        it("allows structural tokens", () => {
            const h = createHelpers();
            expect(h.isVisibleToken({ kind: "object-open" } as Token)).toBe(true);
            expect(h.isVisibleToken({ kind: "separator" } as Token)).toBe(true);
        });
    });

    describe("resolveLayout", () => {

        it("creates resolver with correct config and resolves", () => {
            const resolveMock = jest.fn(() => "inline");

            (utils.createResolver as jest.Mock).mockReturnValue({
                resolve: resolveMock
            });

            const h = createHelpers();

            const result = h.resolveLayout();

            expect(utils.createResolver).toHaveBeenCalledWith(
                expect.objectContaining({
                    renderer: "json",
                    inlineSafe: expect.any(Set),
                    ctx: expect.any(Object)
                })
            );

            expect(resolveMock).toHaveBeenCalled();
            expect(result).toBe("inline");
        });
    });

    describe("abortWriting", () => {
        it("delegates abortWriting with the rendering context", () => {
            const ctx = new ZexiRenderingContext([], {
                spaces: 2,
                maxWidth: Infinity
            });

            const h = createHelpers({ ctx });

            h.abortWriting();

            expect(utils.abortWriting).toHaveBeenCalledTimes(1);
            expect(utils.abortWriting).toHaveBeenCalledWith(ctx);
        });
    });

    describe("restoreDepth", () => {

        it("delegates restoreDepth", () => {
            const h = createHelpers();
            h.restoreDepth();

            expect(utils.restoreDepth).toHaveBeenCalledWith(expect.any(Object));
        });
    });

    describe("ignoreCurrentGroup", () => {

        it("delegates ignoreCurrentGroup", () => {
            const h = createHelpers();
            h.ignoreCurrentGroup();

            expect(utils.ignoreCurrentGroup).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    flags: expect.any(Object)
                })
            );
        });
    });

    describe("getLayout", () => {

        it("returns null in compact mode", () => {
            (utils.getLayout as jest.Mock).mockReturnValue(null);
            const h = createHelpers({ mode: "compact" });
            expect(h.getLayout()).toBe(null);
        });

        it("delegates correctly in pretty mode", () => {
            (utils.getLayout as jest.Mock).mockReturnValue("inline");
            const h = createHelpers({ mode: "pretty" });
            expect(h.getLayout()).toBe("inline");
        });
    });

    describe("highlightEnvelope", () => {

        it("delegates to utils", () => {
            (utils.highlightEnvelope as jest.Mock).mockReturnValue(["x"]);

            const h = createHelpers();
            const result = h.highlightEnvelope([{ kind: "primitive" } as Token]);

            expect(utils.highlightEnvelope).toHaveBeenCalled();
            expect(result).toEqual(["x"]);
        });
    });

    describe("transforms", () => {

        it("object pass forwards ctx and ignoredTokens", () => {
            const h = createHelpers();
            h.transforms.object();

            expect(objectPassMock).toHaveBeenCalledWith(
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

            expect(setPassMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    ctx: expect.any(Object),
                    ignoredTokens: expect.any(Set)
                })
            );
        });

        it("map pass forwards ctx and ignoredTokens", () => {
            const h = createHelpers();
            h.transforms.map();

            expect(mapPassMock).toHaveBeenCalledWith(
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
            const ctx = new ZexiRenderingContext([], {
                spaces: 2,
                maxWidth: Infinity
            });

            const h = createHelpers({ ctx, flags });

            h.forceBlock();

            expect(utils.forceBlock).toHaveBeenCalledTimes(1);
            expect(utils.forceBlock).toHaveBeenCalledWith({
                ctx,
                flags
            });
        });
    });

    describe("resolvePrimitiveOverflow", () => {
        it("delegates primitive overflow resolution", () => {
            const flags = createFlags();
            const ctx = new ZexiRenderingContext([], {
                spaces: 2,
                maxWidth: Infinity
            });

            const h = createHelpers({
                ctx,
                flags,
                mode: "pretty"
            });

            h.resolvePrimitiveOverflow();

            expect(utils.resolvePrimitiveOverflow).toHaveBeenCalledTimes(1);
            expect(utils.resolvePrimitiveOverflow).toHaveBeenCalledWith({
                ctx,
                flags,
                mode: "pretty"
            });
        });

        it("forwards compact mode", () => {
            const flags = createFlags();
            const ctx = new ZexiRenderingContext([], {
                spaces: 2,
                maxWidth: Infinity
            });

            const h = createHelpers({
                ctx,
                flags,
                mode: "compact"
            });

            h.resolvePrimitiveOverflow();

            expect(utils.resolvePrimitiveOverflow).toHaveBeenCalledWith({
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
    mode?: 'compact' | 'pretty',
    flags?: JSONPipelineFlags,
    ignoredTokens?: Token[],
    ctx?: ZexiRenderingContext
}) {
    return new JSONHelpers({
        ctx: options?.ctx ?? new ZexiRenderingContext([], { spaces: 2, maxWidth: Infinity }),
        flags: options?.flags ?? createFlags(),
        ignoredTokens: new Set(options?.ignoredTokens ?? []),
        mode: options?.mode ?? 'compact'
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