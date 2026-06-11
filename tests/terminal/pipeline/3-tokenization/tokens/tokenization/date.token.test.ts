import { DateToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/date.token";

describe("DateToken", () => {
    it("stores the provided Date instance correctly", () => {
        const date = new Date("2024-01-01T00:00:00.000Z");
        const token = new DateToken(date);

        expect(token.value).toBe(date);
    });

    it("preserves exact Date reference (no cloning)", () => {
        const date = new Date();
        const token = new DateToken(date);

        expect(token.value).toBe(date);
    });

    it("exposes a valid Date object", () => {
        const token = new DateToken(new Date());

        expect(token.value).toBeInstanceOf(Date);
    });

    it("from() creates a DateToken from a representation node", () => {
        const date = new Date("2025-05-14T12:00:00.000Z");

        const node = {
            value: date
        } as any; // mocking DateRepresentationNode

        const token = DateToken.from(node);

        expect(token).toBeInstanceOf(DateToken);
        expect(token.value).toBe(date);
    });

    it("from() preserves the original Date value without transformation", () => {
        const date = new Date("2020-10-10T10:10:10.000Z");

        const node = {
            value: date
        } as any;

        const token = DateToken.from(node);

        expect(token.value.toISOString()).toBe(date.toISOString());
    });

    it("token type is correctly set to 'date'", () => {
        const token = new DateToken(new Date());

        expect(token.kind).toBe("date");
    });
});