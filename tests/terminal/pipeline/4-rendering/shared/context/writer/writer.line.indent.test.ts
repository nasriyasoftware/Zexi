import LineIndent from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/writer/line/indent";

describe("LineIndent", () => {

    describe("initial state", () => {

        it("starts in pending state", () => {
            const indent = new LineIndent();

            expect(indent.status).toBe("pending");
            expect(indent.width).toBe(0);
        });

        it("initial width is always 0 before apply", () => {
            const indent = new LineIndent();

            expect(indent.width).toBe(0);
        });
    });

    describe("apply()", () => {

        it("transitions from pending to applied", () => {
            const indent = new LineIndent();

            indent.apply(4);

            expect(indent.status).toBe("applied");
            expect(indent.width).toBe(4);
        });

        it("stores indentation width after apply", () => {
            const indent = new LineIndent();

            indent.apply(10);

            expect(indent.width).toBe(10);
        });

        it("freezes state after apply", () => {
            const indent = new LineIndent();

            indent.apply(2);

            expect(() => {
                indent.apply(5);
            }).toThrow();
        });

        it("throws if apply is called twice", () => {
            const indent = new LineIndent();

            indent.apply(1);

            expect(() => indent.apply(2)).toThrow();
        });

        it("does not allow re-application from applied state", () => {
            const indent = new LineIndent();

            indent.apply(3);

            expect(indent.status).toBe("applied");
            expect(() => indent.apply(3)).toThrow();
        });
    });

    describe("width behavior", () => {

        it("returns 0 when pending", () => {
            const indent = new LineIndent();

            expect(indent.width).toBe(0);
        });

        it("returns resolved value when applied", () => {
            const indent = new LineIndent();

            indent.apply(7);

            expect(indent.width).toBe(7);
        });

        it("does not change width after being applied", () => {
            const indent = new LineIndent();

            indent.apply(5);

            expect(indent.width).toBe(5);

            // width must remain stable
            expect(indent.width).toBe(5);
        });
    });

    describe("clone()", () => {

        it("clones pending state correctly", () => {
            const indent = new LineIndent();

            const cloned = indent.clone();

            expect(cloned.status).toBe("pending");
            expect(cloned.width).toBe(0);
        });

        it("clones applied state correctly", () => {
            const indent = new LineIndent();

            indent.apply(6);

            const cloned = indent.clone();

            expect(cloned.status).toBe("applied");
            expect(cloned.width).toBe(6);
        });

        it("clone is independent of original", () => {
            const indent = new LineIndent();

            indent.apply(4);

            const cloned = indent.clone();

            expect(cloned.width).toBe(4);

            // original should not affect clone after mutation attempt
            expect(() => indent.apply(10)).toThrow();

            expect(cloned.width).toBe(4);
        });
    });

    describe("constructor hydration", () => {

        it("restores pending state from copy", () => {
            const indent = new LineIndent({
                depthBasedSpaces: 0,
                status: "pending"
            });

            expect(indent.status).toBe("pending");
            expect(indent.width).toBe(0);
        });

        it("restores applied state from copy", () => {
            const indent = new LineIndent({
                depthBasedSpaces: 8,
                status: "applied"
            });

            expect(indent.status).toBe("applied");
            expect(indent.width).toBe(8);
        });

        it("preserves immutability after restored applied state", () => {
            const indent = new LineIndent({
                depthBasedSpaces: 3,
                status: "applied"
            });

            expect(() => indent.apply(5)).toThrow();
        });
    });

    describe("state machine safety", () => {

        it("enforces single transition lifecycle", () => {
            const indent = new LineIndent();

            expect(indent.status).toBe("pending");

            indent.apply(1);

            expect(indent.status).toBe("applied");

            expect(() => indent.apply(2)).toThrow();
        });
    });
});