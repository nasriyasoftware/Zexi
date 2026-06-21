import _rendering from "../../../helpers/helpers";
import keys from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/keys";

import ObjectCache from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/object.cache";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";

import type { PropertyToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/property.token";
import type { JSONRendererFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";


describe("objectPass (integration)", () => {

    /* -------------------------------------------------------- */
    /* 1. EMPTY OBJECT                                         */
    /* -------------------------------------------------------- */

    it("collapses empty object into '{}'", () => {
        const tokens = tokenize({});
        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        const writeSpy = jest.spyOn(ctx.writer, "write");
        const ignoreSpy = jest.spyOn(helpers, "ignoreCurrentGroup");

        helpers.transforms.object();

        expect(writeSpy).toHaveBeenCalledWith("{}");
        expect(ignoreSpy).toHaveBeenCalled();
    });


    /* -------------------------------------------------------- */
    /* 2. ALL PROPERTIES IGNORED                               */
    /* -------------------------------------------------------- */

    it("collapses object when all properties are non-renderable", () => {
        const tokens = tokenize({
            a: Symbol("x"),
            b: undefined
        });

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        const writeSpy = jest.spyOn(ctx.writer, "write");
        const ignoreSpy = jest.spyOn(helpers, "ignoreCurrentGroup");

        helpers.transforms.object();

        expect(writeSpy).toHaveBeenCalledWith("{}");
        expect(ignoreSpy).toHaveBeenCalled();
    });


    /* -------------------------------------------------------- */
    /* 3. CACHE INITIALIZATION                                 */
    /* -------------------------------------------------------- */

    it("stores ObjectCache in rendering context", () => {
        const tokens = tokenize({ a: 1 });
        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        helpers.transforms.object();

        const cache = ctx.data.get<ObjectCache>(keys.OBJECT_CACHE_KEY);

        expect(cache).toBeDefined();
        expect(cache).toBeInstanceOf(ObjectCache);
    });


    /* -------------------------------------------------------- */
    /* 4. TRAILING SEPARATOR OPTIMIZATION                      */
    /* -------------------------------------------------------- */

    it("registers trailing suppression for last ignored property", () => {
        const tokens = tokenize({
            a: 1,
            b: undefined
        });

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        helpers.transforms.object();

        const cache = ctx.data.get<ObjectCache>(keys.OBJECT_CACHE_KEY);

        expect(cache).toBeDefined();
        expect(cache).toBeInstanceOf(ObjectCache);

        const prop = tokens.find((t): t is PropertyToken => t.kind === "property" && t.value === "b")!;

        expect(prop.kind).toBe("property");
        expect(prop.value).toBe("b");
        expect(cache!.isIgnored(prop)).toBe(true);
    });


    /* -------------------------------------------------------- */
    /* 5. NORMAL OBJECT BEHAVIOR                               */
    /* -------------------------------------------------------- */

    it("does not collapse valid objects", () => {
        const tokens = tokenize({
            a: 1,
            b: 2
        });

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        const writeSpy = jest.spyOn(ctx.writer, "write");

        helpers.transforms.object();

        expect(writeSpy).not.toHaveBeenCalledWith("{}");
    });

});

/* ------------------------------------------------------------------ */
/* Test utilities                                                     */
/* ------------------------------------------------------------------ */
function tokenize(value: unknown) {
    return _rendering.tokenize(value, 'json');
}

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