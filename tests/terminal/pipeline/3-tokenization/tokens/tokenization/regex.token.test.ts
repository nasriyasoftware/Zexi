import { RegExpToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/regex.token";

describe("RegExpToken", () => {
    it("stores the original RegExp instance", () => {
        const regex = /abc/gi;

        const token = new RegExpToken(regex);

        expect(token.value).toBe(regex);
    });

    it("preserves RegExp identity (no cloning)", () => {
        const regex = new RegExp("test", "m");

        const token = new RegExpToken(regex);

        expect(token.value).toBe(regex);
    });

    it("exposes a valid RegExp instance", () => {
        const token = new RegExpToken(/hello/);

        expect(token.value).toBeInstanceOf(RegExp);
    });

    it("preserves regex flags correctly", () => {
        const regex = /world/gi;

        const token = new RegExpToken(regex);

        expect(token.value.flags).toBe("gi");
    });

    it("preserves regex source pattern", () => {
        const regex = /abc123/;

        const token = new RegExpToken(regex);

        expect(token.value.source).toBe("abc123");
    });

    it("static from() creates a RegExpToken correctly", () => {
        const regex = /from-node/;

        const node = {
            value: regex
        } as any;

        const token = RegExpToken.from(node);

        expect(token).toBeInstanceOf(RegExpToken);
        expect(token.value).toBe(regex);
    });

    it("does not modify regex behavior", () => {
        const regex = new RegExp("^test$", "i");

        const token = new RegExpToken(regex);

        expect(token.value.test("TEST")).toBe(true);
    });

    it("maintains reference stability across tokens", () => {
        const regex = /stable/;

        const t1 = new RegExpToken(regex);
        const t2 = new RegExpToken(regex);

        expect(t1.value).toBe(t2.value);
    });
});