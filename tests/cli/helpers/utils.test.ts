import { normalizeName } from "../../../src/core/cli/kernal/utils/utils";

describe("normalizeName", () => {
    it("normalizes case, spaces, leading dashes, and repeated dashes", () => {
        expect(normalizeName("--My--Option")).toBe("my-option");
        expect(normalizeName("   ---FOO---BAR   ")).toBe("foo-bar");
    });

    it("throws for non-string or empty-like input", () => {
        expect(() => normalizeName("")).toThrow("Name must be a non-empty string");
        expect(() => normalizeName(0)).toThrow("Name must be a non-empty string");
        expect(() => normalizeName(undefined)).toThrow("Name must be a non-empty string");
        expect(() => normalizeName("   --   ")).toThrow(RangeError);
    });

    it("throws for invalid character rules", () => {
        expect(() => normalizeName("foo_bar")).toThrow('Only [a-z0-9-] are allowed');
        expect(() => normalizeName("1foo")).toThrow("Must start with a letter");
        expect(() => normalizeName("foo-")).toThrow("Cannot end with '-'");
    });
});