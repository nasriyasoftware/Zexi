import { ErrorCauseStartToken, ErrorStartToken } from "../../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("ErrorCauseStartToken", () => {
    it("creates a token with kind 'error-cause-start'", () => {
        const errToken = new ErrorStartToken();
        const token = new ErrorCauseStartToken(errToken);

        expect(token.kind).toBe("error-cause-start");
        expect(token.errorId).toBe(errToken.id);
    });

    it("exposes a unique cause id per instance", () => {
        const errToken = new ErrorStartToken();

        const a = new ErrorCauseStartToken(errToken);
        const b = new ErrorCauseStartToken(errToken);

        expect(typeof a.id).toBe("symbol");
        expect(a.id).not.toBe(b.id);
    });

    it("binds multiple cause tokens to same error scope", () => {
        const errToken = new ErrorStartToken();

        const a = new ErrorCauseStartToken(errToken);
        const b = new ErrorCauseStartToken(errToken);

        expect(a.errorId).toBe(errToken.id);
        expect(b.errorId).toBe(errToken.id);
        expect(a.errorId).toBe(b.errorId);
    });

    it("does not expose internal fields", () => {
        const errToken = new ErrorStartToken();
        const token = new ErrorCauseStartToken(errToken);

        expect((token as any)._id).toBeUndefined();
        expect((token as any).errorId).toBeDefined();
    });

    it("creates independent instances", () => {
        const errToken = new ErrorStartToken();

        const a = new ErrorCauseStartToken(errToken);
        const b = new ErrorCauseStartToken(errToken);

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });
});