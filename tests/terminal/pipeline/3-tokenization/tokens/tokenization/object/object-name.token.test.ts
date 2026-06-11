import { ObjectNameToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/object";

describe("ObjectNameToken", () => {
    it("stores and exposes a runtime class name", () => {
        const token = new ObjectNameToken("Set");

        expect(token.className).toBe("Set");
    });

    it("returns undefined for 'Record' class name", () => {
        const token = new ObjectNameToken("Record");

        expect(token.className).toBeUndefined();
    });

    it("treats empty string as a valid class name", () => {
        const token = new ObjectNameToken("");

        expect(token.className).toBe("");
    });

    it("preserves kind as 'object-name'", () => {
        const token = new ObjectNameToken("Map");

        expect(token.kind).toBe("object-name");
    });

    it("creates independent instances", () => {
        const a = new ObjectNameToken("Array");
        const b = new ObjectNameToken("Array");

        expect(a).not.toBe(b);
        expect(a.className).toBe(b.className);
    });

    it("does not mutate input name", () => {
        const name = "Date";
        const token = new ObjectNameToken(name);

        expect(token.className).toBe("Date");
        expect(name).toBe("Date");
    });
});