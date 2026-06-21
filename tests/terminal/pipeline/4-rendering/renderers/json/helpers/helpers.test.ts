import keys from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/keys";
import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import LayoutResolver from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { JSONRendererFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";

import objectPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/object.pass";
import mapPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/map.pass";
import setPass from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/passes/set.pass";

// -----------------------------------------------------
// Mocks (important: we only test delegation behavior)
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

const objectPassMock = objectPass as unknown as jest.Mock;
const setPassMock = setPass as unknown as jest.Mock;
const mapPassMock = mapPass as unknown as jest.Mock;

import _rendering from "../../../helpers/helpers";

/* ------------------------------------------------------------------ */
/* TESTS                                                             */
/* ------------------------------------------------------------------ */
describe("JSONHelpers", () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // -------------------------------------------------
    // isVisibleToken
    // -------------------------------------------------
    describe("isVisibleToken", () => {

        it("filters out symbol primitive", () => {
            const helpers = createHelpers();

            const token = { kind: "primitive", type: "symbol" } as Token;
            expect(helpers.isVisibleToken(token)).toBe(false);
        });

        it("filters out undefined primitive", () => {
            const helpers = createHelpers();

            const token = { kind: "primitive", type: "undefined" } as Token;
            expect(helpers.isVisibleToken(token)).toBe(false);
        });

        it("allows normal primitives", () => {
            const helpers = createHelpers();

            const token = { kind: "primitive", type: "string" } as Token;
            expect(helpers.isVisibleToken(token)).toBe(true);
        });

        it("always allows non-primitives", () => {
            const helpers = createHelpers();

            expect(helpers.isVisibleToken({ kind: "object" } as any)).toBe(true);
            expect(helpers.isVisibleToken({ kind: "array" } as any)).toBe(true);
        });
    });

    // -------------------------------------------------
    // createResolver
    // -------------------------------------------------
    describe("createResolver", () => {

        it("returns LayoutResolver instance", () => {
            const helpers = createHelpers();

            expect(helpers.createResolver()).toBeInstanceOf(LayoutResolver);
        });

        it("resolves inline-safe simple structure", () => {
            const tokens = _rendering.tokenize({ a: 1 }, "json");
            const helpers = createHelpers({ tokens });

            const resolver = helpers.createResolver();
            const start = tokens[0] as any;

            const result = resolver.resolve(start);

            expect(result).toBe("inline");
        });
    });

    // -------------------------------------------------
    // getLayout
    // -------------------------------------------------
    describe("getLayout", () => {

        it("returns null in compact mode", () => {
            const helpers = createHelpers({ mode: "compact" });

            expect(helpers.getLayout()).toBe(null);
        });

        it("returns inline in pretty mode by default", () => {
            const helpers = createHelpers({ mode: "pretty" });

            expect(helpers.getLayout()).toBe("inline");
        });

        it("resolves explicit layout from context", () => {
            const ctx = makeCtx([]);
            const helpers = createHelpers({ mode: "pretty", ctx });

            ctx.data.set(keys.RENDERING_LAYOUT_KEY, "block");

            expect(helpers.getLayout()).toBe("block");
        });

        it("resolves parent layout when requested", () => {
            const ctx = makeCtx([]);
            const helpers = createHelpers({ mode: "pretty", ctx });

            ctx.data.set(keys.RENDERING_LAYOUT_KEY, "block");
            ctx.scopes.begin({ name: 'parent' });

            expect(helpers.getLayout()).toBe("inline");
            expect(helpers.getLayout({ ofParent: true })).toBe("block");
        });
    });

    // -------------------------------------------------
    // abortWriting
    // -------------------------------------------------
    describe("abortWriting", () => {

        it("sets forceNextGroupAsBlock flag and aborts scope", () => {
            const flags = createFlags();
            const ctx = makeCtx([]);
            const helpers = createHelpers({ ctx, flags });

            const abortSpy = jest.spyOn(ctx.scopes, "abort");

            ctx.scopes.begin({ name: 'parent' });
            ctx.data.set("currentGroup", Symbol("g"));

            helpers.abortWriting();

            expect(flags.forceNextGroupAsBlock).toBe(true);
            expect(abortSpy).toHaveBeenCalled();
        });

        it("throws if no current group exists", () => {
            const helpers = createHelpers();

            expect(() => helpers.abortWriting()).toThrow("current group");
        });

        it("throws if root scope is active", () => {
            const ctx = makeCtx([]);
            const helpers = createHelpers({ ctx });

            ctx.data.set("currentGroup", Symbol("g"));
            jest.spyOn(ctx.scopes, "isRoot", "get").mockReturnValue(true);

            expect(() => helpers.abortWriting()).toThrow("root scope");
        });
    });

    // -------------------------------------------------
    // ignoreCurrentGroup
    // -------------------------------------------------
    describe("ignoreCurrentGroup", () => {

        it("sets ignore flag", () => {
            const flags = createFlags();
            const helpers = createHelpers({ flags });

            helpers.ignoreCurrentGroup();

            expect(flags.ignoreCurrentGroup).toBe(true);
        });
    });

    // -------------------------------------------------
    // transforms
    // -------------------------------------------------
    describe("transforms delegation", () => {

        it("calls objectPass with ctx and helpers", () => {
            const helpers = createHelpers();

            helpers.transforms.object();

            expect(objectPassMock).toHaveBeenCalled();
        });

        it("calls setPass with ctx and ignoredTokens", () => {
            const helpers = createHelpers();

            helpers.transforms.set();

            expect(setPassMock).toHaveBeenCalled();
        });

        it("calls mapPass with ctx and ignoredTokens", () => {
            const helpers = createHelpers();

            helpers.transforms.map();

            expect(mapPassMock).toHaveBeenCalled();
        });
    });
});

/* ------------------------------------------------------------------ */
/* Test utilities                                                     */
/* ------------------------------------------------------------------ */
function createHelpers(options?: {
    mode?: 'compact' | 'pretty',
    flags?: JSONRendererFlags,
    ignoredTokens?: Token[],
    ctx?: ZexiRenderingContext
    tokens?: readonly Token[]
}) {
    const mode = options?.mode ?? 'compact';
    const tokens = options?.tokens ?? [];
    const ignoredTokens = new Set(options?.ignoredTokens ?? []);
    const flags = options?.flags ?? createFlags();

    return new JSONHelpers({
        ctx: options?.ctx ?? makeCtx(tokens),
        ignoredTokens,
        flags,
        mode
    });
}

function makeCtx(tokens: readonly Token[]) {
    return new ZexiRenderingContext(tokens, {
        spaces: 2,
        maxWidth: Infinity
    });
}

function createFlags(): JSONRendererFlags {
    return {
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    }
}