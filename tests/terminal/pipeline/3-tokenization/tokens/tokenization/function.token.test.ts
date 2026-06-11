import { FunctionToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/function.token";

describe("FunctionToken", () => {
    it("stores the original function reference", () => {
        function testFn() { }

        const token = new FunctionToken(testFn);

        expect(token.value).toBe(testFn);
    });

    it("preserves reference identity (no cloning)", () => {
        const fn = () => "hello";

        const token = new FunctionToken(fn);

        expect(token.value).toBe(fn);
    });

    it("exposes a valid function instance", () => {
        const fn = async function () { };

        const token = new FunctionToken(fn);

        expect(typeof token.value).toBe("function");
    });

    it("static from() creates a FunctionToken correctly", () => {
        const fn = function namedFn() { };

        const node = {
            value: fn
        } as any;

        const token = FunctionToken.from(node);

        expect(token).toBeInstanceOf(FunctionToken);
        expect(token.value).toBe(fn);
    });

    it("does not alter async functions", () => {
        const fn = async () => { };

        const token = new FunctionToken(fn);

        expect(token.value.constructor.name).toBe("AsyncFunction");
    });

    it("preserves generator functions", () => {
        function* gen() {
            yield 1;
        }

        const token = new FunctionToken(gen);

        expect(token.value.constructor.name).toBe("GeneratorFunction");
    });

    it("keeps function identity stable across tokenization", () => {
        const fn = () => 42;

        const token1 = new FunctionToken(fn);
        const token2 = new FunctionToken(fn);

        expect(token1.value).toBe(token2.value);
    });
});