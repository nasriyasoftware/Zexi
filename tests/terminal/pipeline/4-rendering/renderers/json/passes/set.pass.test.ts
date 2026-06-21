import _rendering from "../../../helpers/helpers";
import keys from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/keys";

import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";

import type { JSONRendererFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";

describe("setPass (integration)", () => {

    /* -------------------------------------------------------- */
    /* 1. LAYOUT OVERRIDE                                      */
    /* -------------------------------------------------------- */

    it("forces block layout", () => {
        const tokens = tokenize(new Set([1]));

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.set();

        expect(
            ctx.data.get(keys.RENDERING_LAYOUT_KEY)
        ).toBe("block");
    });

    /* -------------------------------------------------------- */
    /* 2. WRAPPER TOKENS                                       */
    /* -------------------------------------------------------- */

    it("ignores structural wrapper tokens", () => {
        const tokens = tokenize(new Set([1]));

        const ignoredTokens = new Set<Token>();

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx, ignoredTokens });

        moveToObjectName(ctx);
        helpers.transforms.set();

        expect(ignoredTokens.size).toBe(3);

        expect(
            Array.from(ignoredTokens).map(t => t.kind)
        ).toEqual([
            "object-open",
            "soft-line",
            "indent-start"
        ]);
    });

    /* -------------------------------------------------------- */
    /* 3. SET SIZE = 1                                         */
    /* -------------------------------------------------------- */

    it("injects envelope with correct size for single-value set", () => {
        const tokens = tokenize(new Set([123]));

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.set();

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            'set',
            1,
            123
        ]);
    });

    /* -------------------------------------------------------- */
    /* 4. SET SIZE = N                                         */
    /* -------------------------------------------------------- */

    it("injects envelope with correct size for multi-value set", () => {
        const tokens = tokenize(
            new Set([1, 2, 3, 4])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.set();

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            'set',
            4,
            1, 2, 3, 4
        ]);
    });

    /* -------------------------------------------------------- */
    /* 5. EMPTY SET                                            */
    /* -------------------------------------------------------- */

    it("injects envelope for empty set", () => {
        const tokens = tokenize(new Set());

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.set();

        const properties = collectProperties(ctx);

        expect(properties.length).toBe(5);
        expect(properties[0]).toBe("$codec");
        expect(properties[1]).toBe("$kind");
        expect(properties[2]).toBe("$payload");
        expect(properties[3]).toBe("size");
        expect(properties[4]).toBe("values");
    });

    /* -------------------------------------------------------- */
    /* 6. SET ENVELOPE SHAPE                                   */
    /* -------------------------------------------------------- */

    it("injects a set envelope", () => {
        const tokens = tokenize(
            new Set([1, 2, 3])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.set();

        const properties = collectProperties(ctx);

        expect(properties.length).toBe(5);
        expect(properties[0]).toBe("$codec");
        expect(properties[1]).toBe("$kind");
        expect(properties[2]).toBe("$payload");
        expect(properties[3]).toBe("size");
        expect(properties[4]).toBe("values");

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            'set',
            3,
            1, 2, 3
        ])
    });

});
/* ------------------------------------------------------------------ */
/* Test utilities                                                     */
/* ------------------------------------------------------------------ */

function collectProperties(ctx: ZexiRenderingContext): string[] {
    const result: string[] = [];

    for (let i = 0; ; i++) {
        const token = ctx.tokens.peek(i);

        if (!token) {
            break;
        }

        if (token.kind === "property") {
            result.push((token as any).value);
        }
    }

    return result;
}

function collectPrimitives(ctx: ZexiRenderingContext): unknown[] {
    const result: unknown[] = [];

    for (let i = 0; ; i++) {
        const token = ctx.tokens.peek(i);

        if (!token) {
            break;
        }

        if (token.kind === "primitive") {
            result.push((token as any).value);
        }
    }

    return result;
}

function tokenize(value: unknown) {
    return _rendering.tokenize(value, 'json');
}

function createHelpers(options?: {
    mode?: 'compact' | 'pretty',
    flags?: JSONRendererFlags,
    ignoredTokens?: Token[] | Set<Token>,
    ctx?: ZexiRenderingContext
    tokens?: readonly Token[]
}) {
    const mode = options?.mode ?? 'compact';
    const tokens = options?.tokens ?? [];
    const flags = options?.flags ?? createFlags();

    const ignoredTokens = (() => {
        if (options?.ignoredTokens instanceof Set) {
            return options?.ignoredTokens;
        }

        return new Set(options?.ignoredTokens ?? []);
    })();

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

function moveToObjectName(ctx: ZexiRenderingContext) {
    ctx.tokens.next();
    ctx.tokens.next();
}