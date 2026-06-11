import GraphBuilder from "../../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../../src/core/terminal/pipeline/2-representation/builder";

import REP_NODES from "../../../../../src/core/terminal/pipeline/2-representation/nodes";
import CircularReferenceError from "../../../../../src/core/terminal/pipeline/1-graphing/identity/circular.error";

import type { ErrorGraphNodeData } from "../../../../../src/core/terminal/pipeline/1-graphing/types";
import GRAPH_NODES from "../../../../../src/core/terminal/pipeline/1-graphing/nodes";

describe("ErrorRepresentationNode (integration via pipeline)", () => {

    const buildGraph = (value: unknown) => {
        return GraphBuilder.build(value, {
            cycles: "throw",
            references: "inline"
        });
    }

    const buildRep = (value: unknown) => RepresentationBuilder.build(buildGraph(value));

    describe("construction via graph → representation pipeline", () => {

        it("stores error data correctly", () => {
            const error = new Error("Something went wrong");

            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.type).toBe("error");

            const data = node.data;

            expect(data.name).toBe("Error");
            expect(data.message).toBe("Something went wrong");
            expect(Array.isArray(data.stack)).toBe(true);
        });

        it("preserves error name and message", () => {
            const error = new TypeError("bad type");

            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.data.name).toBe("TypeError");
            expect(node.data.message).toBe("bad type");
        });

    });

    describe("from() behavior", () => {

        it("builds representation from GraphErrorNode via pipeline", () => {
            const error = new Error("Graph failure");

            const graph = buildGraph(error);
            const rep = RepresentationBuilder.build(graph) as InstanceType<typeof REP_NODES.Error>;

            expect(rep.type).toBe("error");
            expect(rep.data.message).toBe("Graph failure");
        });

        it("preserves structured graph data (not raw Error)", () => {
            const error = new Error("deep failure");

            const graph = buildGraph(error);
            const rep = RepresentationBuilder.build(graph) as InstanceType<typeof REP_NODES.Error>;

            const data = rep.data;

            expect(data).toHaveProperty("name");
            expect(data).toHaveProperty("message");
            expect(data).toHaveProperty("stack");
            expect(data).toHaveProperty("cause");
        });

    });

    describe("data immutability expectations", () => {

        it("does not allow mutation of type", () => {
            const error = new Error("test");
            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.type).toBe("error");

            expect(() => {
                // @ts-expect-error
                node.type = "string";
            }).toThrow();

            expect(() => {
                // @ts-expect-error
                node.data = {};
            }).toThrow();
        });

        it("data object exists and is stable", () => {
            const error = new Error("stable");
            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            const d1 = node.data;
            const d2 = node.data;

            expect(d1).toBe(d2);
        });

    });

    describe("semantic correctness", () => {

        it("handles TypeError correctly", () => {
            const error = new TypeError("bad type");

            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.data.name).toBe("TypeError");
            expect(node.data.message).toBe("bad type");
        });

        it("handles generic Error correctly", () => {
            const error = new Error("generic");

            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.data.name).toBe("Error");
            expect(node.data.message).toBe("generic");
        });

        it("ensures stack trace exists in representation data", () => {
            const error = new Error("stack test");

            const node = buildRep(error) as InstanceType<typeof REP_NODES.Error>;

            expect(node.data.stack).toBeDefined();
            expect(Array.isArray(node.data.stack)).toBe(true);
        });

    });

    describe("shared error identity (reuse)", () => {

        it("reuses same graph node for identical Error reference", () => {
            const shared = new Error("shared");

            const obj = {
                a: shared,
                b: shared,
            };

            const graph = buildGraph(obj) as InstanceType<typeof GRAPH_NODES.Object>;

            const aNode = (graph as any).data.get(
                [...(graph as any).data.keys()][0]
            );

            const bNode = (graph as any).data.get(
                [...(graph as any).data.keys()][1]
            );

            // same graph node identity (same JS value tracking)
            expect(aNode).toBe(bNode);
        });

        it("reuses same representation node for shared error", () => {
            const shared = new Error("shared");

            const obj = {
                a: shared,
                b: shared,
            };

            const graph = buildGraph(obj);
            const rep = RepresentationBuilder.build(graph) as InstanceType<typeof REP_NODES.Object>;

            const values = Array.from(rep.entries.values());

            const aRep = values[0];
            const bRep = values[1];

            expect(aRep).toBe(bRep);
        });

    });

    describe("error with circular cause (must throw)", () => {

        it("throws CircularReferenceError when cause is cyclic", () => {
            const error: any = new Error("root");

            const child = new Error("child");

            // introduce circular structure via cause
            error.cause = child;
            child.cause = error;

            expect(() => {
                buildGraph(error);
            }).toThrow(CircularReferenceError);
        });

        it("process errors with cause", () => {
            const originalError = new RangeError("original");
            const error = new Error("root", { cause: originalError });

            const graph = buildGraph(error);
            const rep = RepresentationBuilder.build(graph) as InstanceType<typeof REP_NODES.Error>;

            expect(rep).toBeInstanceOf(REP_NODES.Error);
            expect(rep.type).toBe("error");
            expect(rep.data.name).toBe("Error");
            expect(rep.data.message).toBe("root");

            const cause = rep.data.cause as InstanceType<typeof REP_NODES.Error>;
            expect(cause).toBeInstanceOf(REP_NODES.Error);
            expect(cause.type).toBe("error");
            expect(cause.data.name).toBe("RangeError");
            expect(cause.data.message).toBe("original");
            expect(cause.data.cause).toBeUndefined();
        })
    });
});