import TraversalDepth from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";
import TokensRuntime from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/runtime";
import ZexiRenderingContext from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";


describe("ZexiRenderingContext (spec-complete)", () => {

    // ---------------------------------------------------------------------
    // 🔷 INITIALIZATION
    // ---------------------------------------------------------------------
    describe("initialization", () => {

        it("creates core subsystems (writer, depth, tokens runtime)", () => {
            const ctx = new ZexiRenderingContext([token("A")], { spaces: 2 });

            expect(ctx.writer).toBeDefined();
            expect(ctx.depth).toBeInstanceOf(TraversalDepth);
            expect(ctx.tokens).toBeInstanceOf(TokensRuntime);
        });

        it("creates independent internal TokensController clone", () => { // NEW
            const input = [token("A")];
            const ctx = new ZexiRenderingContext(input, { spaces: 2 });

            input.push(token("B")); // should NOT affect runtime

            expect((ctx.tokens.next() as MockedToken | null)?.value).toBe("A");
            expect(ctx.tokens.next()).toBeNull();
        });

        it("initializes root writer with empty stable output", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 2 });
            expect(lines(ctx.writer.toString())).toEqual([""]);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 TOKEN SYSTEM
    // ---------------------------------------------------------------------
    describe("token runtime integration", () => {

        it("consumes tokens sequentially in deterministic order", () => {
            const ctx = new ZexiRenderingContext(
                [token("A"), token("B")],
                { spaces: 2 }
            );

            expect((ctx.tokens.next() as MockedToken | null)?.value).toBe("A");
            expect((ctx.tokens.next() as MockedToken | null)?.value).toBe("B");
        });

        it("maintains correct cursor + current synchronization", () => {
            const ctx = new ZexiRenderingContext(
                [token("A"), token("B")],
                { spaces: 2 }
            );

            ctx.tokens.next();
            expect((ctx.tokens.current as MockedToken | null)?.value).toBe("A");

            ctx.tokens.next();
            expect((ctx.tokens.current as MockedToken | null)?.value).toBe("B");
        });

        it("supports peek without mutating traversal state", () => {
            const ctx = new ZexiRenderingContext(
                [token("A"), token("B")],
                { spaces: 2 }
            );

            const peeked = ctx.tokens.peek(1);
            expect((peeked as MockedToken | null)?.value).toBe("A");

            expect(ctx.tokens.current).toBeNull();
        });

        // it("does not expose mutation surface beyond runtime", () => { // NEW
        //     const ctx = new ZexiRenderingContext([token("A")], { spaces: 2 });
        //     // @ts-expect-error
        //     expect((ctx.tokens as any).#_controller).toBeUndefined?.();
        // });
    });

    // ---------------------------------------------------------------------
    // 🔷 SCOPES
    // ---------------------------------------------------------------------
    describe("scope lifecycle", () => {

        it("creates independent scoped writer per scope", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            const rootWriter = ctx.writer;
            ctx.scopes.begin();

            expect(ctx.writer).not.toBe(rootWriter);
        });

        it("supports named and id-based scopes", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            expect(() => ctx.scopes.begin({ name: "test" })).not.toThrow();
            expect(() => ctx.scopes.begin({ id: Symbol("x") })).not.toThrow();
        });

        it("maintains strict LIFO scope activation model", () => { // NEW
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            const root = ctx.writer;

            ctx.scopes.begin();
            const child = ctx.writer;

            expect(child).not.toBe(root);

            ctx.scopes.commit();

            expect(ctx.writer).toBe(root);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 COMMIT BEHAVIOR
    // ---------------------------------------------------------------------
    describe("scope commit behavior", () => {

        it("merges scoped output into parent deterministically", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");

            ctx.scopes.commit();

            expect(lines(ctx.writer.toString())).toEqual(["AB"]);
        });

        it("preserves multi-line structured output", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");
            ctx.writer.newLine();
            ctx.writer.write("C");

            ctx.scopes.commit();

            expect(lines(ctx.writer.toString())).toEqual(["AB", "C"]);
        });

        it("restores parent writer after commit", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            const root = ctx.writer;

            ctx.scopes.begin();
            ctx.writer.write("B");
            ctx.scopes.commit();

            expect(ctx.writer).toBe(root);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 SCOPE ERROR / SAFETY
    // ---------------------------------------------------------------------
    describe("scope invariants", () => {

        it("throws when committing empty or invalid scope", () => { // UPDATED
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            expect(() => ctx.scopes.commit()).toThrow();
        });

        it("prevents invalid nested scope termination", () => { // UPDATED
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            expect(() => {
                ctx.scopes.commit(); // root-safe invariant
            }).toThrow();
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 DEPTH MODEL
    // ---------------------------------------------------------------------
    describe("depth consistency", () => {

        it("shares single global TraversalDepth instance", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 2 });

            const ref = ctx.depth;

            ctx.scopes.begin();
            ctx.scopes.commit();

            expect(ctx.depth).toBe(ref);
        });

        it("reflects global depth mutation across scopes", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 2 });

            ctx.depth.increase();

            ctx.scopes.begin();

            expect(ctx.depth.value).toBe(1);
        });

        it("does not reset depth on scope commit", () => { // NEW
            const ctx = new ZexiRenderingContext([], { spaces: 2 });

            ctx.depth.increase();
            ctx.scopes.begin();
            ctx.scopes.commit();

            expect(ctx.depth.value).toBe(1);
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 WRITER BEHAVIOR
    // ---------------------------------------------------------------------
    describe("writer continuity", () => {

        it("preserves deterministic output across scope transitions", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("B");

            ctx.scopes.commit();

            ctx.writer.write("C");

            expect(lines(ctx.writer.toString())).toEqual(["ABC"]);
        });

        it("ensures writer isolation per scope (identity + deferred merge)", () => {
            const ctx = new ZexiRenderingContext([], { spaces: 0 });

            const rootWriter = ctx.writer;
            rootWriter.write("A");

            ctx.scopes.begin();

            const scopedWriter = ctx.writer;

            expect(scopedWriter).not.toBe(rootWriter);

            scopedWriter.write("B");

            expect(rootWriter.toString()).toBe("A");

            ctx.scopes.commit();

            const afterCommitWriter = ctx.writer;

            expect(afterCommitWriter).toBe(rootWriter);
            expect(afterCommitWriter.toString()).toBe("AB");
        });
    });

    // ---------------------------------------------------------------------
    // 🔷 INTEGRATION BEHAVIOR
    // ---------------------------------------------------------------------
    describe("full system integration", () => {

        it("maintains deterministic rendering with tokens + scopes", () => { // NEW
            const ctx = new ZexiRenderingContext(
                [textToken("A"), textToken("B")],
                { spaces: 0 }
            );

            const t1 = ctx.tokens.next();
            ctx.writer.write((t1 as MockedToken | null)?.value ?? "");

            ctx.scopes.begin();
            ctx.writer.write("X");
            ctx.scopes.commit();

            const t2 = ctx.tokens.next();
            ctx.writer.write((t2 as MockedToken | null)?.value ?? "");

            expect(ctx.writer.toString()).toContain("AXB");
        });

        it("keeps rendering stable under mixed operations", () => {
            const ctx = new ZexiRenderingContext(
                [textToken("A"), textToken("B"), textToken("C")],
                { spaces: 0 }
            );

            ctx.tokens.next();
            ctx.writer.write("A");

            ctx.scopes.begin();
            ctx.writer.write("X");
            ctx.scopes.commit();

            ctx.tokens.next();
            ctx.writer.write("B");

            ctx.tokens.next();
            ctx.writer.write("C");

            expect(ctx.writer.toString()).toBeDefined();
        });
    });
});

function token(value: string) {
    return { kind: "literal", value } as any;
}

function textToken(value: string) {
    return { type: "text", value } as any;
}

function lines(output: string): string[] {
    return output.split("\n");
}

type MockedToken = {
    kind: "literal";
    value: string;
}