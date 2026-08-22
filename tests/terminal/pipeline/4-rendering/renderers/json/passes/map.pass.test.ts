import JSONTokenizer from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import JSONHelpers from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/helpers";
import ZexiRenderingContext from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";

import type { JSONPipelineFlags } from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";

describe("mapPass (integration)", () => {

    /* -------------------------------------------------------- */
    /* 1. WRAPPER TOKENS                                       */
    /* -------------------------------------------------------- */

    it("ignores structural wrapper tokens", () => {
        const tokens = tokenize(
            new Map([["a", 1]])
        );

        const ignoredTokens = new Set<Token>();

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({
            ctx,
            ignoredTokens
        });

        moveToObjectName(ctx);
        helpers.transforms.map();

        expect(
            Array.from(ignoredTokens)
                .slice(0, 3)
                .map(t => t.kind)
        ).toEqual([
            "object-open",
            "soft-line",
            "indent-start"
        ]);
    });

    /* -------------------------------------------------------- */
    /* 2. MAP SIZE = 1                                         */
    /* -------------------------------------------------------- */

    it("injects envelope with correct size for single-entry map", () => {
        const tokens = tokenize(
            new Map([
                ["a", 1]
            ])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.map();

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            "map",
            'a', 1, // from { key: 'a', value: 1 }
            'a', 1, // From the map's original tokens
            1
        ]);
    });

    /* -------------------------------------------------------- */
    /* 3. MAP SIZE = N                                         */
    /* -------------------------------------------------------- */

    it("injects envelope with correct size for multi-entry map", () => {
        const tokens = tokenize(
            new Map([
                ["a", 1],
                ["b", 2],
                ["c", 3]
            ])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.map();

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            "map",
            // Injected entries as { key: <char>, value: <int> }
            "a", 1,
            "b", 2,
            "c", 3,
            // From the map's original tokens
            "a", 1,
            "b", 2,
            "c", 3,
            // The size of the map
            3
        ]);
    });

    /* -------------------------------------------------------- */
    /* 4. EMPTY MAP                                            */
    /* -------------------------------------------------------- */

    it("injects envelope for empty map", () => {
        const tokens = tokenize(
            new Map()
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.map();

        const properties = collectProperties(ctx);
        expect(properties).toEqual([
            "$codec",
            "$kind",
            "$payload",
            "entries",
            "size"
        ]);
    });

    /* -------------------------------------------------------- */
    /* 5. MAP ENVELOPE SHAPE                                   */
    /* -------------------------------------------------------- */

    it("injects a map envelope", () => {
        const tokens = tokenize(
            new Map([
                ["x", 10],
                ["y", 20]
            ])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.map();

        const properties = collectProperties(ctx);
        expect(properties).toEqual([
            "$codec",
            "$kind",
            "$payload",
            "entries",

            // The first entry
            "key", "value",

            // The second entry
            "key", "value",

            "size"
        ]);

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            "map",
            // Injected entries as { key: <char>, value: <int> }
            "x", 10,
            "y", 20,
            // From the map's original tokens
            "x", 10,
            "y", 20,
            // The size of the map
            2
        ]);
    });

    /* -------------------------------------------------------- */
    /* 6. PRESERVES COMPLEX KEYS                               */
    /* -------------------------------------------------------- */

    it("preserves object keys inside entry frames", () => {
        const key = { id: 1 };

        const tokens = tokenize(
            new Map([
                [key, "value"]
            ])
        );

        const ctx = makeCtx(tokens);
        const helpers = createHelpers({ ctx });

        moveToObjectName(ctx);
        helpers.transforms.map();

        const properties = collectProperties(ctx);

        expect(properties).toEqual([
            "$codec",
            "$kind",
            "$payload",
            "entries",

            "id", // The property of the object
            "key", "id", "value",

            "size"
        ]);

        const primitives = collectPrimitives(ctx);

        expect(primitives[0]).toMatch(/zexi@[0-9].[0-9]/);
        expect(primitives.slice(1)).toEqual([
            "map",
            // Injected entries as { key: <char>, value: <int> }
            1, 'value',
            // From the map's original tokens
            1, 'value',
            // The size of the map
            1
        ]);
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
    return JSONTokenizer(value);
}

function createHelpers(options?: {
    mode?: 'compact' | 'pretty',
    flags?: JSONPipelineFlags,
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

function createFlags(): JSONPipelineFlags {
    return {
        ansiEnabled: false,
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