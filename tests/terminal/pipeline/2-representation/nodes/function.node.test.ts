import FunctionGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/function.node";
import FunctionRepresentationNode from "../../../../../src/core/terminal/pipeline/2-representation/nodes/function.node";

describe("FunctionRepresentationNode", () => {

    describe("construction", () => {

        it("stores function reference correctly", () => {
            const fn = function testFn() { return 42; };

            const node = new FunctionRepresentationNode(fn);

            expect(node.type).toBe("function");
            expect(node.value).toBe(fn);
        });

        it("preserves function identity (no cloning)", () => {
            const fn = () => "hello";

            const node = new FunctionRepresentationNode(fn);

            expect(node.value).toBe(fn);
        });

    });

    describe("from()", () => {

        it("converts FunctionGraphNode correctly", () => {
            const fn = function graphFn() { return "graph"; };
            const graphNode = new FunctionGraphNode(fn);

            const node = FunctionRepresentationNode.from(graphNode);

            expect(node).toBeInstanceOf(FunctionRepresentationNode);
            expect(node.type).toBe("function");
            expect(node.value).toBe(fn);
        });

        it("preserves original function reference from graph node", () => {
            const fn = () => 123;
            const graphNode = new FunctionGraphNode(fn);

            const node = FunctionRepresentationNode.from(graphNode);

            expect(node.value).toBe(fn);
        });

    });

    describe("immutability expectations", () => {

        it("does not allow reassignment of value", () => {
            const fn = () => 1;
            const node = new FunctionRepresentationNode(fn);

            expect(() => {
                // @ts-expect-error
                node.value = () => 2;
            }).toThrow(TypeError);

            expect(node.value).toBe(fn);
        });

        it("does not allow reassignment of type", () => {
            const fn = () => 1;
            const node = new FunctionRepresentationNode(fn);

            expect(() => {
                // @ts-expect-error
                node.type = "string";
            }).toThrow(TypeError);

            expect(node.type).toBe("function");
        });

    });

    describe("semantic expectations", () => {

        it("handles named functions correctly", () => {
            function namedFn() { return true; }

            const node = new FunctionRepresentationNode(namedFn);

            expect(node.value.name).toBe("namedFn");
        });

        it("handles anonymous functions correctly", () => {
            const fn = function () { return true; };

            const namedNode = new FunctionRepresentationNode(fn);
            expect(namedNode.value.name).toBe("fn");
            
            const anonymousNode = new FunctionRepresentationNode(() => true);
            expect(anonymousNode.value.name).toBe("");
        });

        it("handles arrow functions correctly", () => {
            const fn = () => "arrow";

            const node = new FunctionRepresentationNode(fn);

            expect(node.value()).toBe("arrow");
        });

    });

});