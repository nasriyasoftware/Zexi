import UnknownGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/unknown.node";

describe("UnknownGraphNode", () => {

    describe("construction", () => {

        it("creates an unknown node with correct metadata", () => {
            const node = new UnknownGraphNode(Symbol("test"));

            expect(node.type).toBe("unknown");
            expect(node.name).toBe("Unknown");
        });

        it("stores the original value", () => {
            const value = { foo: "bar" };

            const node = new UnknownGraphNode(value);

            expect(node.value).toBe(value);
        });

        it("preserves primitive unknown values", () => {
            const node = new UnknownGraphNode(123456);

            expect(node.value).toBe(123456);
        });

    });

    describe("static factory", () => {

        it("creates node via factory method", () => {
            const value = new Date();

            const node = UnknownGraphNode.create(value);

            expect(node).toBeInstanceOf(UnknownGraphNode);
            expect(node.value).toBe(value);
        });

        it("factory preserves reference identity", () => {
            const obj = { a: 1 };

            const node = UnknownGraphNode.create(obj);

            expect(node.value).toBe(obj);
        });

    });

    describe("immutability expectations", () => {

        it("does not expose writable properties", () => {
            const node = new UnknownGraphNode("x");

            // runtime check: no writable fields should exist
            expect(Object.getOwnPropertyDescriptor(node, "value")?.writable).toBeFalsy();
            expect(Object.getOwnPropertyDescriptor(node, "type")?.writable).toBeFalsy();
        });

    });

    describe("edge cases", () => {

        it("handles null", () => {
            const node = new UnknownGraphNode(null);

            expect(node.value).toBeNull();
            expect(node.type).toBe("unknown");
        });

        it("handles undefined", () => {
            const node = new UnknownGraphNode(undefined);

            expect(node.value).toBeUndefined();
        });

        it("handles functions", () => {
            const fn = () => 42;

            const node = new UnknownGraphNode(fn);

            expect(node.value).toBe(fn);
            expect(typeof node.value).toBe("function");
        });

    });

});