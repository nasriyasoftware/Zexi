import { IndentEnd } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/indent";

describe("IndentEnd", () => {
    it("creates a token with kind 'indent-end'", () => {
        const token = new IndentEnd();

        expect(token.kind).toBe("indent-end");
    });

    it("is stateless and has no payload", () => {
        const token = new IndentEnd();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances", () => {
        const a = new IndentEnd();
        const b = new IndentEnd();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value or formatting properties", () => {
        const token = new IndentEnd();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });
});