import TokensController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/tokens.controller";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import { AnchorToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/anchor.token";

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

describe("TokensController", () => {

    describe("construction", () => {

        it("starts before traversal", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            expect(controller.cursor).toBe(-1);
            expect(controller.current).toBeNull();
        });

        it("copies the source array", () => {
            const source = [token("A")];

            const controller = new TokensController(source);

            source.push(token("B"));

            expect((controller.next() as MockToken).value).toBe("A");
            expect(controller.next()).toBeNull();
        });

        it("reports available tokens before traversal", () => {
            const controller = new TokensController([
                token("A")
            ]);

            expect(controller.hasNext()).toBe(true);
        });
    });

    describe("next()", () => {

        it("consumes tokens sequentially", () => {
            const controller = new TokensController([
                token("A"),
                token("B"),
                token("C")
            ]);

            expect((controller.next() as MockToken).value).toBe("A");
            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("updates current token", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            expect((controller.current as MockToken).value).toBe("A");

            controller.next();

            expect((controller.current as MockToken).value).toBe("B");
        });

        it("updates cursor after each consumption", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            expect(controller.cursor).toBe(-1);

            controller.next();
            expect(controller.cursor).toBe(0);

            controller.next();
            expect(controller.cursor).toBe(1);
        });

        it("returns null at eof", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.next();

            expect(controller.next()).toBeNull();
        });

        it("does not advance cursor at eof", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.next();

            expect(controller.cursor).toBe(0);

            controller.next();

            expect(controller.cursor).toBe(0);
        });

        it("reports no remaining tokens at eof", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.next();

            expect(controller.hasNext()).toBe(false);
        });
    });

    describe("peek()", () => {

        it("peeks the next unread token", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            expect((controller.peek() as MockToken).value).toBe("B");
        });

        it("does not mutate traversal state", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            controller.peek();

            expect(controller.cursor).toBe(0);
            expect((controller.current as MockToken).value).toBe("A");
        });

        it("supports offset zero", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            expect((controller.peek(0) as MockToken).value).toBe("A");
        });

        it("supports arbitrary positive offsets", () => {
            const controller = new TokensController([
                token("A"),
                token("B"),
                token("C"),
                token("D")
            ]);

            controller.next();

            expect((controller.peek(1) as MockToken).value).toBe("B");
            expect((controller.peek(2) as MockToken).value).toBe("C");
            expect((controller.peek(3) as MockToken).value).toBe("D");
        });

        it("returns null when outside stream bounds", () => {
            const controller = new TokensController([
                token("A")
            ]);

            expect(controller.peek(-1)).toBeNull();

            controller.next();

            expect(controller.peek()).toBeNull();
            expect(controller.peek(999)).toBeNull();
        });
    });

    describe("inject()", () => {

        it("injects a token after the current cursor", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"));

            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("injects multiple tokens in order", () => {
            const controller = new TokensController([
                token("A"),
                token("D")
            ]);

            controller.next();

            controller.inject([
                token("B"),
                token("C")
            ]);

            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
            expect((controller.next() as MockToken).value).toBe("D");
        });

        it("supports injection before traversal starts", () => {
            const controller = new TokensController([
                token("B")
            ]);

            controller.inject(token("A"));

            expect((controller.next() as MockToken).value).toBe("A");
            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("supports injection after eof", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.next();
            controller.next();

            controller.inject(token("B"));

            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("does not modify current token", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"));

            expect((controller.current as MockToken).value).toBe("A");
            expect(controller.cursor).toBe(0);
        });

        it("makes injected tokens immediately visible to peek", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"));

            expect((controller.peek() as MockToken).value).toBe("B");
        });

        it("returns itself for chaining", () => {
            const controller = new TokensController([
                token("D")
            ]);

            expect(
                controller.inject(token("A"))
            ).toBe(controller);
        });

        it("ignores empty injections", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.inject([]);

            expect((controller.next() as MockToken).value).toBe("A");
            expect(controller.next()).toBeNull();
        });

        it("injects a token at an explicit index", () => {
            const controller = new TokensController([
                token("A"),
                token("C"),
                token("D")
            ]);

            controller.next(); // cursor = 0 ("A")

            controller.inject(token("B"), {
                at: 2
            });

            expect((controller.next() as MockToken).value).toBe("C");
            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("throws when injecting at an index <= cursor", () => {
            const controller = new TokensController([
                token("A"),
                token("B"),
                token("C")
            ]);

            controller.next(); // cursor = 0

            expect(() => {
                controller.inject(token("X"), {
                    at: 0
                });
            }).toThrow();

            expect(() => {
                controller.inject(token("X"), {
                    at: 0
                });
            }).toThrow();
        });

        it("injects tokens after an AnchorToken instance", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                token("A"),
                anchor,
                token("C")
            ]);

            controller.next(); // A

            controller.inject(token("B"), {
                at: anchor
            });

            expect(controller.next()).toBe(anchor);
            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("injects tokens after an AnchorToken symbol id", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                token("A"),
                anchor,
                token("C")
            ]);

            controller.next(); // A

            controller.inject(token("B"), {
                at: anchor.id
            });

            expect(controller.next()).toBe(anchor);
            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("throws when anchor token is not found", () => {
            const anchor = new AnchorToken("missing");

            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            expect(() => {
                controller.inject(token("X"), {
                    at: anchor
                });
            }).toThrow();
        });

        it("throws when anchor is at or before cursor", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                anchor,
                token("B"),
                token("C")
            ]);

            controller.next(); // cursor is at anchor

            expect(() => {
                controller.inject(token("X"), {
                    at: anchor
                });
            }).toThrow();
        });

        it("injects multiple tokens after anchor preserving order", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                token("A"),
                anchor,
                token("D")
            ]);

            controller.next(); // A

            controller.inject([
                token("B"),
                token("C")
            ], {
                at: anchor
            });

            expect(controller.next()).toBe(anchor);
            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
            expect((controller.next() as MockToken).value).toBe("D");
        });

        it("defaults to cursor+1 when no at option is provided", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"));

            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
        });
    });

    describe("rollbackBefore()", () => {

        it("restores traversal before the supplied cursor", () => {
            const controller = new TokensController([
                token("A"),
                token("B"),
                token("C")
            ]);

            controller.next();
            controller.next();

            controller.rollbackBefore(0);

            expect(controller.cursor).toBe(-1);
            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("supports complete reset using -1", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            controller.rollbackBefore(-1);

            expect(controller.cursor).toBe(-1);
            expect(controller.current).toBeNull();
        });

        it("removes injected tokens", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"));

            controller.next();

            controller.rollbackBefore(0);

            expect((controller.next() as MockToken).value).toBe("A");
            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("preserves original tokens", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.inject(token("X"));

            controller.rollbackBefore(-1);

            expect((controller.next() as MockToken).value).toBe("A");
            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("removes multiple injected tokens", () => {
            const controller = new TokensController([
                token("A"),
                token("D")
            ]);

            controller.next();

            controller.inject([
                token("B"),
                token("C")
            ]);

            controller.rollbackBefore(0);

            expect((controller.next() as MockToken).value).toBe("A");
            expect((controller.next() as MockToken).value).toBe("D");
        });

        it("clamps rollback cursor to valid bounds", () => {
            const controller = new TokensController([
                token("A")
            ]);

            controller.rollbackBefore(999);

            expect(controller.cursor).toBe(-1);
        });
    });

    describe("mixed traversal scenarios", () => {

        it("maintains deterministic traversal after injection", () => {
            const controller = new TokensController([
                token("A"),
                token("D")
            ]);

            controller.next();

            controller.inject([
                token("B"),
                token("C")
            ]);

            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
            expect((controller.next() as MockToken).value).toBe("D");
            expect(controller.next()).toBeNull();
        });

        it("preserves current token during peek and injection", () => {
            const controller = new TokensController([
                token("A"),
                token("C")
            ]);

            controller.next();

            controller.peek();
            controller.inject(token("B"));

            expect((controller.current as MockToken).value).toBe("A");
            expect(controller.cursor).toBe(0);
        });
    });
});