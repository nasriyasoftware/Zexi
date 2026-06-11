import TraversalDepth from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";
import TokensController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/tokens/tokens.controller";
import ScopesController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/scopes/scopes.controller";
import ScopesRuntime from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/scopes/runtime";
import RenderingWriter from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/writer/writer";

function token(value: string): any {
    return {
        type: "literal",
        value
    };
}

type MockedToken = {
    type: string;
    value: string;
};

describe("ScopesRuntime", () => {

    function createRuntime() {
        const tokens = new TokensController([]);
        const scopes = new ScopesController(
            new RenderingWriter({
                depth: new TraversalDepth(),
                spaces: 2
            })
        );

        return {
            runtime: new ScopesRuntime(scopes, tokens),
            scopes,
            tokens
        };
    }

    it("reports root scope when initialized", () => {
        const { runtime } = createRuntime();

        expect(runtime.isRoot).toBe(true);
    });

    it("reports non-root after beginning a scope", () => {
        const { runtime } = createRuntime();

        runtime.begin();

        expect(runtime.isRoot).toBe(false);
    });

    it("returns to root after aborting the last scope", () => {
        const { runtime } = createRuntime();

        runtime.begin();

        runtime.abort();

        expect(runtime.isRoot).toBe(true);
    });

    it("returns to root after committing the last scope", () => {
        const { runtime } = createRuntime();

        runtime.begin();

        runtime.commit();

        expect(runtime.isRoot).toBe(true);
    });

    it("captures the current cursor when beginning a scope", () => {
        const tokens = new TokensController([
            token("A"),
            token("B")
        ]);

        tokens.next(); // cursor = 0

        const scopes = new ScopesController(
            new RenderingWriter({
                depth: new TraversalDepth(),
                spaces: 2
            })
        );

        const runtime = new ScopesRuntime(scopes, tokens);

        runtime.begin({
            name: "group"
        });

        expect(scopes.current.cursor).toBe(0);
    });

    it("creates a scope with provided metadata", () => {
        const { runtime, scopes } = createRuntime();

        runtime.begin({
            name: "group"
        });

        expect(scopes.current.name).toBe("group");
    });

    it("aborts a scope and rolls traversal back to its checkpoint", () => {
        const tokens = new TokensController([
            token("A"),
            token("C")
        ]);

        const scopes = new ScopesController(
            new RenderingWriter({
                depth: new TraversalDepth(),
                spaces: 2
            })
        );

        const runtime = new ScopesRuntime(scopes, tokens);

        tokens.next(); // A

        runtime.begin({
            name: "speculative"
        });

        tokens.inject(token("B"));
        tokens.next(); // B

        runtime.abort();

        expect((tokens.next() as MockedToken).value).toBe("A");
        expect((tokens.next() as MockedToken).value).toBe("C");
    });

    it("removes all injected tokens created after the checkpoint during abort", () => {
        const tokens = new TokensController([
            token("A"),
            token("D")
        ]);

        const scopes = new ScopesController(
            new RenderingWriter({
                depth: new TraversalDepth(),
                spaces: 2
            })
        );

        const runtime = new ScopesRuntime(scopes, tokens);

        tokens.next(); // A

        runtime.begin({});

        tokens.inject([
            token("B"),
            token("C")
        ]);

        runtime.abort();

        expect((tokens.next() as MockedToken).value).toBe("A");
        expect((tokens.next() as MockedToken).value).toBe("D");
    });

    it("commits a scope without rolling traversal back", () => {
        const tokens = new TokensController([
            token("A"),
            token("C")
        ]);

        const scopes = new ScopesController(
            new RenderingWriter({
                depth: new TraversalDepth(),
                spaces: 2
            })
        );

        const runtime = new ScopesRuntime(scopes, tokens);

        tokens.next(); // A

        runtime.begin({});

        tokens.inject(token("B"));

        runtime.commit();

        expect((tokens.next() as MockedToken).value).toBe("B");
        expect((tokens.next() as MockedToken).value).toBe("C");
    });

    it("restores the parent scope after abort", () => {
        const { runtime, scopes } = createRuntime();

        runtime.begin({
            name: "parent"
        });

        const parentId = scopes.current.id;

        runtime.begin({
            name: "child"
        });

        runtime.abort();

        expect(scopes.current.id).toBe(parentId);
    });

    it("restores the parent scope after commit", () => {
        const { runtime, scopes } = createRuntime();

        runtime.begin({
            name: "parent"
        });

        const parentId = scopes.current.id;

        runtime.begin({
            name: "child"
        });

        runtime.commit();

        expect(scopes.current.id).toBe(parentId);
    });

    it("throws when aborting the root scope", () => {
        const { runtime } = createRuntime();

        expect(() => {
            runtime.abort();
        }).toThrow();
    });

    it("throws when committing the root scope", () => {
        const { runtime } = createRuntime();

        expect(() => {
            runtime.commit();
        }).toThrow();
    });
});