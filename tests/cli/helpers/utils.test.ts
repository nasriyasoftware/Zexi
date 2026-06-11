import { normalizeName } from "../../../src/core/cli/kernal/utils/utils";
import { hasOwnProp, isRecord, noop } from "../../../src/utils/utils";

describe("noop", () => {
    it("returns undefined", () => {
        expect(noop()).toBeUndefined();
    });
});

describe("isRecord", () => {
    it("returns true for plain objects", () => {
        expect(isRecord({ a: 1 })).toBe(true);
        expect(isRecord(Object.create(Object.prototype))).toBe(true);
    });

    it("returns false for non-record values", () => {
        expect(isRecord(null)).toBe(false);
        expect(isRecord([])).toBe(false);
        expect(isRecord(new Set())).toBe(false);
        expect(isRecord(new Map())).toBe(false);
        expect(isRecord(new Date())).toBe(false);
        expect(isRecord(/abc/)).toBe(false);
        expect(isRecord("x")).toBe(false);
        expect(isRecord(1)).toBe(false);
        expect(isRecord(true)).toBe(false);
        expect(isRecord(() => undefined)).toBe(false);
    });

    it("returns false for objects with custom prototype", () => {
        class A {
            public a = 1;
        }
        expect(isRecord(new A())).toBe(false);
        expect(isRecord(Object.create(null))).toBe(false);
    });
});

describe("hasOwnProp", () => {
    it("returns true when the property is an own property", () => {
        const obj = { foo: 1 };
        expect(hasOwnProp(obj, "foo")).toBe(true);
    });

    it("returns false for inherited properties", () => {
        const proto = { foo: 1 };
        const obj = Object.create(proto) as Record<string, unknown>;
        obj.bar = 2;
        expect(hasOwnProp(obj, "foo")).toBe(false);
    });

    it("returns false for missing properties and non-record values", () => {
        expect(hasOwnProp({ foo: 1 }, "bar")).toBe(false);
        expect(hasOwnProp([] as unknown as Record<string, unknown>, "length")).toBe(false);
    });
});

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