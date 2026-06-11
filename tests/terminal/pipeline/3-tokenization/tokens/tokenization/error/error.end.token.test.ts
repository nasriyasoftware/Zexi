import { ErrorStartToken, ErrorEndToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("ErrorEndToken", () => {
    it("creates a token with kind 'error-end'", () => {
        const start = new ErrorStartToken();
        const token = new ErrorEndToken(start);

        expect(token.kind).toBe("error-end");
    });

    it("stores and exposes the correct error scope id", () => {
        const start = new ErrorStartToken();
        const token = new ErrorEndToken(start);

        expect(token.errorId).toBe(start.id);
    });

    it("does not accept unrelated ids as equal scopes", () => {
        const startA = new ErrorStartToken();
        const startB = new ErrorStartToken();

        const end = new ErrorEndToken(startA);

        expect(end.errorId).not.toBe(startB.id);
        expect(end.errorId).toBe(startA.id);
    });

    it("creates independent instances", () => {
        const start = new ErrorStartToken();

        const a = new ErrorEndToken(start);
        const b = new ErrorEndToken(start);

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
        expect(a.errorId).toBe(b.errorId);
    });

    it("is immutable after construction", () => {
        const start = new ErrorStartToken();
        const token = new ErrorEndToken(start);

        expect(Object.isFrozen(token)).toBe(false); // class not frozen
        expect(token.errorId).toBe(start.id);

        expect(() => {
            (token as any).errorId = Symbol("hack");
        }).toThrow(); // JS class still allows mutation unless frozen
    });

    it("does not expose value or formatting properties", () => {
        const start = new ErrorStartToken();
        const token = new ErrorEndToken(start);

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });

    it("does not leak internal state except scope id", () => {
        const start = new ErrorStartToken();
        const token = new ErrorEndToken(start);

        expect(Object.keys(token)).toHaveLength(0);
    });
});