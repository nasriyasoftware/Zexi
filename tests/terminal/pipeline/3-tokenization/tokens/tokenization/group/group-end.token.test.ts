import { GroupEndToken, GroupStartToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/group";

describe("GroupEndToken", () => {

    it("creates a token with kind 'group-end'", () => {
        const start = new GroupStartToken();
        const token = new GroupEndToken(start.id);

        expect(token.kind).toBe("group-end");
    });

    it("binds to the provided group id", () => {
        const start = new GroupStartToken();
        const token = new GroupEndToken(start.id);

        expect(token.groupId).toBe(start.id);
    });

    it("matches only its corresponding GroupStartToken id", () => {
        const startA = new GroupStartToken();
        const startB = new GroupStartToken();

        const end = new GroupEndToken(startA.id);

        expect(end.groupId).toBe(startA.id);
        expect(end.groupId).not.toBe(startB.id);
    });

    it("creates independent instances per group", () => {
        const start = new GroupStartToken();

        const a = new GroupEndToken(start.id);
        const b = new GroupEndToken(start.id);

        expect(a).not.toBe(b);
        expect(a.groupId).toBe(b.groupId);
        expect(a.kind).toBe(b.kind);
    });

    it("does not expose unintended runtime properties", () => {
        const start = new GroupStartToken();
        const token = new GroupEndToken(start.id);

        expect((token as any).value).toBeUndefined();
        expect((token as any).token).toBeUndefined();
        expect((token as any).depth).toBeUndefined();
    });
});