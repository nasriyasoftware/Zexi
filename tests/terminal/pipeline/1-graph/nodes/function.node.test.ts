import FunctionGraphNode from "../../../../../src/core/terminal/pipeline/1-graphing/nodes/function.node";

describe("FunctionGraphNode", () => {

    describe("creation", () => {

        it("creates a function graph node with correct type", () => {
            const fn = () => 42;
            const node = new FunctionGraphNode(fn);

            expect(node.type).toBe("function");
        });

        it("stores the original function reference", () => {
            const fn = function testFn() {
                return "hello";
            };

            const node = new FunctionGraphNode(fn);

            expect(node.value).toBe(fn);
        });

        it("preserves function identity exactly", () => {
            const fn = () => "identity";
            const node = new FunctionGraphNode(fn);

            expect(node.value).toBe(fn);
        });

    });

    describe("static factory", () => {

        it("creates equivalent node using create()", () => {
            const fn = () => "factory";

            const direct = new FunctionGraphNode(fn);
            const fromFactory = FunctionGraphNode.create(fn);

            expect(fromFactory.type).toBe(direct.type);
            expect(fromFactory.value).toBe(direct.value);
        });

    });

    describe("immutability & safety", () => {

        it("does not execute the function", () => {
            const fn = jest.fn(() => "executed");

            new FunctionGraphNode(fn);

            expect(fn).not.toHaveBeenCalled();
        });

        it("does not wrap or clone the function", () => {
            const fn = () => "raw";
            const node = new FunctionGraphNode(fn);

            expect(node.value).toBe(fn);
        });

        it("keeps function reference stable across reads", () => {
            const fn = () => "stable";
            const node = new FunctionGraphNode(fn);

            const ref1 = node.value;
            const ref2 = node.value;

            expect(ref1).toBe(ref2);
        });

    });

    describe("function variants", () => {

        it("supports named functions", () => {
            function namedFn() {
                return 1;
            }

            const node = new FunctionGraphNode(namedFn);

            expect(node.value.name).toBe("namedFn");
        });

        it("supports arrow functions", () => {
            const arrow = () => 123;

            const node = new FunctionGraphNode(arrow);

            expect(typeof node.value).toBe("function");
            expect(node.value()).toBe(123);
        });

        it("supports class constructors", () => {
            class MyClass { }

            const node = new FunctionGraphNode(MyClass);

            expect(typeof node.value).toBe("function");
            expect(new (node.value as any)()).toBeInstanceOf(MyClass);
        });

    });

});