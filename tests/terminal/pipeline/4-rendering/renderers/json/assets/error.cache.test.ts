
import type { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { ErrorStartToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

import ErrorCache, { ERROR_SECTIONS } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/error.cache";
import DataEnvelope from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/data.envelope";
import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";

import _rendering from "../../helpers/helpers";

describe.each(_rendering.tokenizers)(
    "ErrorCache (%s)",
    (_name, tokenize) => {

        // --------------------------------------------------
        // Identity
        // --------------------------------------------------

        it("stores immutable error identity", () => {
            const token = new TOKENS.ErrorStart();

            const cache = createCache(
                tokenize,
                token
            );

            expect(cache.errorId).toBe(token.id);
        });

        // --------------------------------------------------
        // Initial state
        // --------------------------------------------------

        it("starts unsealed", () => {
            const cache = createCache(tokenize);

            expect(cache.isSealed).toBe(false);
        });

        // --------------------------------------------------
        // Section assignment
        // --------------------------------------------------

        it("stores name section", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set("name", "Error");
            }).not.toThrow();
        });

        it("stores message section", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set("message", "target");
            }).not.toThrow();
        });

        it("stores cause section", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set(
                    "cause",
                    tokenize(new Error("cause"))
                );
            }).not.toThrow();
        });

        it("stores stack section", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set("stack", []);
            }).not.toThrow();
        });

        it("supports assigning all sections", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");
            cache.set("message", "target");
            cache.set(
                "cause",
                tokenize(new Error("cause"))
            );
            cache.set("stack", []);
        });

        it("prevents duplicate section assignment", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            expect(() => {
                cache.set("name", "TypeError");
            }).toThrow();
        });

        // --------------------------------------------------
        // Runtime validation
        // --------------------------------------------------

        it("rejects non-string name", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set(
                    "name",
                    123 as any
                );
            }).toThrow();
        });

        it("rejects non-string message", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set(
                    "message",
                    {} as any
                );
            }).toThrow();
        });

        it("rejects non-array cause", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set(
                    "cause",
                    {} as any
                );
            }).toThrow();
        });

        it("rejects non-array stack", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.set(
                    "stack",
                    {} as any
                );
            }).toThrow();
        });

        it("freezes cause token arrays", () => {
            const cache = createCache(tokenize);

            const cause = [
                ...tokenize(
                    new Error("cause")
                )
            ];

            cache.set("cause", cause);

            expect(
                Object.isFrozen(cause)
            ).toBe(true);
        });

        // --------------------------------------------------
        // Generation invariants
        // --------------------------------------------------

        it("requires name before generating tokens", () => {
            const cache = createCache(tokenize);

            expect(() => {
                cache.generateTokens(tokenize);
            }).toThrow();
        });

        it("returns frozen generated tokens", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            const result =
                cache.generateTokens(tokenize);

            expect(
                Object.isFrozen(result)
            ).toBe(true);
        });

        it("returns token output", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            const result =
                cache.generateTokens(tokenize);

            expect(Array.isArray(result))
                .toBe(true);

            expect(result.length)
                .toBeGreaterThan(0);
        });

        it("generates property tokens for error data", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");
            cache.set("message", "target");

            const result = cache.generateTokens(tokenize);

            const kinds = _rendering.extractKinds(result);

            expect(
                kinds.includes("property")
            ).toBe(true);
        });

        it("generates primitive tokens for error values", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");
            cache.set("message", "target");

            const result = cache.generateTokens(tokenize);

            const kinds = _rendering.extractKinds(result);

            expect(
                kinds.includes("primitive")
            ).toBe(true);
        });

        // --------------------------------------------------
        // Cause injection
        // --------------------------------------------------

        it("replaces cause placeholder with cause tokens", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            const causeTokens =
                tokenize(
                    new Error("cause")
                );

            cache.set(
                "cause",
                causeTokens
            );

            const result =
                cache.generateTokens(tokenize);

            expect(
                result.some(
                    t =>
                        t.kind === "primitive" &&
                        (t as any).value === "<cause_placeholder>"
                )
            ).toBe(false);
        });

        it("injects nested error tokens into cause", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            cache.set(
                "cause",
                tokenize(
                    new Error("cause")
                )
            );

            const result = cache.generateTokens(tokenize);

            const kinds = _rendering.extractKinds(result);

            expect(
                kinds.includes("error-start")
            ).toBe(true);
        });

        // --------------------------------------------------
        // Sealing
        // --------------------------------------------------

        it("seals after token generation", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            cache.generateTokens(tokenize);

            expect(cache.isSealed)
                .toBe(true);
        });

        it("prevents mutation after sealing", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            cache.generateTokens(tokenize);

            expect(() => {
                cache.set(
                    "message",
                    "target"
                );
            }).toThrow();
        });

        it("prevents token generation twice", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");

            cache.generateTokens(tokenize);

            expect(() => {
                cache.generateTokens(
                    tokenize
                );
            }).toThrow();
        });

        // --------------------------------------------------
        // Full lifecycle
        // --------------------------------------------------

        it("supports complete lifecycle", () => {
            const cache = createCache(tokenize);

            cache.set("name", "Error");
            cache.set("message", "target");
            cache.set("stack", []);

            const result =
                cache.generateTokens(tokenize);

            expect(
                cache.isSealed
            ).toBe(true);

            expect(
                result.length
            ).toBeGreaterThan(0);
        });
    }
);

// --------------------------------------------------
// Static contract
// --------------------------------------------------

describe("ERROR_SECTIONS", () => {

    it("exposes canonical error sections", () => {
        expect(ERROR_SECTIONS).toEqual([
            "name",
            "message",
            "cause",
            "stack"
        ]);
    });

});

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function createCache(
    tokenizer: (value: unknown) => readonly Token[],
    errorStart?: ErrorStartToken
): ErrorCache {
    const env = new DataEnvelope('error', {})
    const result = env.tokenize(tokenizer);

    return new ErrorCache(
        errorStart ?? new TOKENS.ErrorStart(),
        result
    );
}