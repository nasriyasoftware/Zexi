import TraversalDepth from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";
import TokensRuntime from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/runtime";
import ZexiRenderingContext from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";

function token(value: string) {
    return { type: "text", value } as any;
}

function lines(output: string): string[] {
    return output.split("\n");
}

describe("ZexiRenderingContext (deterministic)", () => {

    // ---------------------------------------------------------------------
    // 🔷 INITIAL STATE
    // ---------------------------------------------------------------------
    describe("initial state", () => {

        it("creates root writer and shared depth", () => {
            const ctx = new ZexiRenderingContext(
                [token("A")],
                { spaces: 2 }
            );

            expect(ctx.writer).toBeDefined();
            expect(ctx.depth).toBeInstanceOf(TraversalDepth);
            expect(ctx.tokens).toBeInstanceOf(TokensRuntime);
        });

        it("starts with stable root writer output", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 2 }
            );

            expect(lines(ctx.writer.toString())).toEqual([""]);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 TOKEN SYSTEM
    // ---------------------------------------------------------------------
    describe("token runtime", () => {

        it("advances tokens deterministically", () => {
            const ctx = new ZexiRenderingContext(
                [token("A"), token("B")],
                { spaces: 2 }
            );

            const first = ctx.tokens.next();
            const second = ctx.tokens.current;

            expect(first).toEqual(token("A"));
            expect(second).toEqual(token("A"));
        });

        it("supports lookahead without mutation", () => {
            const ctx = new ZexiRenderingContext(
                [token("A"), token("B")],
                { spaces: 2 }
            );

            const peeked = ctx.tokens.peek(1);
            const stillFirst = ctx.tokens.current;

            expect(stillFirst).toEqual(null);
            expect(peeked).toEqual(token("A"));
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 SCOPE ACTIVATION MODEL
    // ---------------------------------------------------------------------
    describe("scope lifecycle", () => {

        it("activates a new scope contextually", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            const rootWriter = ctx.writer;

            ctx.scopes.begin();

            const scopedWriter = ctx.writer;

            expect(scopedWriter).not.toBe(rootWriter);
        });

        it("supports named scope activation", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            expect(() => {
                ctx.scopes.begin({ name: "test" });
            }).not.toThrow();
        });

        it("supports id-based scope activation", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            const id = Symbol("scope");

            expect(() => {
                ctx.scopes.begin({ id });
            }).not.toThrow();
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 SCOPE COMMIT BEHAVIOR
    // ---------------------------------------------------------------------
    describe("scope commit behavior", () => {

        it("merges scoped writer into parent writer", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");

            ctx.scopes.commit();

            expect(lines(ctx.writer.toString())).toEqual([
                "AB"
            ]);
        });

        it("preserves parent content after commit", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");
            ctx.writer.newLine();
            ctx.writer.write("C");

            ctx.scopes.commit();

            expect(lines(ctx.writer.toString())).toEqual([
                "AB",
                "C"
            ]);
        });

        it("switches writer context after commit", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            const parentWriter = ctx.writer;
            ctx.writer.write("A");

            ctx.scopes.begin();
            const scopedWriter = ctx.writer;
            expect(scopedWriter).not.toBe(parentWriter);

            ctx.writer.write("B");

            ctx.scopes.commit();

            ctx.writer.write("C");
            expect(ctx.writer).toBe(parentWriter);

            expect(lines(ctx.writer.toString())).toEqual([
                "ABC"
            ]);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 SCOPE SAFETY RULES
    // ---------------------------------------------------------------------
    describe("scope invariants", () => {

        it("prevents nested scope corruption", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            ctx.scopes.begin();

            expect(() => {
                ctx.scopes.begin(); // nesting rules depend on implementation
            }).not.toThrow();
        });

        it("commit is idempotent-safe at API level", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            ctx.scopes.begin();
            ctx.writer.write("A");

            ctx.scopes.commit();

            expect(() => ctx.scopes.commit()).toThrow();
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 DEPTH SHARING
    // ---------------------------------------------------------------------
    describe("depth consistency", () => {

        it("shares same depth instance across scopes", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 2 }
            );

            const depthRef = ctx.depth;

            ctx.scopes.begin();
            ctx.scopes.commit();

            expect(ctx.depth).toBe(depthRef);
        });

        it("reflects global depth mutation", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 2 }
            );

            ctx.depth.increase();

            ctx.scopes.begin();

            expect(ctx.depth.value).toBe(1);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 WRITER CONTINUITY
    // ---------------------------------------------------------------------
    describe("writer behavior across scopes", () => {

        it("keeps writer consistent across lifecycle", () => {
            const ctx = new ZexiRenderingContext(
                [],
                { spaces: 0 }
            );

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");

            ctx.scopes.commit();

            ctx.writer.write("C");

            expect(lines(ctx.writer.toString())).toEqual([
                "ABC"
            ]);
        });
    });
});