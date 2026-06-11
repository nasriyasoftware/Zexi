import RegExpGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/regex.node";

describe("RegExpGraphNode", () => {

    describe("construction", () => {

        it("creates a regex node with correct type", () => {
            const regex = /abc/g;
            const node = new RegExpGraphNode(regex);

            expect(node.type).toBe("regex");
        });

        it("preserves RegExp source", () => {
            const regex = /hello/gi;
            const node = new RegExpGraphNode(regex);

            expect(node.value.source).toBe("hello");
        })

        it("preserves RegExp flags", () => {
            const regex = /hello/gi;
            const node = new RegExpGraphNode(regex);

            expect(node.value.flags).toContain("g");
            expect(node.value.flags).toContain("i");
        });

        it("preserves RegExp source", () => {
            const regex = /world/m;
            const node = new RegExpGraphNode(regex);

            expect(node.value.source).toBe("world");
        });

    });

    describe("immutability", () => {

        it("does clone the RegExp instance", () => {
            const regex = /abc/;
            const node = new RegExpGraphNode(regex);

            expect(node.value).not.toBe(regex);
            expect(node.value).toEqual(regex);
        });

        it("keeps same reference across access", () => {
            const regex = /xyz/;
            const node = new RegExpGraphNode(regex);

            const r1 = node.value;
            const r2 = node.value;

            expect(r1).toBe(r2);
        });

    });

    describe("static factory", () => {

        it("creates equivalent node via create()", () => {
            const regex = /factory/;

            const direct = new RegExpGraphNode(regex);
            const created = RegExpGraphNode.create(regex);

            expect(created.type).toBe(direct.type);
            expect(created.value).toEqual(direct.value);
        });

    });

    describe("behavior safety", () => {

        it("does not execute regex", () => {
            const regex = /a+/g;
            const node = new RegExpGraphNode(regex);

            expect(node.value).toEqual(regex);
            expect(node.value.test("aaa")).toBe(true);
        });

        it("does not preserve lastIndex behavior of original instance", () => {
            const regex = /a/g;
            const node = new RegExpGraphNode(regex);

            regex.test("a");

            expect(node.value.lastIndex).toBe(0);
        });

    });

});