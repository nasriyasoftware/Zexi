import { HardSpaceToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/space";

describe("HardSpaceToken", () => {
    it("creates a token with kind 'hard-space'", () => {
        const token = new HardSpaceToken();

        expect(token.kind).toBe("hard-space");
    });

    it("has no mutable state", () => {
        const token = new HardSpaceToken();

        // HardSpaceToken is a structural marker, so it should expose nothing dynamic
        expect(Object.keys(token)).toHaveLength(0);
    });

    it("creates independent instances", () => {
        const t1 = new HardSpaceToken();
        const t2 = new HardSpaceToken();

        expect(t1).not.toBe(t2);
        expect(t1.kind).toBe(t2.kind);
    });

    it("does not expose value or payload properties", () => {
        const token = new HardSpaceToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).text).toBeUndefined();
        expect((token as any).code).toBeUndefined();
    });
});