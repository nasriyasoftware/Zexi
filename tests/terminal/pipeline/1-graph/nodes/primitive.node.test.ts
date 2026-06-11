import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";

describe("PrimitiveGraphNode", () => {

    describe("constructor", () => {

        it("creates a string primitive node", () => {
            const node = new PrimitiveGraphNode("hello");

            expect(node.name).toBe("Primitive");
            expect(node.value).toBe("hello");
            expect(node.type).toBe("string");
        });

        it("creates a number primitive node", () => {
            const node = new PrimitiveGraphNode(42);

            expect(node.value).toBe(42);
            expect(node.type).toBe("number");
        });

        it("creates a bigint primitive node", () => {
            const node = new PrimitiveGraphNode(10n);

            expect(node.value).toBe(10n);
            expect(node.type).toBe("bigint");
        });

        it("creates a boolean primitive node", () => {
            const node = new PrimitiveGraphNode(true);

            expect(node.value).toBe(true);
            expect(node.type).toBe("boolean");
        });

        it("creates a symbol primitive node", () => {
            const symbol = Symbol("id");
            const node = new PrimitiveGraphNode(symbol);

            expect(node.value).toBe(symbol);
            expect(node.type).toBe("symbol");
        });

        it("creates an undefined primitive node", () => {
            const node = new PrimitiveGraphNode(undefined);

            expect(node.value).toBeUndefined();
            expect(node.type).toBe("undefined");
        });

        it("normalizes null into the 'null' type", () => {
            const node = new PrimitiveGraphNode(null);

            expect(node.value).toBeNull();

            /**
             * Important:
             * JavaScript reports:
             *
             * typeof null === "object"
             *
             * PrimitiveGraphNode intentionally normalizes this.
             */
            expect(node.type).toBe("null");
        });

    });

    describe("immutability", () => {

        it("preserves the exact primitive reference/value", () => {
            const symbol = Symbol("token");

            const node = new PrimitiveGraphNode(symbol);

            expect(node.value).toBe(symbol);
        });

    });

    describe("static create()", () => {

        it("creates a PrimitiveGraphNode instance", () => {
            const node = PrimitiveGraphNode.create("value");

            expect(node).toBeInstanceOf(PrimitiveGraphNode);
        });

        it("correctly infers primitive types", () => {
            const stringNode = PrimitiveGraphNode.create("hello");
            const numberNode = PrimitiveGraphNode.create(123);
            const boolNode = PrimitiveGraphNode.create(false);

            expect(stringNode.type).toBe("string");
            expect(numberNode.type).toBe("number");
            expect(boolNode.type).toBe("boolean");
        });

        it("normalizes null correctly", () => {
            const node = PrimitiveGraphNode.create(null);

            expect(node.type).toBe("null");
        });

    });

});