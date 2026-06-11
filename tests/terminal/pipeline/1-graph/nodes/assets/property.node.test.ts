import PropertyNode, { type PropertyKind } from "../../../../../../src/core/terminal/pipeline/1-graphing/nodes/assets/property.node";

describe("PropertyNode", () => {

    describe("constructor", () => {

        it("creates a property node with correct name and kind", () => {
            const node = new PropertyNode("name", "property");

            expect(node.name).toBe("name");
            expect(node.kind).toBe("property");
        });

        it("creates method kind node", () => {
            const node = new PropertyNode("render", "method");

            expect(node.name).toBe("render");
            expect(node.kind).toBe("method");
        });

        it("creates getter kind node", () => {
            const node = new PropertyNode("size", "getter");

            expect(node.name).toBe("size");
            expect(node.kind).toBe("getter");
        });

        it("creates setter kind node", () => {
            const node = new PropertyNode("value", "setter");

            expect(node.name).toBe("value");
            expect(node.kind).toBe("setter");
        });

    });

    describe("immutability", () => {

        it("does not allow mutation of name via external reassignment", () => {
            const node = new PropertyNode("id", "property");

            expect(() => {
                // @ts-expect-error testing runtime immutability
                node.name = "changed";
            }).toThrow(TypeError);
        });

        it("does not allow mutation of kind via external reassignment", () => {
            const node = new PropertyNode("id", "property");

            expect(() => {
                // @ts-expect-error testing runtime immutability
                node.kind = "method";
            }).toThrow(TypeError);
        });

    });

    describe("type safety / generic inference", () => {

        it("preserves literal kind type in method usage", () => {
            const node = PropertyNode.create("render", "method");

            // Type-level test (runtime still validated)
            expect(node.kind).toBe("method");
        });

        it("infers property kind correctly across all variants", () => {
            const kinds: PropertyKind[] = [
                "property",
                "method",
                "getter",
                "setter"
            ];

            for (const kind of kinds) {
                const node = PropertyNode.create("test", kind);

                expect(node.kind).toBe(kind);
            }
        });

    });

    describe("static create()", () => {

        it("creates a PropertyNode instance", () => {
            const node = PropertyNode.create("name", "property");

            expect(node).toBeInstanceOf(PropertyNode);
        });

        it("preserves values exactly", () => {
            const node = PropertyNode.create("render", "method");

            expect(node.name).toBe("render");
            expect(node.kind).toBe("method");
        });

    });

});