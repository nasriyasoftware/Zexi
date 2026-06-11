import MapRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/map.node";
import PrimitiveRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/primitive.node";

describe("MapRepresentationNode", () => {

    const node = (v: unknown) =>
        new PrimitiveRepresentationNode(typeof v as any, v as any);

    describe("construction", () => {

        it("stores entries correctly", () => {
            const key = node("key");
            const value = node("value");

            const map = new Map([
                [key, value]
            ]);

            const rep = new MapRepresentationNode(map);

            expect(rep.entries).toBe(map);
            expect(rep.entries.get(key)).toBe(value);
        });

        it("preserves map identity (no cloning)", () => {
            const map = new Map();

            const rep = new MapRepresentationNode(map);

            expect(rep.entries).toBe(map);
        });

    });

    describe("factory", () => {

        it("creates instance via create()", () => {
            const key = node("a");
            const value = node("b");

            const map = new Map([[key, value]]);

            const rep = MapRepresentationNode.create(map);

            expect(rep).toBeInstanceOf(MapRepresentationNode);
            expect(rep.entries.get(key)).toBe(value);
        });

    });

    describe("type semantics", () => {

        it("has correct inherited type metadata", () => {
            const rep = MapRepresentationNode.create(new Map());

            expect(rep.type).toBe("map");
        });

        it("has correct inherited name", () => {
            const rep = MapRepresentationNode.create(new Map());

            expect(rep.name).toBe("Map");
        });

        it("exposes correct open/close tokens", () => {
            const rep = MapRepresentationNode.create(new Map());

            expect(rep.openToken).toBe("(");
            expect(rep.closeToken).toBe(")");
        });

    });

    describe("behavior expectations", () => {

        it("does not mutate original map reference", () => {
            const map = new Map();
            const rep = new MapRepresentationNode(map);

            map.set(node("k"), node("v"));

            expect(rep.entries.size).toBe(1);
        });

        it("allows multiple entries", () => {
            const k1 = node("k1");
            const k2 = node("k2");

            const v1 = node("v1");
            const v2 = node("v2");

            const map = new Map([
                [k1, v1],
                [k2, v2]
            ]);

            const rep = new MapRepresentationNode(map);

            expect(rep.entries.size).toBe(2);
            expect(rep.entries.get(k1)).toBe(v1);
            expect(rep.entries.get(k2)).toBe(v2);
        });

    });

});