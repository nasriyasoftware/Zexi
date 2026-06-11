import MapGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/map.node";
import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";

describe("MapGraphNode", () => {

    describe("construction", () => {

        it("creates an empty map node", () => {
            const node = new MapGraphNode();

            expect(node.type).toBe("map");
            expect(node.name).toBe("Map");
            expect(node.size).toBe(0);
            expect(node.value.size).toBe(0);
        });

    });

    describe("add()", () => {

        it("adds a single key-value pair", () => {
            const node = new MapGraphNode();

            const key = PrimitiveGraphNode.create("key");
            const value = PrimitiveGraphNode.create("value");

            node.add(key, value);

            expect(node.size).toBe(1);
            expect(node.value.get(key)).toBe(value);
        });

        it("stores multiple entries correctly", () => {
            const node = new MapGraphNode();

            const k1 = PrimitiveGraphNode.create("a");
            const v1 = PrimitiveGraphNode.create(1);

            const k2 = PrimitiveGraphNode.create("b");
            const v2 = PrimitiveGraphNode.create(2);

            node.add(k1, v1);
            node.add(k2, v2);

            expect(node.size).toBe(2);
            expect(node.value.get(k1)).toBe(v1);
            expect(node.value.get(k2)).toBe(v2);
        });

        it("preserves insertion identity", () => {
            const node = new MapGraphNode();

            const key = PrimitiveGraphNode.create("id");
            const value = PrimitiveGraphNode.create("value");

            node.add(key, value);

            const stored = node.value.get(key);

            expect(stored).toBe(value);
        });

    });

    describe("value integrity", () => {

        it("returns the same internal map reference", () => {
            const node = new MapGraphNode();

            const ref1 = node.value;
            const ref2 = node.value;

            expect(ref1).toBe(ref2);
        });

        it("reflects updates immediately", () => {
            const node = new MapGraphNode();

            expect(node.size).toBe(0);

            node.add(
                PrimitiveGraphNode.create("x"),
                PrimitiveGraphNode.create(10)
            );

            expect(node.size).toBe(1);
        });

    });

    describe("static factory", () => {

        it("creates an empty MapGraphNode", () => {
            const node = MapGraphNode.create();

            expect(node).toBeInstanceOf(MapGraphNode);
            expect(node.size).toBe(0);
            expect(node.type).toBe("map");
        });

    });

    describe("GraphNode compatibility", () => {

        it("accepts nested GraphNodes as keys and values", () => {
            const node = new MapGraphNode();

            const key = new MapGraphNode();
            const value = new MapGraphNode();

            node.add(key, value);

            expect(node.size).toBe(1);
            expect(node.value.get(key)).toBe(value);
        });

        it("supports heterogeneous node types", () => {
            const node = new MapGraphNode();

            const key = PrimitiveGraphNode.create("k");
            const value = PrimitiveGraphNode.create(123);

            node.add(key, value);

            expect((node.value.get(key) as PrimitiveGraphNode)!.value).toBe(123);
        });

    });

});