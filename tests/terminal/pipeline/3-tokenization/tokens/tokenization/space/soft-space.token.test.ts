import { SoftSpaceToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/space";

describe("SoftSpaceToken", () => {
    it("creates a token with kind 'soft-space'", () => {
        const token = new SoftSpaceToken();

        expect(token.kind).toBe("soft-space");
    });

    it("has no runtime payload or state", () => {
        const token = new SoftSpaceToken();

        // SoftSpaceToken is purely a structural hint
        expect(Object.keys(token)).toHaveLength(0);
    });

    it("produces independent instances", () => {
        const a = new SoftSpaceToken();
        const b = new SoftSpaceToken();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value-related properties", () => {
        const token = new SoftSpaceToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).text).toBeUndefined();
        expect((token as any).code).toBeUndefined();
    });
});