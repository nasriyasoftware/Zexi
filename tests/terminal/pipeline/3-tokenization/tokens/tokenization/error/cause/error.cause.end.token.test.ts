import { ErrorCauseEndToken, ErrorCauseStartToken, ErrorStartToken } from "../../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("ErrorCauseEndToken", () => {
    
    it("creates a token with kind 'error-cause-end'", () => {
        const errToken = new ErrorStartToken();
        const start = new ErrorCauseStartToken(errToken);

        const token = new ErrorCauseEndToken(errToken, start);

        expect(token.kind).toBe("error-cause-end");
        expect(token.errorId).toBe(errToken.id);
        expect(token.causeId).toBe(start.id);
    });

    it("correctly binds to the originating error scope", () => {
        const errToken = new ErrorStartToken();
        const start = new ErrorCauseStartToken(errToken);

        const token = new ErrorCauseEndToken(errToken, start);

        expect(token.errorId).toBe(errToken.id);
        expect(token.errorId).toBe(start.errorId);
    });

    it("correctly binds to the cause start token", () => {
        const errToken = new ErrorStartToken();
        const start = new ErrorCauseStartToken(errToken);

        const token = new ErrorCauseEndToken(errToken, start);

        expect(token.causeId).toBe(start.id);
    });

    it("does not expose internal enumerable properties", () => {
        const errToken = new ErrorStartToken();
        const start = new ErrorCauseStartToken(errToken);

        const token = new ErrorCauseEndToken(errToken, start);

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances for different scopes", () => {
        const errA = new ErrorStartToken();
        const errB = new ErrorStartToken();

        const startA = new ErrorCauseStartToken(errA);
        const startB = new ErrorCauseStartToken(errB);

        const a = new ErrorCauseEndToken(errA, startA);
        const b = new ErrorCauseEndToken(errB, startB);

        expect(a).not.toBe(b);
        expect(a.errorId).not.toBe(b.errorId);
        expect(a.causeId).not.toBe(b.causeId);
    });

    it("preserves immutability of identifiers", () => {
        const errToken = new ErrorStartToken();
        const start = new ErrorCauseStartToken(errToken);

        const token = new ErrorCauseEndToken(errToken, start);

        expect(token.errorId).toBe(errToken.id);
        expect(token.causeId).toBe(start.id);

        expect(typeof token.errorId).toBe("symbol");
        expect(typeof token.causeId).toBe("symbol");
    });
});