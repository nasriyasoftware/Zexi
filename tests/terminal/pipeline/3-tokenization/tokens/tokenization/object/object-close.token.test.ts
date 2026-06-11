import { ObjectCloseToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/object";

describe("ObjectCloseToken", () => {
    it("stores and exposes the closing delimiter", () => {
        const token = new ObjectCloseToken("}");

        expect(token.token).toBe("}");
    });

    it("accepts different structural closing delimiters", () => {
        const brace = new ObjectCloseToken("}");
        const bracket = new ObjectCloseToken("]");
        const paren = new ObjectCloseToken(")");

        expect(brace.token).toBe("}");
        expect(bracket.token).toBe("]");
        expect(paren.token).toBe(")");
    });

    it("preserves kind as 'object-close'", () => {
        const token = new ObjectCloseToken("}");

        expect(token.kind).toBe("object-close");
    });

    it("does not mutate the provided delimiter string", () => {
        const value = "}";
        const token = new ObjectCloseToken(value);

        expect(token.token).toBe("}");
        expect(value).toBe("}");
    });

    it("creates independent instances", () => {
        const a = new ObjectCloseToken("]");
        const b = new ObjectCloseToken("]");

        expect(a).not.toBe(b);
        expect(a.token).toBe(b.token);
    });
});