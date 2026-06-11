import DataEnvelope from "../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/data.envelope";

// Mock Token kind
type MockKind = "primitive" | "regex" | "function";

describe("DataEnvelope", () => {
    // --------------------------------------------------
    // Construction basics
    // --------------------------------------------------

    it("creates a valid envelope with correct kind", () => {
        const env = new DataEnvelope<MockKind, { value: number }>(
            "primitive",
            { value: 42 }
        );

        const result = env.toObject();

        expect(result.$kind).toBe("primitive");
    });

    it("generates a stable codec string", () => {
        const env = new DataEnvelope<MockKind, {}>(
            "regex",
            {}
        );

        const result = env.toObject();

        expect(result.$codec).toMatch(/^zexi@\d+\.\d+$/);
    });

    // --------------------------------------------------
    // Payload handling
    // --------------------------------------------------

    it("preserves valid object payload", () => {
        const payload = { a: 1, b: 2 };

        const env = new DataEnvelope<MockKind, typeof payload>(
            "primitive",
            payload
        );

        const result = env.toObject();

        expect(result.$payload).toEqual(payload);
    });

    it("replaces non-object payload with empty object", () => {
        // @ts-expect-error intentional invalid payload
        const env = new DataEnvelope("primitive", null);

        const result = env.toObject();

        expect(result.$payload).toEqual({});
    });

    it("replaces array payload with empty object if not considered record", () => {
        const env = new DataEnvelope<MockKind, any>(
            "primitive",
            [1, 2, 3]
        );

        const result = env.toObject();

        expect(result.$payload).toEqual({});
    });

    // --------------------------------------------------
    // Immutability guarantees
    // --------------------------------------------------

    it("freezes payload object", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "primitive",
            { x: 1 }
        );

        const result = env.toObject();

        expect(Object.isFrozen(result.$payload)).toBe(true);
    });

    it("returns frozen envelope", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "primitive",
            { x: 1 }
        );

        const result = env.toObject();

        expect(Object.isFrozen(result)).toBe(true);
    });

    it("prevents mutation of payload fields", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "primitive",
            { x: 1 }
        );

        const result = env.toObject();

        expect(() => {
            // @ts-expect-error runtime mutation test
            result.$payload.x = 99;
        }).toThrow();
    });

    // --------------------------------------------------
    // toObject consistency
    // --------------------------------------------------

    it("returns same envelope reference on multiple calls", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "primitive",
            { x: 1 }
        );

        const a = env.toObject();
        const b = env.toObject();

        expect(a).toBe(b);
    });

    it("toObject is computed once at construction time", () => {
        const payload = { x: 1 };

        const env = new DataEnvelope<MockKind, typeof payload>(
            "primitive",
            payload
        );

        const snap = env.toObject();

        expect(snap.$payload).toBe(payload);
    });

    // --------------------------------------------------
    // JSON serialization
    // --------------------------------------------------

    it("serializes correctly via JSON.stringify", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "regex",
            { x: 10 }
        );

        const json = JSON.stringify(env.toObject());

        const parsed = JSON.parse(json);

        expect(parsed.$kind).toBe("regex");
        expect(parsed.$payload.x).toBe(10);
        expect(typeof parsed.$codec).toBe("string");
    });

    // --------------------------------------------------
    // Edge cases
    // --------------------------------------------------

    it("handles empty payload object", () => {
        const env = new DataEnvelope<MockKind, {}>(
            "function",
            {}
        );

        const result = env.toObject();

        expect(result.$payload).toEqual({});
    });

    it("handles missing stable version gracefully (runtime safety)", () => {
        const env = new DataEnvelope<MockKind, { x: number }>(
            "primitive",
            { x: 1 }
        );

        const result = env.toObject();

        expect(result.$codec.startsWith("zexi@")).toBe(true);
    });
});