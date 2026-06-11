import PrimitiveRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/primitive.node";
import SetRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/set.node";

describe("SetRepresentationNode", () => {

    const node = (value: unknown) =>
        new PrimitiveRepresentationNode(typeof value as any, value as any);

    describe("construction", () => {

        it("stores items correctly", () => {
            const a = node(1);
            const b = node(2);

            const set = new SetRepresentationNode([a, b]);

            expect(set.items).toEqual([a, b]);
            expect(set.items[0]).toBe(a);
            expect(set.items[1]).toBe(b);
        });

        it("preserves reference to items array (no cloning)", () => {
            const items = [node("x")];

            const set = new SetRepresentationNode(items);

            expect(set.items).toBe(items);
        });

    });

    describe("factory", () => {

        it("creates instance via create()", () => {
            const a = node("a");
            const b = node("b");

            const set = SetRepresentationNode.create([a, b]);

            expect(set).toBeInstanceOf(SetRepresentationNode);
            expect(set.items).toEqual([a, b]);
        });

    });

    describe("type semantics", () => {

        it("has correct type", () => {
            const set = SetRepresentationNode.create([]);

            expect(set.type).toBe("set");
        });

        it("has correct name", () => {
            const set = SetRepresentationNode.create([]);

            expect(set.name).toBe("Set");
        });

        it("inherits correct open/close tokens", () => {
            const set = SetRepresentationNode.create([]);

            expect(set.openToken).toBe("(");
            expect(set.closeToken).toBe(")");
        });

    });

    describe("behavior", () => {

        it("supports multiple items", () => {
            const set = SetRepresentationNode.create([
                node(1),
                node(2),
                node(3)
            ]);

            expect(set.items.length).toBe(3);
        });

        it("reflects external array mutations (reference behavior)", () => {
            const items = [node("a")];

            const set = SetRepresentationNode.create(items);

            items.push(node("b"));

            expect(set.items.length).toBe(2);
        });

    });

});