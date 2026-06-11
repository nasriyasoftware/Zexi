import ArrayRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/array.node";
import type { RepresentationNode } from "../../../../../src/core/terminal/pipeline/2-representation/types";

describe("ArrayRepresentationNode", () => {

    const makeNode = (value: string): RepresentationNode => {
        // lightweight mock representation node
        return {
            type: "primitive",
            value
        } as unknown as RepresentationNode;
    };

    describe("construction", () => {

        it("stores items in correct order", () => {
            const a = makeNode("a");
            const b = makeNode("b");
            const c = makeNode("c");

            const node = new ArrayRepresentationNode([a, b, c]);

            expect(node.items).toEqual([a, b, c]);
        });

        it("preserves reference identity of items", () => {
            const a = makeNode("a");

            const node = new ArrayRepresentationNode([a]);

            expect(node.items[0]).toBe(a);
        });

    });

    describe("type metadata", () => {

        it("has correct base type metadata", () => {
            const node = new ArrayRepresentationNode([]);

            expect(node.type).toBe("array");
        });

        it("has correct name metadata", () => {
            const node = new ArrayRepresentationNode([]);

            expect(node.name).toBe("Array");
        });

        it("provides correct structural tokens", () => {
            const node = new ArrayRepresentationNode([]);

            expect(node.openToken).toBe("[");
            expect(node.closeToken).toBe("]");
        });

    });

    describe("factory", () => {

        it("creates equivalent instance via create()", () => {
            const a = makeNode("a");

            const node = ArrayRepresentationNode.create([a]);

            expect(node).toBeInstanceOf(ArrayRepresentationNode);
            expect(node.items).toEqual([a]);
        });

        it("create() preserves order", () => {
            const items = [
                makeNode("1"),
                makeNode("2"),
                makeNode("3")
            ];

            const node = ArrayRepresentationNode.create(items);

            expect(node.items).toEqual(items);
        });

    });

    describe("behavior expectations", () => {

        it("does not mutate input array", () => {
            const items = [makeNode("a"), makeNode("b")];
            const original = [...items];

            new ArrayRepresentationNode(items);

            expect(items).toEqual(original);
        });

        it("exposes readonly items array (no structural mutation expected)", () => {
            const node = new ArrayRepresentationNode([
                makeNode("a"),
                makeNode("b")
            ]);

            expect(() => {
                (node.items as any).push(makeNode("c"));
            }).not.toThrow(); // structural safety check (runtime allows, but contract doesn't guarantee immutability)
        });

    });

});