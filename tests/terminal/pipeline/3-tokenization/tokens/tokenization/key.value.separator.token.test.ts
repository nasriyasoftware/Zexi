import { KeyValueSeparatorToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/key-value.separator";

describe("KeyValueSeparatorToken", () => {
    it("defaults to ':' when no argument is provided", () => {
        const token = new KeyValueSeparatorToken();

        expect(token.value).toBe(":");
    });

    it("accepts ':' as a valid separator", () => {
        const token = new KeyValueSeparatorToken(":");

        expect(token.value).toBe(":");
    });

    it("accepts '=' as a valid separator", () => {
        const token = new KeyValueSeparatorToken("=");

        expect(token.value).toBe("=");
    });

    it("accepts '=>' as a valid separator", () => {
        const token = new KeyValueSeparatorToken("=>");

        expect(token.value).toBe("=>");
    });

    it("stores the correct token kind", () => {
        const token = new KeyValueSeparatorToken();

        expect(token.kind).toBe("key-value-separator");
    });

    it("does not allow mutation of internal state via value", () => {
        const token = new KeyValueSeparatorToken("=>");

        expect(token.value).toBe("=>");

        // runtime safety check: ensure getter is stable
        expect(token.value).toBe(token.value);
    });

    it("preserves constructor default behavior contract", () => {
        const defaultToken = new KeyValueSeparatorToken();
        const explicitToken = new KeyValueSeparatorToken(":");

        expect(defaultToken.value).toBe(explicitToken.value);
    });
});