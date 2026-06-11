import { GroupStartToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/group";

describe("GroupStartToken", () => {

    it("creates a token with kind 'group-start'", () => {
        const token = new GroupStartToken();

        expect(token.kind).toBe("group-start");
    });

    it("exposes a symbol id", () => {
        const token = new GroupStartToken();

        expect(token.id).toBeDefined();
        expect(typeof token.id).toBe("symbol");
    });

    it("generates a unique id per instance", () => {
        const group1 = new GroupStartToken();
        const group2 = new GroupStartToken();

        expect(group1.id).not.toBe(group2.id);
    });

    it("is stateless and has no enumerable payload", () => {
        const token = new GroupStartToken();

        expect(Object.keys(token)).toHaveLength(0);
    });

    it("does not expose value or formatting properties", () => {
        const token = new GroupStartToken();

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });
});