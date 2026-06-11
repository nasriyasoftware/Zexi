import PropertyNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/assets/property.node";
import ObjectRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/object.node";
import PrimitiveRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/primitive.node";

describe("ObjectRepresentationNode", () => {

    const node = (value: unknown) =>
        new PrimitiveRepresentationNode(typeof value as any, value as any);

    const prop = (name: string, kind: any = "property") =>
        PropertyNode.create(name, kind);

    describe("construction", () => {

        it("stores entries correctly", () => {
            const key = prop("id");
            const value = node(123);

            const map = new Map([[key, value]]);

            const rep = new ObjectRepresentationNode({
                className: "Object",
                type: "object",
                entries: map
            });

            expect(rep.entries).toBe(map);
            expect(rep.entries.get(key)).toBe(value);
        });

        it("preserves className and type metadata", () => {
            const rep = new ObjectRepresentationNode({
                className: "MyClass",
                type: "object",
                entries: new Map()
            });

            expect(rep.name).toBe("MyClass");
            expect(rep.type).toBe("object");
        });

    });

    describe("factory", () => {

        it("creates instance via static create()", () => {
            const key = prop("name");
            const value = node("test");

            const map = new Map([[key, value]]);

            const rep = ObjectRepresentationNode.create({
                className: "Record",
                type: "record",
                entries: map
            });

            expect(rep).toBeInstanceOf(ObjectRepresentationNode);
            expect(rep.entries.get(key)).toBe(value);
            expect(rep.name).toBe("Record");
            expect(rep.type).toBe("record");
        });

    });

    describe("entries behavior", () => {

        it("supports multiple properties", () => {
            const k1 = prop("a");
            const k2 = prop("b");

            const v1 = node(1);
            const v2 = node(2);

            const map = new Map([
                [k1, v1],
                [k2, v2]
            ]);

            const rep = ObjectRepresentationNode.create({
                className: "Object",
                type: "object",
                entries: map
            });

            expect(rep.entries.size).toBe(2);
            expect(rep.entries.get(k1)).toBe(v1);
            expect(rep.entries.get(k2)).toBe(v2);
        });

        it("reflects external map mutations (reference behavior)", () => {
            const key = prop("x");
            const value = node(10);

            const map = new Map([[key, value]]);

            const rep = ObjectRepresentationNode.create({
                className: "Object",
                type: "object",
                entries: map
            });

            const newKey = prop("y");
            const newValue = node(20);

            map.set(newKey, newValue);

            expect(rep.entries.get(newKey)).toBe(newValue);
            expect(rep.entries.size).toBe(2);
        });

    });

    describe("type semantics", () => {

        it("inherits correct open/close tokens", () => {
            const rep = ObjectRepresentationNode.create({
                className: "Object",
                type: "object",
                entries: new Map()
            });

            expect(rep.openToken).toBe("{");
            expect(rep.closeToken).toBe("}");
        });

    });

});