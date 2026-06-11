import { SoftLineToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/line";

describe("SoftLineToken", () => {
    it("creates a token with kind 'soft-line'", () => {
        const token = new SoftLineToken();

        expect(token.kind).toBe("soft-line");
    });

    it("is stateless and has no payload", () => {
        const token = new SoftLineToken();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances", () => {
        const a = new SoftLineToken();
        const b = new SoftLineToken();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value or formatting properties", () => {
        const token = new SoftLineToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).text).toBeUndefined();
    });
});