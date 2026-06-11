import DateGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/date.node";
import DateRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/date.node";

describe("DateRepresentationNode", () => {

    describe("construction", () => {

        it("stores Date value correctly", () => {
            const date = new Date("2026-01-01T00:00:00.000Z");

            const node = new DateRepresentationNode(date);

            expect(node.value).toBe(date);
            expect(node.type).toBe("date");
        });

        it("does not clone Date (reference preserved)", () => {
            const date = new Date();

            const node = new DateRepresentationNode(date);

            expect(node.value).toBe(date);
        });

    });

    describe("from()", () => {

        it("converts DateGraphNode correctly", () => {
            const date = new Date("2026-01-01T00:00:00.000Z");
            const graphNode = new DateGraphNode(date);

            const node = DateRepresentationNode.from(graphNode);

            expect(node).toBeInstanceOf(DateRepresentationNode);
            expect(node.type).toBe("date");
            expect(node.value).toBe(date);
        });

        it("preserves original Date reference from graph node", () => {
            const date = new Date();
            const graphNode = new DateGraphNode(date);

            const node = DateRepresentationNode.from(graphNode);

            expect(node.value).toBe(date);
        });

    });

    describe("immutability expectations", () => {

        it("does not allow mutation of type", () => {
            const date = new Date();
            const node = new DateRepresentationNode(date);

            expect(() => {
                // @ts-expect-error
                node.type = "string";
            }).toThrow(TypeError);

            expect(node.type).toBe("date");
        });

        it("does not allow reassignment of value", () => {
            const date = new Date();
            const node = new DateRepresentationNode(date);

            expect(() => {
                // @ts-expect-error
                node.value = new Date();
            }).toThrow(TypeError);

            expect(node.value).toBe(date);
        });

    });

});