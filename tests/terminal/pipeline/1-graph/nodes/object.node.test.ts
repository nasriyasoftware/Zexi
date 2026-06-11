import PropertyNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/assets/property.node";
import ObjectGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/object.node";
import PrimitiveGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/primitive.node";

describe("ObjectGraphNode", () => {

    describe("constructor", () => {

        it("creates a record node for plain objects", () => {
            const node = new ObjectGraphNode({
                name: "Ahmad"
            });

            expect(node.name).toBe("Record");
            expect(node.type).toBe("record");
            expect(node.className).toBe("Record");
        });

        it("creates an object node for class instances", () => {
            class User {
                name = "Ahmad";
            }

            const node = new ObjectGraphNode(new User());

            expect(node.name).toBe("Object");
            expect(node.type).toBe("object");
            expect(node.className).toBe("User")
        });

        it("initializes with an empty property map", () => {
            const node = new ObjectGraphNode({});

            expect(node.data).toBeInstanceOf(Map);
            expect(node.data.size).toBe(0);
        });

    });

    describe("add()", () => {

        it("stores property/value pairs", () => {
            const node = new ObjectGraphNode({});

            const prop = new PropertyNode("name", "property");
            const value = new PrimitiveGraphNode("Ahmad");

            node.add(prop, value);

            expect(node.data.size).toBe(1);
            expect(node.data.get(prop)).toBe(value);
        });

        it("preserves insertion order", () => {
            const node = new ObjectGraphNode({});

            const prop1 = new PropertyNode("a", "property");
            const prop2 = new PropertyNode("b", "property");

            node.add(prop1, new PrimitiveGraphNode(1));
            node.add(prop2, new PrimitiveGraphNode(2));

            const keys = Array.from(node.data.keys());

            expect(keys[0]).toBe(prop1);
            expect(keys[1]).toBe(prop2);
        });

        it("supports different property kinds", () => {
            const node = new ObjectGraphNode({});

            const getter = new PropertyNode("size", "getter");
            const setter = new PropertyNode("value", "setter");
            const method = new PropertyNode("render", "method");

            node.add(getter, new PrimitiveGraphNode("getter"));
            node.add(setter, new PrimitiveGraphNode("setter"));
            node.add(method, new PrimitiveGraphNode("method"));

            expect(node.data.has(getter)).toBe(true);
            expect(node.data.has(setter)).toBe(true);
            expect(node.data.has(method)).toBe(true);
        });

        it("allows arbitrary graph node values", () => {
            const parent = new ObjectGraphNode({});
            const child = new ObjectGraphNode({});

            const prop = new PropertyNode("nested", "property");

            parent.add(prop, child);

            expect(parent.data.get(prop)).toBe(child);
        });

    });

    describe("static createProp()", () => {

        it("creates property nodes", () => {
            const prop = ObjectGraphNode.createProp("name", "property");

            expect(prop).toBeInstanceOf(PropertyNode);
            expect(prop.name).toBe("name");
            expect(prop.kind).toBe("property");
        });

        it("preserves property kind typing", () => {
            const prop = ObjectGraphNode.createProp("render", "method");

            expect(prop.kind).toBe("method");
        });

    });

    describe("static create()", () => {

        it("creates an ObjectGraphNode instance", () => {
            const node = ObjectGraphNode.create({});

            expect(node).toBeInstanceOf(ObjectGraphNode);
        });

        it("correctly classifies records", () => {
            const node = ObjectGraphNode.create({
                a: 1
            });

            expect(node.type).toBe("record");
        });

        it("correctly classifies class instances", () => {
            class Test { }

            const node = ObjectGraphNode.create(new Test());

            expect(node.type).toBe("object");
        });

    });

});