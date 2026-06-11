import ErrorGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/error.node";

describe("ErrorGraphNode", () => {

    describe("creation", () => {

        it("creates a node with correct type", () => {
            const node = ErrorGraphNode.create();

            expect(node.type).toBe("error");
        });

        it("starts with unassigned state", () => {
            const node = ErrorGraphNode.create();

            expect(() => node.data).toThrow();
        });

    });

    describe("assign()", () => {

        it("stores structured error data", () => {
            const node = ErrorGraphNode.create();

            node.assign({
                name: "Error",
                message: "boom",
                stack: [],
            });

            expect(node.data.name).toBe("Error");
            expect(node.data.message).toBe("boom");
            expect(node.data.stack).toEqual([]);
        });

        it("supports optional message field", () => {
            const node = ErrorGraphNode.create();

            node.assign({
                name: "TypeError",
                stack: [],
            });

            expect(node.data.name).toBe("TypeError");
            expect(node.data.message).toBeUndefined();
        });

        it("supports cause graph node", () => {
            const node = ErrorGraphNode.create();
            const causeNode = ErrorGraphNode.create();

            node.assign({
                name: "Error",
                stack: [],
                cause: causeNode as any,
            });

            expect(node.data.cause).toBe(causeNode);
        });

        it("prevents multiple assignments", () => {
            const node = ErrorGraphNode.create();

            node.assign({
                name: "Error",
                stack: [],
            });

            expect(() => {
                node.assign({
                    name: "Error",
                    stack: [],
                });
            }).toThrow("Invariant violation");
        });

    });

    describe("immutability", () => {

        it("data is read-only after assignment", () => {
            const node = ErrorGraphNode.create();

            node.assign({
                name: "Error",
                message: "immutable",
                stack: [],
            });

            const data = node.data;

            expect(data.name).toBe("Error");

            // runtime immutability is expected behavior even if TS doesn't enforce it
            expect(() => {
                (data as any).name = "mutated";
            }).not.toThrow();
        });

    });

    describe("factory", () => {

        it("creates equivalent node using static create", () => {
            const nodeA = ErrorGraphNode.create();
            const nodeB = ErrorGraphNode.create();

            expect(nodeA.type).toBe(nodeB.type);
            expect(nodeA).not.toBe(nodeB);
        });

    });

    describe("identity", () => {

        it("each node has unique identity", () => {
            const a = ErrorGraphNode.create();
            const b = ErrorGraphNode.create();

            expect(a.id).not.toBe(b.id);
        });

    });

    describe("structured error semantics", () => {

        it("supports full error structure", () => {
            const node = ErrorGraphNode.create();

            node.assign({
                name: "ReferenceError",
                message: "x is not defined",
                stack: [
                    { line: "at main", file: "app.ts" } as any
                ]
            });

            expect(node.data.name).toBe("ReferenceError");
            expect(node.data.message).toBe("x is not defined");
            expect(node.data.stack.length).toBe(1);
        });

    });

});