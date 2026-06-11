import { ObjectOpenToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/object";

describe("ObjectOpenToken", () => {
    it("stores and exposes the opening delimiter", () => {
        const token = new ObjectOpenToken("{");

        expect(token.token).toBe("{");
    });

    it("accepts different structural delimiters", () => {
        const brace = new ObjectOpenToken("{");
        const bracket = new ObjectOpenToken("[");
        const paren = new ObjectOpenToken("(");

        expect(brace.token).toBe("{");
        expect(bracket.token).toBe("[");
        expect(paren.token).toBe("(");
    });

    it("preserves kind as 'object-open'", () => {
        const token = new ObjectOpenToken("{");

        expect(token.kind).toBe("object-open");
    });

    it("does not mutate the provided delimiter string", () => {
        const value = "{";
        const token = new ObjectOpenToken(value);

        expect(token.token).toBe("{");
        expect(value).toBe("{");
    });

    it("creates independent instances", () => {
        const a = new ObjectOpenToken("{");
        const b = new ObjectOpenToken("{");

        expect(a).not.toBe(b);
        expect(a.token).toBe(b.token);
    });
});