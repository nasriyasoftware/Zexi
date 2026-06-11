import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";
import PrimitiveRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/primitive.node";

describe("PrimitiveRepresentationNode", () => {

    describe("construction", () => {

        it("stores type and value correctly", () => {
            const node = new PrimitiveRepresentationNode("string", "hello");

            expect(node.type).toBe("string");
            expect(node.value).toBe("hello");
        });

        it("preserves null values correctly", () => {
            const node = new PrimitiveRepresentationNode("null", null);

            expect(node.type).toBe("null");
            expect(node.value).toBeNull();
        });

        it("preserves boolean values correctly", () => {
            const node = new PrimitiveRepresentationNode("boolean", true);

            expect(node.type).toBe("boolean");
            expect(node.value).toBe(true);
        });

        it("preserves numeric values correctly", () => {
            const node = new PrimitiveRepresentationNode("number", 42);

            expect(node.type).toBe("number");
            expect(node.value).toBe(42);
        });

    });

    describe("from()", () => {

        it("converts string primitive correctly", () => {
            const graphNode = new PrimitiveGraphNode("hello");

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode).toBeInstanceOf(PrimitiveRepresentationNode);
            expect(repNode.type).toBe("string");
            expect(repNode.value).toBe("hello");
        });

        it("converts number primitive correctly", () => {
            const graphNode = new PrimitiveGraphNode(42);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("number");
            expect(repNode.value).toBe(42);
        });

        it("converts boolean primitive correctly", () => {
            const graphNode = new PrimitiveGraphNode(true);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("boolean");
            expect(repNode.value).toBe(true);
        });

        it("converts bigint primitive correctly", () => {
            const graphNode = new PrimitiveGraphNode(10n);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("bigint");
            expect(repNode.value).toBe(10n);
        });

        it("converts symbol primitive correctly", () => {
            const sym = Symbol("test");
            const graphNode = new PrimitiveGraphNode(sym);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("symbol");
            expect(repNode.value).toBe(sym);
        });

        it("converts null correctly", () => {
            const graphNode = new PrimitiveGraphNode(null);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("null");
            expect(repNode.value).toBeNull();
        });

        it("converts undefined correctly", () => {
            const graphNode = new PrimitiveGraphNode(undefined);

            const repNode = PrimitiveRepresentationNode.from(graphNode);

            expect(repNode.type).toBe("undefined");
            expect(repNode.value).toBeUndefined();
        });

    });

    describe("immutability expectations", () => {

        it("does not allow external mutation of value", () => {
            const node = new PrimitiveRepresentationNode("string", "hello");

            expect(() => {
                // @ts-expect-error intentional immutability test
                node.value = "changed"
            }).toThrow(TypeError);
        });

        it("does not allow external mutation of type", () => {
            const node = new PrimitiveRepresentationNode("string", "hello");

            expect(() => {
                // @ts-expect-error intentional immutability test
                node.type = "number";
            }).toThrow(TypeError);
        });

    });

});