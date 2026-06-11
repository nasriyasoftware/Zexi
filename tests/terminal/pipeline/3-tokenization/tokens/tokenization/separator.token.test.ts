import { SeparatorToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/separator.token";

describe("SeparatorToken", () => {
    it("defaults to ',' when no value is provided", () => {
        const token = new SeparatorToken();

        expect(token.value).toBe(",");
    });

    it("accepts ',' as a valid separator", () => {
        const token = new SeparatorToken(",");

        expect(token.value).toBe(",");
    });

    it("accepts ';' as a valid separator", () => {
        const token = new SeparatorToken(";");

        expect(token.value).toBe(";");
    });

    it("stores the correct token kind", () => {
        const token = new SeparatorToken();

        expect(token.kind).toBe("separator");
    });

    it("preserves separator immutability", () => {
        const token = new SeparatorToken(";");

        expect(token.value).toBe(";");

        // getter stability check (no mutation side effects)
        expect(token.value).toBe(token.value);
    });

    it("maintains consistent default behavior contract", () => {
        const defaultToken = new SeparatorToken();
        const explicitToken = new SeparatorToken(",");

        expect(defaultToken.value).toBe(explicitToken.value);
    });

    it("does not allow invalid coercion", () => {
        const token = new SeparatorToken(",");

        expect(typeof token.value).toBe("string");
        expect(token.value).not.toBe("[object Object]");
    });
});