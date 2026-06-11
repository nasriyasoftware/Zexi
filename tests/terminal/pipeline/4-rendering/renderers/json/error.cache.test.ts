import { ErrorStartToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";
import ErrorCache, { ERROR_SECTIONS } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/error.cache";

function createErrorToken(): ErrorStartToken {
    return {
        id: Symbol("error")
    } as any;
}

function createCache() {
    return new ErrorCache(createErrorToken(), []);
}

describe("ErrorCache", () => {

    // --------------------------------------------------
    // Identity
    // --------------------------------------------------

    it("stores immutable error identity", () => {
        const token = createErrorToken();
        const cache = new ErrorCache(token, []);

        expect(cache.errorId).toBe(token.id);
    });

    it("stores closeTokens by reference (no cloning)", () => {
        const trailingTokens: any[] = [];

        const token = createErrorToken();
        const cache = new ErrorCache(token, trailingTokens);

        expect(cache.closeTokens).toBe(trailingTokens);
    });

    // --------------------------------------------------
    // Registration lifecycle
    // --------------------------------------------------

    it("registers a section", () => {
        const cache = createCache();

        cache.track("name", Symbol("name"));

        expect(cache.isRegistered("name")).toBe(true);
    });

    it("prevents duplicate section registration", () => {
        const cache = createCache();

        const id = Symbol("name");

        cache.track("name", id);

        expect(() => {
            cache.track("name", id);
        }).toThrow();
    });

    it("reports unregistered sections as not registered", () => {
        const cache = createCache();

        expect(cache.isRegistered("message")).toBe(false);
    });

    // --------------------------------------------------
    // Consumption semantics
    // --------------------------------------------------

    it("consume returns groupId", () => {
        const cache = createCache();

        const id = Symbol("name");

        cache.track("name", id);

        expect(cache.consume("name")).toBe(id);
    });

    it("marks section as consumed on first consume", () => {
        const cache = createCache();

        cache.track("name", Symbol("name"));

        cache.consume("name");

        expect(cache.isConsumed("name")).toBe(true);
    });

    it("consume is idempotent in effect but not repeated tracking", () => {
        const cache = createCache();

        const id = Symbol("name");

        cache.track("name", id);

        const first = cache.consume("name");
        const second = cache.consume("name");

        expect(first).toBe(id);
        expect(second).toBe(id);
        expect(cache.isConsumed("name")).toBe(true);
    });

    it("isConsumed returns false for untracked sections", () => {
        const cache = createCache();

        expect(cache.isConsumed("stack")).toBe(false);
    });

    // --------------------------------------------------
    // Full lifecycle behavior
    // --------------------------------------------------

    it("tracks and consumes multiple independent sections", () => {
        const cache = createCache();

        const nameId = Symbol("name");
        const msgId = Symbol("message");

        cache.track("name", nameId);
        cache.track("message", msgId);

        expect(cache.consume("name")).toBe(nameId);
        expect(cache.consume("message")).toBe(msgId);

        expect(cache.isConsumed("name")).toBe(true);
        expect(cache.isConsumed("message")).toBe(true);
    });

    it("does not cross-contaminate section state", () => {
        const cache = createCache();

        cache.track("name", Symbol("a"));
        cache.track("message", Symbol("b"));

        cache.consume("name");

        expect(cache.isConsumed("name")).toBe(true);
        expect(cache.isConsumed("message")).toBe(false);
    });

    // --------------------------------------------------
    // ERROR_SECTIONS contract
    // --------------------------------------------------

    it("exposes canonical error sections", () => {
        expect(ERROR_SECTIONS).toEqual([
            "name",
            "message",
            "cause",
            "stack"
        ]);
    });

    it("type system only allows valid sections", () => {
        const cache = createCache();

        // @ts-expect-error invalid section
        expect(() => cache.track("invalid", Symbol("x"))).toThrow();
    });

    // --------------------------------------------------
    // Integration-style invariants
    // --------------------------------------------------

    it("supports full lifecycle pattern (track → consume → query)", () => {
        const cache = createCache();

        const id = Symbol("name");

        cache.track("name", id);

        expect(cache.isRegistered("name")).toBe(true);
        expect(cache.isConsumed("name")).toBe(false);

        expect(cache.consume("name")).toBe(id);

        expect(cache.isConsumed("name")).toBe(true);
    });
});