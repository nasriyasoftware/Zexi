import { IndentStart } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/indent";

describe("IndentStart", () => {
    it("creates a token with kind 'indent-start'", () => {
        const token = new IndentStart();

        expect(token.kind).toBe("indent-start");
    });

    it("is stateless and has no payload", () => {
        const token = new IndentStart();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances", () => {
        const a = new IndentStart();
        const b = new IndentStart();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value or formatting properties", () => {
        const token = new IndentStart();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });
});