import { PrimitiveToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/primitive.token";
import { ANSI } from "../../../../../../src/core/terminal/styling/ansi";

describe("PrimitiveToken (semantic)", () => {

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

describe("PrimitiveToken (ansi integration)", () => {

    it("exposes an AnsiMeta instance", () => {
        const token = new PrimitiveToken("string", "hello");

        expect(token.ansi).toBeDefined();
    });

    it("allows assigning ANSI color via meta", () => {
        const token = new PrimitiveToken("string", "hello");

        token.ansi.assign("color", ANSI.color.fg.normal.red);

        expect(token.ansi.color).toBe(ANSI.color.fg.normal.red);
    });

    it("allows assigning ANSI background color", () => {
        const token = new PrimitiveToken("string", "hello");

        token.ansi.assign("bgColor", ANSI.color.bg.normal.blue);

        expect(token.ansi.bgColor).toBe(ANSI.color.bg.normal.blue);
    });

    it("allows assigning ANSI styles using ANSI constants", () => {
        const token = new PrimitiveToken("string", "hello");

        token.ansi.assign("styles", [
            ANSI.style.bold,
            ANSI.style.italic
        ]);

        expect(token.ansi.styles).toEqual([
            ANSI.style.bold,
            ANSI.style.italic
        ]);
    });
});