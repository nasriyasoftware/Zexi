import { AnsiToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/ansi.token";

describe("AnsiToken", () => {
    it("creates a valid ANSI token with code and type", () => {
        const token = new AnsiToken("\x1b[31m", "color");

        expect(token.code).toBe("\x1b[31m");
        expect(token.type).toBe("color");
    });

    it("preserves non-reset ANSI type correctly", () => {
        const token = new AnsiToken("\x1b[1m", "style");

        expect(token.type).toBe("style");
    });

    it("forces reset type when ANSI reset code is used", () => {
        expect(() => new AnsiToken("\x1b[0m", "color" as any)).toThrow(Error);
    });

    it("throws when reset ANSI code is paired with non-reset type", () => {
        expect(() => {
            new AnsiToken("\x1b[0m", "color" as any);
        }).toThrow(
            "Invariant violation: type must be 'reset' when code is '\x1b[0m'"
        );
    });

    it("allows explicit reset type with reset code", () => {
        const token = new AnsiToken("\x1b[0m", "reset");

        expect(token.type).toBe("reset");
        expect(token.code).toBe("\x1b[0m");
    });

    it("exposes code as immutable value", () => {
        const token = new AnsiToken("\x1b[32m", "color");

        expect(token.code).toBe("\x1b[32m");
    });

    it("exposes type as immutable semantic metadata", () => {
        const token = new AnsiToken("\x1b[4m", "style");

        expect(token.type).toBe("style");
    });
});