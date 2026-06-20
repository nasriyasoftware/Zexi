import RegExpGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/regex.node";
import RegExpRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/regex.node";

describe("RegExpRepresentationNode", () => {

    describe("construction", () => {

        it("stores RegExp value correctly", () => {
            const regex = /abc/i;

            const node = new RegExpRepresentationNode(regex);

            expect(node.type).toBe("regex");
            expect(node.value).toBe(regex);
        });

        it("preserves RegExp reference (no cloning)", () => {
            const regex = /test/g;

            const node = new RegExpRepresentationNode(regex);

            expect(node.value).toBe(regex);
        });

    });

    describe("from()", () => {

        it("converts RegExpGraphNode correctly", () => {
            const regex = /hello/gi;
            const graphNode = new RegExpGraphNode(regex);

            const node = RegExpRepresentationNode.from(graphNode);

            expect(node).toBeInstanceOf(RegExpRepresentationNode);
            expect(node.type).toBe("regex");
            expect(node.value).toEqual(regex);
            expect(node.value).not.toBe(regex);
        });

        it("removes original RegExp reference from graph node", () => {
            const regex = /world/;
            const graphNode = new RegExpGraphNode(regex);

            const node = RegExpRepresentationNode.from(graphNode);

            expect(node.value).not.toBe(regex);
        });

    });

    describe("immutability expectations", () => {

        it("does not allow reassignment of value", () => {
            const regex = /abc/;
            const node = new RegExpRepresentationNode(regex);

            expect(() => {
                // @ts-expect-error
                node.value = /changed/;
            }).toThrow(TypeError);

            expect(node.value).toBe(regex);
        });

        it("does not allow reassignment of type", () => {
            const regex = /abc/;
            const node = new RegExpRepresentationNode(regex);

            expect(() => {
                // @ts-expect-error
                node.type = "string";
            }).toThrow(TypeError);

            expect(node.type).toBe("regex");
        });

    });

    describe("semantic behavior", () => {

        it("preserves regex flags correctly", () => {
            const regex = /abc/gim;

            const node = new RegExpRepresentationNode(regex);

            expect(node.value.flags).toBe("gim");
        });

        it("preserves regex source correctly", () => {
            const regex = /hello-world/;

            const node = new RegExpRepresentationNode(regex);

            expect(node.value.source).toBe("hello-world");
        });

        it("works with empty regex", () => {
            const regex = /(?:)/;

            const node = new RegExpRepresentationNode(regex);

            expect(node.value).toBe(regex);
        });

    });

});