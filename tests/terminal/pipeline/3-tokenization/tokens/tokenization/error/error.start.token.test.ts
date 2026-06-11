import { ErrorStartToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("ErrorStartToken", () => {
    it("creates a token with kind 'error-start'", () => {
        const token = new ErrorStartToken();

        expect(token.kind).toBe("error-start");
    });

    it("exposes a unique symbol id", () => {
        const token = new ErrorStartToken();

        expect(token.id).toBeDefined();
        expect(typeof token.id).toBe("symbol");
    });

    it("creates unique ids for every instance", () => {
        const a = new ErrorStartToken();
        const b = new ErrorStartToken();

        expect(a.id).not.toBe(b.id);
    });

    it("creates independent instances", () => {
        const a = new ErrorStartToken();
        const b = new ErrorStartToken();

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose value or formatting properties", () => {
        const token = new ErrorStartToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });

    it("is stateless except for structural scope identity", () => {
        const token = new ErrorStartToken();

        expect(Object.keys(token)).toHaveLength(0);
    });
});