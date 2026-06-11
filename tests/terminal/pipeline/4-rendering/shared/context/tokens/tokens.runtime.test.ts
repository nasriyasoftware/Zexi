import { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import TokensRuntime from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/runtime";
import TokensController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/tokens.controller";


type MockToken = {
    type: string;
    value: string;
};

function token(value: string): Token {
    return {
        type: "literal",
        value
    } as any;
}

describe("TokensRuntime", () => {

    function createRuntime(tokens: Token[]) {
        return new TokensRuntime(new TokensController(tokens));
    }

    describe("initial state", () => {

        it("starts with null current token", () => {
            const runtime = createRuntime([token("A"), token("B")]);

            expect(runtime.current).toBeNull();
        });

        it("reports availability of tokens correctly", () => {
            const runtime = createRuntime([token("A")]);

            expect(runtime.hasNext()).toBe(true);
        });
    });

    describe("next()", () => {

        it("consumes tokens sequentially", () => {
            const runtime = createRuntime([
                token("A"),
                token("B"),
                token("C")
            ]);

            expect((runtime.next() as MockToken).value).toBe("A");
            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("C");
        });

        it("updates current token after each step", () => {
            const runtime = createRuntime([
                token("A"),
                token("B")
            ]);

            runtime.next();
            expect((runtime.current as MockToken).value).toBe("A");

            runtime.next();
            expect((runtime.current as MockToken).value).toBe("B");
        });

        it("returns null at end of stream", () => {
            const runtime = createRuntime([token("A")]);

            runtime.next();
            expect(runtime.next()).toBeNull();
        });

        it("does not advance past EOF", () => {
            const runtime = createRuntime([token("A")]);

            runtime.next();
            runtime.next();

            expect(runtime.next()).toBeNull();
        });
    });

    describe("hasNext()", () => {

        it("returns true while tokens remain", () => {
            const runtime = createRuntime([token("A"), token("B")]);

            expect(runtime.hasNext()).toBe(true);

            runtime.next();
            expect(runtime.hasNext()).toBe(true);
        });

        it("returns false after exhaustion", () => {
            const runtime = createRuntime([token("A")]);

            runtime.next();
            expect(runtime.hasNext()).toBe(false);
        });
    });

    describe("peek()", () => {

        it("peeks next token without consuming it", () => {
            const runtime = createRuntime([
                token("A"),
                token("B"),
                token("C")
            ]);

            runtime.next();

            expect((runtime.peek() as MockToken).value).toBe("B");
            expect((runtime.current as MockToken).value).toBe("A");
        });

        it("supports offset 0 (current token)", () => {
            const runtime = createRuntime([
                token("A"),
                token("B")
            ]);

            runtime.next();

            expect((runtime.peek(0) as MockToken).value).toBe("A");
        });

        it("supports arbitrary offsets", () => {
            const runtime = createRuntime([
                token("A"),
                token("B"),
                token("C"),
                token("D")
            ]);

            runtime.next();

            expect((runtime.peek(1) as MockToken).value).toBe("B");
            expect((runtime.peek(2) as MockToken).value).toBe("C");
            expect((runtime.peek(3) as MockToken).value).toBe("D");
        });

        it("returns null when peeking out of bounds", () => {
            const runtime = createRuntime([token("A")]);

            runtime.next();

            expect(runtime.peek()).toBeNull();
            expect(runtime.peek(10)).toBeNull();
        });

        it("does not mutate traversal state", () => {
            const runtime = createRuntime([
                token("A"),
                token("B")
            ]);

            runtime.next();

            runtime.peek();
            runtime.peek(1);

            expect((runtime.current as MockToken).value).toBe("A");
        });
    });

    describe("inject()", () => {

        it("injects a single token into stream", () => {
            const runtime = createRuntime([
                token("A"),
                token("C")
            ]);

            runtime.next();
            runtime.inject(token("B"));

            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("C");
        });

        it("injects multiple tokens in order", () => {
            const runtime = createRuntime([
                token("A"),
                token("D")
            ]);

            runtime.next();

            runtime.inject([
                token("B"),
                token("C")
            ]);

            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("C");
            expect((runtime.next() as MockToken).value).toBe("D");
        });

        it("supports injection before traversal starts", () => {
            const runtime = createRuntime([token("B")]);

            runtime.inject(token("A"));

            expect((runtime.next() as MockToken).value).toBe("A");
            expect((runtime.next() as MockToken).value).toBe("B");
        });

        it("ignores empty injection arrays (no crash)", () => {
            const runtime = createRuntime([token("A")]);

            runtime.inject([]);

            expect((runtime.next() as MockToken).value).toBe("A");
            expect(runtime.next()).toBeNull();
        });

        it("allows chained behavior through multiple injections", () => {
            const runtime = createRuntime([token("D")]);

            runtime.inject(token("A"));
            runtime.inject([token("B"), token("C")]);

            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("C");
            expect((runtime.next() as MockToken).value).toBe("A");
            expect((runtime.next() as MockToken).value).toBe("D");
        });

        it("forwards numeric injection options correctly", () => {
            const runtime = createRuntime([
                token("A"),
                token("B"),
                token("C"),
                token("D")
            ]);

            runtime.next(); // A

            runtime.inject(token("X"), {
                at: 2
            });

            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("X");
            expect((runtime.next() as MockToken).value).toBe("C");
        });

        it("supports indexed injection before traversal starts", () => {
            const runtime = createRuntime([
                token("B"),
                token("C")
            ]);

            runtime.inject(token("A"), { at: 0 });

            expect((runtime.next() as MockToken).value).toBe("A");
            expect((runtime.next() as MockToken).value).toBe("B");
        });

        it("does not modify cursor during injection", () => {
            const runtime = createRuntime([
                token("A"),
                token("B")
            ]);

            runtime.next(); // cursor = 0

            runtime.inject(token("X"));

            expect(runtime.cursor).toBe(0);
        });
    });

    describe("integration behavior", () => {

        it("maintains deterministic traversal under mixed operations", () => {
            const runtime = createRuntime([
                token("A"),
                token("D")
            ]);

            expect((runtime.next() as MockToken).value).toBe("A");

            runtime.inject([
                token("B"),
                token("C")
            ]);

            expect((runtime.peek() as MockToken).value).toBe("B");

            expect((runtime.next() as MockToken).value).toBe("B");
            expect((runtime.next() as MockToken).value).toBe("C");
            expect((runtime.next() as MockToken).value).toBe("D");

            expect(runtime.next()).toBeNull();
        });

        it("keeps current stable across peek + inject", () => {
            const runtime = createRuntime([
                token("A"),
                token("C")
            ]);

            runtime.next();
            runtime.peek();
            runtime.inject(token("B"));

            expect((runtime.current as MockToken).value).toBe("A");
        });
    });

    describe("cursor", () => {

        it("starts at -1 before traversal begins", () => {
            const runtime = createRuntime([token("A"), token("B")]);

            expect(runtime.cursor).toBe(-1);
        });

        it("advances cursor as tokens are consumed", () => {
            const runtime = createRuntime([
                token("A"),
                token("B"),
                token("C")
            ]);

            runtime.next();
            expect(runtime.cursor).toBe(0);

            runtime.next();
            expect(runtime.cursor).toBe(1);

            runtime.next();
            expect(runtime.cursor).toBe(2);
        });

        it("does not change cursor after EOF", () => {
            const runtime = createRuntime([token("A")]);

            runtime.next();
            runtime.next();
            runtime.next();

            expect(runtime.cursor).toBe(0);
        });
    });
});