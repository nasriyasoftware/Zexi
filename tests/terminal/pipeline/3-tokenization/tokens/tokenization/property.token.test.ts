import { PropertyToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/property.token";

describe("PropertyToken", () => {
    it("stores property name correctly", () => {
        const token = new PropertyToken("name", "property" as any);

        expect(token.value).toBe("name");
    });

    it("stores property kind correctly", () => {
        const token = new PropertyToken("age", "property" as any);

        expect(token.type).toBe("property");
    });

    it("distinguishes between different property kinds", () => {
        const dataToken = new PropertyToken("a", "property" as any);
        const methodToken = new PropertyToken("b", "method" as any);
        const getterToken = new PropertyToken("c", "getter" as any);
        const setterToken = new PropertyToken("d", "setter" as any);

        expect(dataToken.type).toBe("property");
        expect(methodToken.type).toBe("method");
        expect(getterToken.type).toBe("getter");
        expect(setterToken.type).toBe("setter");
    });

    it("preserves property name identity", () => {
        const token = new PropertyToken("userId", "property" as any);

        expect(token.value).toBe("userId");
    });

    it("from() correctly maps PropertyNode to PropertyToken", () => {
        const node = {
            name: "email",
            kind: "property"
        } as any;

        const token = PropertyToken.from(node);

        expect(token).toBeInstanceOf(PropertyToken);
        expect(token.value).toBe("email");
        expect(token.type).toBe("property");
    });

    it("does not mutate or transform property name", () => {
        const token = new PropertyToken("someKey", "property" as any);

        expect(token.value).not.toBe("[object Object]");
        expect(typeof token.value).toBe("string");
    });

    it("maintains semantic separation between value and kind", () => {
        const token = new PropertyToken("x", "method" as any);

        expect(token.value).toBe("x");
        expect(token.type).toBe("method");
        expect(token.value).not.toBe(token.type);
    });
});