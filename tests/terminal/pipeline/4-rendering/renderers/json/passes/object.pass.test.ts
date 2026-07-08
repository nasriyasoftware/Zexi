import keys from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/keys";

import JSONTokenizer from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import ObjectCache from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/object.cache";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";

import type { PropertyToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/property.token";
import type { JSONPipelineFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";


describe("objectPass (integration)", () => {

    /* -------------------------------------------------------- */
    /* 1. EMPTY OBJECT                                         */
    /* -------------------------------------------------------- */

    it("collapses empty object into '{}'", () => {
        const tokens = tokenize({});
        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });
        
        const peekSpy = jest.spyOn(ctx.tokens, 'peek')

        helpers.transforms.object();

        expect(peekSpy).toHaveBeenCalledWith(2);
        expect(peekSpy).toHaveBeenCalledWith(5);
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

        const peekSpy = jest.spyOn(ctx.tokens, 'peek')

        ctx.scopes.begin();
        ctx.data.set(keys.GROUP, Symbol('x'));

        helpers.transforms.object();

        expect(peekSpy).toHaveBeenCalledWith(2);
        expect(peekSpy).toHaveBeenCalledWith(5);
    });


    /* -------------------------------------------------------- */
    /* 3. CACHE INITIALIZATION                                 */
    /* -------------------------------------------------------- */

    it("stores ObjectCache in rendering context", () => {
        const tokens = tokenize({ a: 1 });
        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        helpers.transforms.object();

        const cache = ctx.data.get<ObjectCache>(keys.OBJECT_CACHE);

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

        const cache = ctx.data.get<ObjectCache>(keys.OBJECT_CACHE);

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
    return JSONTokenizer(value);
}

function createHelpers(options?: {
    mode?: 'compact' | 'pretty',
    flags?: JSONPipelineFlags,
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

function createFlags(): JSONPipelineFlags {
    return {
        ansiEnabled: false,
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    }
}