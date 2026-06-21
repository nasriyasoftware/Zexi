import type { PropertyToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/property.token";
import ObjectCache from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/object.cache";

describe("ObjectCache", () => {

    test("stores ignored set by reference", () => {
        const ignored = new Set<PropertyToken>();

        const cache = new ObjectCache(ignored);

        const fakeToken = { kind: "property", value: "a" } as PropertyToken;

        ignored.add(fakeToken);

        expect(cache.isIgnored(fakeToken)).toBe(true);
    });

    test("isIgnored returns true when token is in ignored set", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set([token]));

        expect(cache.isIgnored(token)).toBe(true);
    });

    test("isIgnored returns false when token is not ignored", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        expect(cache.isIgnored(token)).toBe(false);
    });

    test("shouldRemoveTrailing is false by default", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        expect(cache.shouldRemoveTrailing(token)).toBe(false);
    });

    test("shouldRemoveTrailing returns true for registered property", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        cache.suppressTrailingOf(token);

        expect(cache.shouldRemoveTrailing(token)).toBe(true);
    });

    test("shouldRemoveTrailing is identity-based (not structural)", () => {
        const token1 = { kind: "property", value: "a" } as PropertyToken;
        const token2 = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        cache.suppressTrailingOf(token1);

        expect(cache.shouldRemoveTrailing(token2)).toBe(false);
    });

    test("suppressTrailingOf assigns property successfully", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        expect(() => cache.suppressTrailingOf(token)).not.toThrow();

        expect(cache.shouldRemoveTrailing(token)).toBe(true);
    });

    test("suppressTrailingOf assigns property successfully", () => {
        const token = { kind: "property", value: "a" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        expect(() => cache.suppressTrailingOf(token)).not.toThrow();

        expect(cache.shouldRemoveTrailing(token)).toBe(true);
    });

    test("suppressTrailingOf throws if already assigned", () => {
        const token1 = { kind: "property", value: "a" } as PropertyToken;
        const token2 = { kind: "property", value: "b" } as PropertyToken;

        const cache = new ObjectCache(new Set());

        cache.suppressTrailingOf(token1);

        expect(() => cache.suppressTrailingOf(token2)).toThrow(
            "Invariant violation"
        );
    });
});