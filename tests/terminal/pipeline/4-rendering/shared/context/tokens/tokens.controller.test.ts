import TokensController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/tokens.controller";
import { AnchorToken } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/anchor.token";
import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";

describe("TokensController", () => {
    // -----------------------------------------------------
    // construction
    // -----------------------------------------------------
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
            const controller = new TokensController([token("A")]);
            expect(controller.hasNext()).toBe(true);
        });
    });

    // -----------------------------------------------------
    // next()
    // -----------------------------------------------------
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
            const controller = new TokensController([token("A"), token("B")]);

            controller.next();
            expect((controller.current as MockToken).value).toBe("A");

            controller.next();
            expect((controller.current as MockToken).value).toBe("B");
        });

        it("updates cursor after each consumption", () => {
            const controller = new TokensController([token("A"), token("B")]);

            expect(controller.cursor).toBe(-1);

            controller.next();
            expect(controller.cursor).toBe(0);

            controller.next();
            expect(controller.cursor).toBe(1);
        });

        it("returns null at eof", () => {
            const controller = new TokensController([token("A")]);

            controller.next();
            expect(controller.next()).toBeNull();
        });

        it("does not advance cursor at eof", () => {
            const controller = new TokensController([token("A")]);

            controller.next();
            expect(controller.cursor).toBe(0);

            controller.next();
            expect(controller.cursor).toBe(0);
        });

        it("reports no remaining tokens at eof", () => {
            const controller = new TokensController([token("A")]);

            controller.next();
            expect(controller.hasNext()).toBe(false);
        });
    });

    // -----------------------------------------------------
    // peek()
    // -----------------------------------------------------
    describe("peek()", () => {

        it("peeks the next unread token", () => {
            const controller = new TokensController([token("A"), token("B")]);

            controller.next();
            expect((controller.peek() as MockToken).value).toBe("B");
        });

        it("does not mutate traversal state", () => {
            const controller = new TokensController([token("A"), token("B")]);

            controller.next();
            controller.peek();

            expect(controller.cursor).toBe(0);
        });

        it("supports offset zero", () => {
            const controller = new TokensController([token("A"), token("B")]);

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
            const controller = new TokensController([token("A")]);

            expect(controller.peek(-1)).toBeNull();

            controller.next();

            expect(controller.peek()).toBeNull();
            expect(controller.peek(999)).toBeNull();
        });
    });

    // -----------------------------------------------------
    // inject()
    // -----------------------------------------------------
    describe("inject()", () => {

        it("injects a token after the current cursor", () => {
            const controller = new TokensController([token("A"), token("C")]);

            controller.next();
            controller.inject(token("B"));

            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("injects multiple tokens in order", () => {
            const controller = new TokensController([token("A"), token("D")]);

            controller.next();

            controller.inject([token("B"), token("C")]);

            expect((controller.next() as MockToken).value).toBe("B");
            expect((controller.next() as MockToken).value).toBe("C");
            expect((controller.next() as MockToken).value).toBe("D");
        });

        it("supports injection before traversal starts", () => {
            const controller = new TokensController([token("B")]);

            controller.inject(token("A"));

            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("supports injection after eof", () => {
            const controller = new TokensController([token("A")]);

            controller.next();
            controller.next();

            controller.inject(token("B"));

            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("does not modify current token", () => {
            const controller = new TokensController([token("A"), token("C")]);

            controller.next();
            controller.inject(token("B"));

            expect((controller.current as MockToken).value).toBe("A");
        });

        it("returns itself for chaining", () => {
            const controller = new TokensController([token("D")]);

            expect(controller.inject(token("A"))).toBe(controller);
        });

        it("ignores empty injections", () => {
            const controller = new TokensController([token("A")]);

            controller.inject([]);

            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("injects at explicit index", () => {
            const controller = new TokensController([
                token("A"),
                token("C"),
                token("D")
            ]);

            controller.next();

            controller.inject(token("B"), { at: 2 });

            expect((controller.next() as MockToken).value).toBe("C");
        });

        it("throws when injecting at index <= cursor", () => {
            const controller = new TokensController([token("A"), token("B")]);

            controller.next();

            expect(() => {
                controller.inject(token("X"), { at: 0 });
            }).toThrow();
        });

        it("throws TypeError for invalid 'at' type", () => {
            const controller = new TokensController([token("A")]);

            controller.next();

            expect(() => {
                controller.inject(token("X"), { at: "invalid" as any });
            }).toThrow(TypeError);
        });

        it("injects after AnchorToken instance", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                token("A"),
                anchor,
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"), { at: anchor });

            expect(controller.next()).toBe(anchor);
            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("injects after AnchorToken symbol id", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                token("A"),
                anchor,
                token("C")
            ]);

            controller.next();

            controller.inject(token("B"), { at: anchor.id });

            expect(controller.next()).toBe(anchor);
            expect((controller.next() as MockToken).value).toBe("B");
        });

        it("throws when anchor is not found", () => {
            const controller = new TokensController([
                token("A"),
                token("B")
            ]);

            controller.next();

            expect(() => {
                controller.inject(token("X"), { at: new AnchorToken("missing") });
            }).toThrow();
        });

        it("throws when anchor is before or at cursor", () => {
            const anchor = new AnchorToken("test");

            const controller = new TokensController([
                anchor,
                token("B")
            ]);

            controller.next();

            expect(() => {
                controller.inject(token("X"), { at: anchor });
            }).toThrow();
        });
    });

    // -----------------------------------------------------
    // rollbackBefore()
    // -----------------------------------------------------
    describe("rollbackBefore()", () => {

        it("restores traversal before cursor", () => {
            const controller = new TokensController([token("A"), token("B"), token("C")]);

            controller.next();
            controller.next();

            controller.rollbackBefore(0);

            expect(controller.cursor).toBe(-1);
            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("supports full reset", () => {
            const controller = new TokensController([token("A"), token("B")]);

            controller.next();

            controller.rollbackBefore(-1);

            expect(controller.cursor).toBe(-1);
        });

        it("removes injected tokens", () => {
            const controller = new TokensController([token("A"), token("C")]);

            controller.next();
            controller.inject(token("B"));

            controller.rollbackBefore(0);

            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("preserves original tokens", () => {
            const controller = new TokensController([token("A"), token("B")]);

            controller.inject(token("X"));

            controller.rollbackBefore(-1);

            expect((controller.next() as MockToken).value).toBe("A");
        });

        it("clamps rollback cursor", () => {
            const controller = new TokensController([token("A")]);

            controller.rollbackBefore(999);

            expect(controller.cursor).toBe(-1);
        });
    });

    // -----------------------------------------------------
    // inspect()
    // -----------------------------------------------------
    describe("inspect()", () => {

        it("returns raw kind list", () => {
            const ct = new TokensController([token("A"), token("B")]);

            expect(TokensController.inspect(ct)).toEqual(["literal", "literal"]);
        });

        it("returns with-origin representation", () => {
            const ct = new TokensController([token("A")]);

            ct.inject(token("B"));

            const result = TokensController.inspect(ct, "with-origin");

            expect(result).toEqual(
                expect.arrayContaining([
                    "literal:O",
                    "literal:I"
                ])
            );
        });
    });
});

type MockToken = {
    kind: string;
    value: string;
};

function token(value: string): Token {
    return {
        kind: "literal",
        value
    } as any;
}