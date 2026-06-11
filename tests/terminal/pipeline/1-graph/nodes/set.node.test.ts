import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";
import SetGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/set.node";

describe("SetGraphNode", () => {

    describe("construction", () => {

        it("creates an empty set node", () => {
            const node = new SetGraphNode();

            expect(node.type).toBe("set");
            expect(node.name).toBe("Set");
            expect(node.size).toBe(0);
            expect(node.value.size).toBe(0);
        });

    });

    describe("add()", () => {

        it("adds a single element", () => {
            const node = new SetGraphNode();

            const item = PrimitiveGraphNode.create("a");

            node.add(item);

            expect(node.size).toBe(1);
            expect(node.value.has(item)).toBe(true);
        });

        it("adds multiple elements", () => {
            const node = new SetGraphNode();

            const a = PrimitiveGraphNode.create(1);
            const b = PrimitiveGraphNode.create(2);
            const c = PrimitiveGraphNode.create(3);

            node.add(a);
            node.add(b);
            node.add(c);

            expect(node.size).toBe(3);
            expect(node.value.has(a)).toBe(true);
            expect(node.value.has(b)).toBe(true);
            expect(node.value.has(c)).toBe(true);
        });

        it("prevents duplicate references (Set behavior)", () => {
            const node = new SetGraphNode();

            const item = PrimitiveGraphNode.create("dup");

            node.add(item);
            node.add(item);
            node.add(item);

            expect(node.size).toBe(1);
        });

    });

    describe("value integrity", () => {

        it("returns the same Set instance", () => {
            const node = new SetGraphNode();

            const ref1 = node.value;
            const ref2 = node.value;

            expect(ref1).toBe(ref2);
        });

        it("reflects mutations immediately", () => {
            const node = new SetGraphNode();

            expect(node.size).toBe(0);

            node.add(PrimitiveGraphNode.create("x"));

            expect(node.size).toBe(1);
        });

    });

    describe("GraphNode compatibility", () => {

        it("accepts nested graph nodes", () => {
            const node = new SetGraphNode();

            const child = new SetGraphNode();

            node.add(child);

            expect(node.size).toBe(1);
            expect(node.value.has(child)).toBe(true);
        });

        it("supports heterogeneous node types", () => {
            const node = new SetGraphNode();

            const primitive = PrimitiveGraphNode.create(123);
            const text = PrimitiveGraphNode.create("text");

            node.add(primitive);
            node.add(text);

            expect(node.size).toBe(2);
        });

    });

});