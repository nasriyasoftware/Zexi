import { ErrorDataToken, ErrorStartToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("ErrorDataToken", () => {
    it("creates a token with kind 'error-data'", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();
        const token = new ErrorDataToken(start, error.name, error.message);

        expect(token.kind).toBe("error-data");
        expect(token.name).toBe(error.name);
        expect(token.message).toBe(error.message);
        expect(token.errorId).toBe(start.id);
    });

    it("supports undefined message when not provided", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();
        const token = new ErrorDataToken(start, error.name);

        expect(token.name).toBe(error.name);
        expect(token.message).toBeUndefined();
        expect(token.errorId).toBe(start.id);
    });

    it("binds token to error scope id from ErrorStartToken", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();
        const token = new ErrorDataToken(start, error.name, error.message);

        expect(token.errorId).toBe(start.id);
    });

    it("preserves immutability of internal state", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();
        const token = new ErrorDataToken(start, error.name, error.message);

        expect(() => ((token as any).name = "foor")).toThrow(TypeError);
        expect(() => ((token as any).message = "bar")).toThrow(TypeError);
    });

    it("does not expose value or formatting properties", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();
        const token = new ErrorDataToken(start, error.name, error.message);

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });

    it("creates independent instances", () => {
        const error = new Error("boom");
        const start = new ErrorStartToken();

        const a = new ErrorDataToken(start, error.name, error.message);
        const b = new ErrorDataToken(start, error.name, error.message);

        expect(a).not.toBe(b);
        expect(a.name).toBe(b.name);
        expect(a.message).toBe(b.message);
        expect(a.errorId).toBe(start.id);
    });
});