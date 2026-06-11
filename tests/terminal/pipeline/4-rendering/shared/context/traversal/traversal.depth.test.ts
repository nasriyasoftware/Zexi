import TraversalDepth from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";

describe("TraversalDepth (deterministic)", () => {

    describe("initial state", () => {

        it("starts at depth 0", () => {
            const depth = new TraversalDepth();

            expect(depth.value).toBe(0);
        });
    });

    describe("increase()", () => {

        it("increments depth by 1", () => {
            const depth = new TraversalDepth();

            depth.increase();

            expect(depth.value).toBe(1);
        });

        it("supports multiple nested increases", () => {
            const depth = new TraversalDepth();

            depth.increase();
            depth.increase();
            depth.increase();

            expect(depth.value).toBe(3);
        });

        it("reflects correct nested progression", () => {
            const depth = new TraversalDepth();

            expect(depth.value).toBe(0);

            depth.increase();
            expect(depth.value).toBe(1);

            depth.increase();
            expect(depth.value).toBe(2);
        });
    });

    describe("decrease()", () => {

        it("decrements depth by 1", () => {
            const depth = new TraversalDepth();

            depth.increase();
            depth.increase();

            depth.decrease();

            expect(depth.value).toBe(1);
        });

        it("supports full return to zero", () => {
            const depth = new TraversalDepth();

            depth.increase();
            depth.increase();

            depth.decrease();
            depth.decrease();

            expect(depth.value).toBe(0);
        });

        it("throws when decreasing below zero", () => {
            const depth = new TraversalDepth();

            expect(() => depth.decrease()).toThrow(
                "Invariant violation: cannot decrease depth below zero"
            );
        });

        it("preserves state after failed decrease", () => {
            const depth = new TraversalDepth();

            try {
                depth.decrease();
            } catch { }

            expect(depth.value).toBe(0);
        });
    });

    describe("state consistency", () => {

        it("maintains correct LIFO-style nesting behavior", () => {
            const depth = new TraversalDepth();

            depth.increase(); // 1
            depth.increase(); // 2
            depth.decrease(); // 1
            depth.increase(); // 2
            depth.decrease(); // 1

            expect(depth.value).toBe(1);
        });

        it("supports deep nesting without corruption", () => {
            const depth = new TraversalDepth();

            for (let i = 0; i < 100; i++) {
                depth.increase();
            }

            expect(depth.value).toBe(100);

            for (let i = 0; i < 100; i++) {
                depth.decrease();
            }

            expect(depth.value).toBe(0);
        });
    });
});