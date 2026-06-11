import GraphBuilder from "../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../src/core/terminal/pipeline/2-representation/builder";
import REP_NODES from "../../../../src/core/terminal/pipeline/2-representation/nodes";

describe("RepresentationBuilder (integration with GraphBuilder + identity)", () => {

    const buildGraph = (value: unknown) => GraphBuilder.build(value, { cycles: 'throw', references: 'inline' });
    const buildRep = RepresentationBuilder.build;

    describe("primitive values", () => {

        it("converts string primitive", () => {
            const graph = buildGraph("hello");
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Primitive>

            expect(rep).toBeInstanceOf(REP_NODES.Primitive);
            expect(rep.type).toBe("string");
            expect(rep.value).toBe("hello");
        });

        it("converts number primitive", () => {
            const graph = buildGraph(42);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Primitive>;

            expect(rep).toBeInstanceOf(REP_NODES.Primitive);
            expect(rep.type).toBe("number");
            expect(rep.value).toBe(42);
        });

        it("converts null primitive", () => {
            const graph = buildGraph(null);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Primitive>;

            expect(rep).toBeInstanceOf(REP_NODES.Primitive);
            expect(rep.type).toBe("null");
            expect(rep.value).toBeNull();
        });

    });

    describe("arrays", () => {

        it("converts simple array", () => {
            const graph = buildGraph([1, 2, 3]);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Array>;

            expect(rep).toBeInstanceOf(REP_NODES.Array);
            expect(rep.type).toBe("array");
            expect(rep.items.length).toBe(3);

            const items = rep.items as InstanceType<typeof REP_NODES.Primitive>[];

            expect(items[0]).toBeInstanceOf(REP_NODES.Primitive);
            expect(items[0].type).toBe("number");
            expect(items[0].value).toBe(1);

            expect(items[1].value).toBe(2);
            expect(items[2].value).toBe(3);
        });

        it("handles nested arrays", () => {
            const graph = buildGraph([1, [2, [3]]]);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Array>;

            expect(rep.type).toBe("array");

            const nested = rep.items[1] as InstanceType<typeof REP_NODES.Array>;
            const deep = nested.items[1] as InstanceType<typeof REP_NODES.Array>;
            const value = deep.items[0] as InstanceType<typeof REP_NODES.Primitive>;

            expect(value.value).toBe(3);
        });

        it("preserves identity for shared arrays", () => {
            const shared = [1, 2];

            const graph = buildGraph({
                x: shared,
                y: shared
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            const entries = Array.from(rep.entries.values());

            const x = entries[0] as InstanceType<typeof REP_NODES.Array>;
            const y = entries[1] as InstanceType<typeof REP_NODES.Array>;

            // same GraphNode ⇒ same RepresentationNode
            expect(x).toBe(y);
        });

    });

    describe("sets", () => {

        it("converts set", () => {
            const graph = buildGraph(new Set([1, 2, 3]));
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Set>;

            expect(rep).toBeInstanceOf(REP_NODES.Set);
            expect(rep.type).toBe("set");
            expect(rep.items.length).toBe(3);
        });

        it("preserves identity for shared set values", () => {
            const shared = new Set([1, 2]);

            const graph = buildGraph({
                a: shared,
                b: shared
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            const values = Array.from(rep.entries.values());

            expect(values[0]).toBe(values[1]);
        });

    });

    describe("maps", () => {

        it("converts map", () => {
            const map = new Map();
            map.set("a", 1);
            map.set("b", 2);

            const graph = buildGraph(map);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Map>;

            expect(rep).toBeInstanceOf(REP_NODES.Map);
            expect(rep.type).toBe("map");
            expect(rep.entries.size).toBe(2);
        });

        it("preserves identity for shared map structure", () => {
            const shared = new Map([["x", 1]]);

            const graph = buildGraph({
                a: shared,
                b: shared
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            const values = Array.from(rep.entries.values());

            expect(values[0]).toBe(values[1]);
        });

    });

    describe("objects", () => {

        it("converts simple object", () => {
            const graph = buildGraph({ a: 1, b: 2 });
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            expect(rep).toBeInstanceOf(REP_NODES.Object);
            expect(rep.type).toBe("record");
            expect(rep.entries.size).toBe(2);
        });

        it("preserves nested object structure", () => {
            const graph = buildGraph({
                a: {
                    b: {
                        c: 3
                    }
                }
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            const a = Array.from(rep.entries.values())[0] as InstanceType<typeof REP_NODES.Object>;
            const b = Array.from(a.entries.values())[0] as InstanceType<typeof REP_NODES.Object>;
            const c = Array.from(b.entries.values())[0] as InstanceType<typeof REP_NODES.Primitive>;

            expect(c.value).toBe(3);
        });

        it("preserves identity for shared object references", () => {
            const shared = { x: 1 };

            const graph = buildGraph({
                a: shared,
                b: shared
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            expect(rep).toBeInstanceOf(REP_NODES.Object);
            
            const values = Array.from(rep.entries.values());
            expect(values[0]).toBe(values[1]);
        });

    });

    describe("special types", () => {

        it("converts Date", () => {
            const date = new Date("2020-01-01");
            const graph = buildGraph(date);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Date>;

            expect(rep).toBeInstanceOf(REP_NODES.Date);
            expect(rep.type).toBe("date");
            expect(rep.value).toBeInstanceOf(Date);

            expect(rep.value).not.toBe(date);
            expect(rep.value.getTime()).toBe(date.getTime());
        });

        it("converts RegExp", () => {
            const regex = /abc/gi;
            const graph = buildGraph(regex);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.RegExp>;

            expect(rep).toBeInstanceOf(REP_NODES.RegExp);
            expect(rep.type).toBe("regex");
            expect(rep.value.source).toBe(regex.source);
            expect(rep.value).not.toBe(regex);
        });

        it("converts Error", () => {
            const graph = buildGraph(new SyntaxError("fail"));
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Error>;

            expect(rep).toBeInstanceOf(REP_NODES.Error);
            expect(rep.type).toBe("error");

            expect(rep.data.message).toBe("fail");
            expect(rep.data.name).toBe("SyntaxError");
        });

        it("converts Function", () => {
            const fn = () => 123;

            const graph = buildGraph(fn);
            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Function>;

            expect(rep).toBeInstanceOf(REP_NODES.Function);
            expect(rep.type).toBe("function");
            expect(rep.value).toBe(fn);
        });

        it("preserves identity for shared function references", () => {
            const fn = () => 123;

            const graph = buildGraph({
                a: fn,
                b: fn
            });

            const rep = buildRep(graph) as InstanceType<typeof REP_NODES.Object>;

            const values = Array.from(rep.entries.values());

            expect(values[0]).toBe(values[1]);
        });

    });

});