import { PrimitiveToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/primitive.token";

describe("PrimitiveToken", () => {
    it("stores primitive type correctly", () => {
        const token = new PrimitiveToken("string", "hello");

        expect(token.type).toBe("string");
    });

    it("stores raw string values without transformation", () => {
        const token = new PrimitiveToken("string", "hello");

        expect(token.value).toBe("hello");
    });

    it("stores number values correctly", () => {
        const token = new PrimitiveToken("number", 42 as any);

        expect(token.type).toBe("number");
        expect(token.value).toBe(42);
    });

    it("stores boolean values correctly", () => {
        const token = new PrimitiveToken("boolean", true as any);

        expect(token.type).toBe("boolean");
        expect(token.value).toBe(true);
    });

    it("stores null values correctly", () => {
        const token = new PrimitiveToken("null", null as any);

        expect(token.type).toBe("null");
        expect(token.value).toBeNull();
    });

    it("stores undefined values correctly", () => {
        const token = new PrimitiveToken("undefined", undefined as any);

        expect(token.type).toBe("undefined");
        expect(token.value).toBeUndefined();
    });

    it("preserves value identity (no coercion)", () => {
        const obj = { a: 1 };

        const token = new PrimitiveToken("object" as any, obj as any);

        expect(token.value).toBe(obj);
    });

    it("from() correctly bridges representation node to token", () => {
        const node = {
            type: "string",
            value: "world"
        } as any;

        const token = PrimitiveToken.from(node);

        expect(token).toBeInstanceOf(PrimitiveToken);
        expect(token.type).toBe("string");
        expect(token.value).toBe("world");
    });

    it("does not stringify or format values", () => {
        const token = new PrimitiveToken("number", 100 as any);

        expect(typeof token.value).toBe("number");
        expect(token.value).not.toBe("100");
    });
});