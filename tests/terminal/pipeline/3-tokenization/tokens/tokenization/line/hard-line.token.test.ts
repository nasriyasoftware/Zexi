import { HardLineToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/line";

describe("HardLineToken", () => {
    it("creates a token with kind 'hard-line'", () => {
        const token = new HardLineToken();

        expect(token.kind).toBe("hard-line");
    });

    it("is stateless and has no payload", () => {
        const token = new HardLineToken();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances", () => {
        const a = new HardLineToken();
        const b = new HardLineToken();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value or formatting properties", () => {
        const token = new HardLineToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).text).toBeUndefined();
    });
});