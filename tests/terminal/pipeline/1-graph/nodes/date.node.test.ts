import DateGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/date.node";

describe("DateGraphNode", () => {

    describe("construction", () => {

        it("creates a valid date node", () => {
            const date = new Date("2024-01-01T00:00:00.000Z");
            const node = new DateGraphNode(date);

            expect(node).toBeInstanceOf(DateGraphNode);
            expect(node.value).not.toBe(date);
            expect(node.value).toEqual(date);
            expect(node.type).toBe("date");
        });

        it("preserves original Date data", () => {
            const date = new Date();
            const node = new DateGraphNode(date);

            expect(node.value).not.toBe(date);
            expect(node.value).toEqual(date);
        });

    });

    describe("static factory", () => {

        it("creates a DateGraphNode via factory", () => {
            const date = new Date();
            const node = DateGraphNode.create(date);

            expect(node).toBeInstanceOf(DateGraphNode);
            expect(node.value).not.toBe(date);
            expect(node.value).toEqual(date);
        });

    });

    describe("type stability", () => {

        it("always reports type as 'date'", () => {
            const node = new DateGraphNode(new Date());

            expect(node.type).toBe("date");
        });

    });

    describe("value behavior", () => {

        it("allows mutation of underlying Date object (JS behavior preserved)", () => {
            const date = new Date("2024-01-01T00:00:00.000Z");
            const node = new DateGraphNode(date);

            node.value.setUTCFullYear(2030);

            expect(node.value.getUTCFullYear()).toBe(2030);
        });

    });

});