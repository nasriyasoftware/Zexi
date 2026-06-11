import ArrayGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/array.node";
import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";

describe("ArrayGraphNode", () => {

    describe("constructor", () => {

        it("creates an empty array graph node", () => {
            const node = new ArrayGraphNode();

            expect(node).toBeInstanceOf(ArrayGraphNode);

            expect(node.name).toBe("Array");
            expect(node.type).toBe("array");
            expect(node.value).toEqual([]);

            // 🔷 identity exists and is stable
            expect(node.id).toBeDefined();
            expect(typeof node.id).toBe("symbol");
        });

        it("generates a unique identity per instance", () => {
            const a = new ArrayGraphNode();
            const b = new ArrayGraphNode();

            expect(a.id).not.toBe(b.id);
        });

    });

    describe("value", () => {

        it("stores child graph nodes in insertion order", () => {
            const node = new ArrayGraphNode();

            const item1 = PrimitiveGraphNode.create(1);
            const item2 = PrimitiveGraphNode.create("hello");
            const item3 = PrimitiveGraphNode.create(true);

            node.add(item1);
            node.add(item2);
            node.add(item3);

            expect(node.value).toHaveLength(3);

            expect(node.value[0]).toBe(item1);
            expect(node.value[1]).toBe(item2);
            expect(node.value[2]).toBe(item3);
        });

        it("preserves exact node references", () => {
            const node = new ArrayGraphNode();

            const child = PrimitiveGraphNode.create("value");

            node.add(child);

            expect(node.value[0]).toBe(child);
        });

        it("supports nested graph structures", () => {
            const parent = new ArrayGraphNode();
            const nested = new ArrayGraphNode();

            nested.add(PrimitiveGraphNode.create(123));

            parent.add(nested);

            expect(parent.value[0]).toBe(nested);

            const nestedNode = parent.value[0] as ArrayGraphNode;

            expect(nestedNode.value).toHaveLength(1);

            expect(
                (nestedNode.value[0] as PrimitiveGraphNode).value
            ).toBe(123);

            // 🔷 identity isolation in nested graph
            expect(parent.id).not.toBe(nestedNode.id);
        });

        it("supports empty nested arrays", () => {
            const parent = new ArrayGraphNode();
            const child = new ArrayGraphNode();

            parent.add(child);

            expect(parent.value[0]).toBe(child);
            expect((parent.value[0] as ArrayGraphNode).value).toEqual([]);

            // 🔷 identity still valid for empty nodes
            expect(child.id).toBeDefined();
            expect(typeof child.id).toBe("symbol");
        });

    });

    describe("add()", () => {

        it("appends items sequentially", () => {
            const node = new ArrayGraphNode();

            node.add(PrimitiveGraphNode.create(1));
            node.add(PrimitiveGraphNode.create(2));
            node.add(PrimitiveGraphNode.create(3));

            const values = node.value.map(
                item => (item as PrimitiveGraphNode).value
            );

            expect(values).toEqual([1, 2, 3]);
        });

        it("allows duplicate primitive values without identity semantics", () => {
            const node = new ArrayGraphNode();

            const item = PrimitiveGraphNode.create("duplicate");

            node.add(item);
            node.add(item);

            expect(node.value).toHaveLength(2);

            // same node instance preserved due to explicit insertion
            expect(node.value[0]).toBe(item);
            expect(node.value[1]).toBe(item);

            // primitive nodes are value-based; identity is irrelevant
            expect((node.value[0] as PrimitiveGraphNode).value).toBe("duplicate");
            expect((node.value[1] as PrimitiveGraphNode).value).toBe("duplicate");

            // no identity guarantees for primitives
            expect(node.value[0]).toEqual(node.value[1]);
        });

    });

    describe("static create()", () => {

        it("creates an ArrayGraphNode instance", () => {
            const node = ArrayGraphNode.create();

            expect(node).toBeInstanceOf(ArrayGraphNode);
        });

        it("creates an empty array node", () => {
            const node = ArrayGraphNode.create();

            expect(node.value).toEqual([]);
            expect(node.type).toBe("array");
            expect(node.name).toBe("Array");

            // 🔷 identity always present on factory creation
            expect(typeof node.id).toBe("symbol");
        });

    });

});