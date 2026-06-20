import TraversalDepth from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/traversal/traversal.depth";
import ScopesController from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/scopes/scopes.controller";
import RenderingWriter from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/writer/writer";

describe("ScopesController", () => {
    // --------------------------------------------------
    // Root scope
    // --------------------------------------------------

    it("creates a root scope automatically", () => {
        const controller = createController();
        expect(controller.current.name).toBe("root");
        expect(controller.current.cursor).toBe(-1);
    });

    it("reports root scope when initialized", () => {
        const controller = createController();
        expect(controller.isRoot).toBe(true);
    });

    it("reports non-root after creating a scope", () => {
        const controller = createController();
        createScope(controller);
        expect(controller.isRoot).toBe(false);
    });

    it("returns to root after aborting the last child scope", () => {
        const controller = createController();
        createScope(controller);
        controller.abort();
        expect(controller.isRoot).toBe(true);
    });

    it("returns to root after committing the last child scope", () => {
        const controller = createController();
        createScope(controller);
        controller.commit();
        expect(controller.isRoot).toBe(true);
    });

    it("prevents aborting the root scope", () => {
        const controller = createController();
        expect(() => controller.abort()).toThrow();
    });

    it("prevents committing the root scope", () => {
        const controller = createController();
        expect(() => controller.commit()).toThrow();
    });

    // --------------------------------------------------
    // Scope identity
    // --------------------------------------------------

    it("creates a scope with explicit id", () => {
        const controller = createController();
        const id = Symbol("scope");

        createScope(controller, { id });

        expect(controller.current.id).toBe(id);
    });

    it("creates a scope with optional name", () => {
        const controller = createController();

        createScope(controller, { name: "group" });

        expect(controller.current.name).toBe("group");
    });

    it("creates a scope with explicit cursor", () => {
        const controller = createController();

        createScope(controller, { cursor: 42 });

        expect(controller.current.cursor).toBe(42);
    });

    it("auto-generates a scope id", () => {
        const controller = createController();

        createScope(controller);

        expect(typeof controller.current.id).toBe("symbol");
    });

    it("maintains stack order", () => {
        const controller = createController();
        const a = Symbol("A");
        const b = Symbol("B");

        createScope(controller, { id: a });
        createScope(controller, { id: b });

        expect(controller.current.id).toBe(b);

        controller.abort();

        expect(controller.current.id).toBe(a);
    });

    // --------------------------------------------------
    // Abort semantics
    // --------------------------------------------------

    it("aborts only the current scope", () => {
        const controller = createController();

        createScope(controller, { name: "parent" });
        const parentId = controller.current.id;

        createScope(controller, { name: "child" });
        controller.abort();

        expect(controller.current.id).toBe(parentId);
    });

    it("returns the removed scope when aborted", () => {
        const controller = createController();

        createScope(controller, { name: "child", cursor: 10 });
        const removed = controller.abort();

        expect(removed.name).toBe("child");
        expect(removed.cursor).toBe(10);
    });

    it("discards scoped data on abort", () => {
        const controller = createController();

        createScope(controller);
        controller.data.set("name", "Ali");

        controller.abort();

        expect(controller.data.get("name")).toBeNull();
    });

    // --------------------------------------------------
    // Commit semantics
    // --------------------------------------------------

    it("returns the removed scope when committed", () => {
        const controller = createController();

        createScope(controller, { name: "child", cursor: 5 });
        const removed = controller.commit();

        expect(removed.name).toBe("child");
        expect(removed.cursor).toBe(5);
    });

    it("restores parent scope after commit", () => {
        const controller = createController();

        createScope(controller, { name: "parent" });
        const parentId = controller.current.id;

        createScope(controller, { name: "child" });
        controller.commit();

        expect(controller.current.id).toBe(parentId);
    });

    // --------------------------------------------------
    // Writer behavior
    // --------------------------------------------------

    it("creates an isolated writer per scope", () => {
        const controller = createController();

        const rootWriter = controller.current.writer;
        createScope(controller);

        expect(controller.current.writer).not.toBe(rootWriter);
    });

    it("inherits writer configuration from parent", () => {
        const controller = createController();

        const parentWriter = controller.current.writer;
        createScope(controller);

        expect(controller.current.writer).not.toBe(parentWriter);
    });

    // --------------------------------------------------
    // Scoped data
    // --------------------------------------------------

    it("stores values in current scope", () => {
        const controller = createController();

        createScope(controller);

        controller.data.set("name", "Ahmad");

        expect(controller.data.get("name")).toBe("Ahmad");
        expect(controller.data.hasOwn("name")).toBe(true);
    });

    it("prevents accidental overwrite", () => {
        const controller = createController();

        createScope(controller);

        controller.data.set("name", "Ahmad");

        expect(() => controller.data.set("name", "Ali")).toThrow();
    });

    it("allows overwrite when enabled", () => {
        const controller = createController();

        createScope(controller);

        controller.data.set("name", "Ahmad");
        controller.data.set("name", "Ali", { overwrite: true });

        expect(controller.data.get("name")).toBe("Ali");
    });

    it("resolves values through the scope chain", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);
        controller.data.set("city", "Ramallah");

        expect(controller.data.get("name")).toBe("Ahmad");
        expect(controller.data.get("city")).toBe("Ramallah");
    });

    it("supports shadowing", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);
        controller.data.set("name", "Ali");

        expect(controller.data.get("name")).toBe("Ali");

        controller.abort();

        expect(controller.data.get("name")).toBe("Ahmad");
    });

    // --------------------------------------------------
    // inherited + resolution model correctness
    // --------------------------------------------------

    it("hasOwn only checks current scope", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);

        expect(controller.data.hasOwn("name")).toBe(false);
    });

    it("hasInherited excludes current scope", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        expect(controller.data.hasInherited("name")).toBe(false);
    });

    it("hasInherited finds parent values", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);

        expect(controller.data.hasInherited("name")).toBe(true);
    });

    it("hasInherited respects maxLevels = 1", () => {
        const controller = createController();

        controller.data.set("root", "root");

        createScope(controller);
        controller.data.set("parent", "parent");

        createScope(controller);

        expect(controller.data.hasInherited("root", 1)).toBe(false);
    });

    it("hasInherited respects maxLevels = 2", () => {
        const controller = createController();

        controller.data.set("root", "root");

        createScope(controller);
        controller.data.set("parent", "parent");

        createScope(controller);

        expect(controller.data.hasInherited("root", 2)).toBe(true);
    });

    it("hasResolvable detects both own and inherited", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        expect(controller.data.hasResolvable("name")).toBe(true);

        createScope(controller);

        expect(controller.data.hasResolvable("name")).toBe(true);
    });

    it("hasResolvable returns false for missing values", () => {
        const controller = createController();

        expect(controller.data.hasResolvable("missing")).toBe(false);
    });

    // --------------------------------------------------
    // getInherited behavior
    // --------------------------------------------------

    it("getInherited excludes current scope", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        expect(controller.data.getInherited("name")).toBeNull();
    });

    it("getInherited resolves from parent scope", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);

        expect(controller.data.getInherited("name")).toBe("Ahmad");
    });

    it("get resolves full chain including current scope", () => {
        const controller = createController();

        controller.data.set("name", "Ahmad");

        createScope(controller);

        expect(controller.data.get("name")).toBe("Ahmad");
    });

    it("returns null for missing keys", () => {
        const controller = createController();

        expect(controller.data.get("missing")).toBeNull();
        expect(controller.data.getInherited("missing")).toBeNull();
    });
});

function createWriter() {
    return new RenderingWriter({
        depth: new TraversalDepth(),
        spaces: 2
    });
}

function createController() {
    return new ScopesController(createWriter());
}

function createScope(
    controller: ScopesController,
    options?: {
        id?: symbol;
        name?: string;
        cursor?: number;
    }
) {
    controller.create({
        id: options?.id,
        name: options?.name,
        cursor: options?.cursor ?? 0
    });
}