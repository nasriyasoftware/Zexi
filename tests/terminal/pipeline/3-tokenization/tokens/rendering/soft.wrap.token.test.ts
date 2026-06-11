import { SoftWrapToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/soft.wrap.token";

describe("SoftWrapToken", () => {
    it("creates a soft-wrap token with correct name", () => {
        const token = new SoftWrapToken();

        expect(token.kind).toBe("soft-wrap");
    });

    it("is a distinct instance each time", () => {
        const a = new SoftWrapToken();
        const b = new SoftWrapToken();

        expect(a).not.toBe(b);
    });

    it("has no runtime properties beyond base token identity", () => {
        const token = new SoftWrapToken();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("behaves as a structural marker token", () => {
        const token = new SoftWrapToken();

        // soft-wrap tokens should not carry value semantics
        expect(token).toBeInstanceOf(SoftWrapToken);
        expect(token.kind).toBe("soft-wrap");
    });
});