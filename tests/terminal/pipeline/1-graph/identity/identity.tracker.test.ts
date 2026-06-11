import GraphIdentityTracker from "../../../../../src/core/terminal/pipeline/1-graphing/identity/identity";
import GRAPH_NODES from "../../../../../src/core/terminal/pipeline/1-graphing/nodes";

/* ------------------------------------------------------------------ */
/* helpers */
/* ------------------------------------------------------------------ */
let tracker: GraphIdentityTracker;
const resetTracker = () => tracker = new GraphIdentityTracker();


/* ------------------------------------------------------------------ */
/* array tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (array)", () => {
    resetTracker();

    it("creates a graph node on first encounter", () => {
        const arr = [1, 2];

        const res = tracker.track.array(arr);

        expect(res.firstSeen).toBe(true);
        expect(res.node).toBeInstanceOf(GRAPH_NODES.Array);
        expect(res.count).toBe(1);
        expect(res.circular).toBe(false);
    });

    it("reuses the same node on repeated reference", () => {
        const arr = [1];

        const first = tracker.track.array(arr);
        const second = tracker.track.array(arr);

        expect(second.firstSeen).toBe(false);
        expect(second.node).toBe(first.node);
        expect(second.count).toBe(2);
    });

    it("detects circular reference while active", () => {
        const arr: any[] = [1];
        arr.push(arr);

        try {
            const main = tracker.track.array(arr);
            expect(main.circular).toBe(false);
            expect(main.firstSeen).toBe(true);
            expect(main.node).toBeInstanceOf(GRAPH_NODES.Array);

            const second = tracker.track.array(arr[1]);
            expect(second.circular).toBe(true);
            expect(second.firstSeen).toBe(false);
            expect(second.node).toBe(main.node);
            expect(second.count).toBe(2);
        } finally {
            tracker.release(arr);
        }
    });

});

/* ------------------------------------------------------------------ */
/* object tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (object)", () => {
    resetTracker();

    it("reuses identical object references", () => {
        const shared = { x: 1 };

        const a = tracker.track.object(shared);
        const b = tracker.track.object(shared);

        expect(a.node).toBe(b.node);
        expect(b.count).toBe(2);
    });

    it("preserves shared identity across multiple parents", () => {
        const shared = { v: 10 };

        const a = tracker.track.object(shared);
        const b = tracker.track.object(shared);

        expect(a.node).toBe(b.node);
    });

});

/* ------------------------------------------------------------------ */
/* function tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (function)", () => {
    resetTracker();

    it("reuses function identity", () => {
        const fn = () => 1;

        const a = tracker.track.function(fn);
        const b = tracker.track.function(fn);

        expect(a.node).toBe(b.node);
        expect(b.count).toBe(2);
    });

});

/* ------------------------------------------------------------------ */
/* set tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (set)", () => {
    resetTracker();

    it("tracks set identity correctly", () => {
        const set = new Set([1, 2]);

        const res = tracker.track.set(set);

        expect(res.node).toBeInstanceOf(GRAPH_NODES.Set);
        expect(res.firstSeen).toBe(true);
    });

});

/* ------------------------------------------------------------------ */
/* map tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (map)", () => {
    resetTracker();

    it("tracks map identity correctly", () => {
        const map = new Map([["a", 1]]);

        const res = tracker.track.map(map);

        expect(res.node).toBeInstanceOf(GRAPH_NODES.Map);
    });

});

/* ------------------------------------------------------------------ */
/* error tracking */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (error)", () => {
    resetTracker();

    it("tracks error identity reuse", () => {
        const err = new Error("boom");

        const a = tracker.track.error(err);
        const b = tracker.track.error(err);

        expect(a.node).toBe(b.node);
    });

});

/* ------------------------------------------------------------------ */
/* circular vs shared distinction */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (cycle semantics)", () => {
    resetTracker();

    it("distinguishes shared references from circular references", () => {
        const shared = {};

        const first = tracker.track.object(shared);

        // simulate separate branch (release removes cyclic state)
        tracker.release(shared);

        const second = tracker.track.object(shared);

        expect(first.node).toBe(second.node);
        expect(first.circular).toBe(false);
        expect(second.circular).toBe(false);
    });

    it("marks circular only when still active in traversal", () => {
        const obj: any = {};
        obj.self = obj;

        const mainRes = tracker.track.object(obj);
        expect(mainRes.circular).toBe(false);

        const res = tracker.track.object(obj.self);
        expect(res.circular).toBe(true);
    });

});

/* ------------------------------------------------------------------ */
/* release behavior */
/* ------------------------------------------------------------------ */

describe("GraphIdentityTracker (release)", () => {
    resetTracker();

    it("removes cyclic state safely", () => {
        const obj = {};

        tracker.track.object(obj);
        const released = tracker.release(obj);

        expect(released).toBe(true);
    });

    it("returns false for unknown values", () => {
        expect(tracker.release({})).toBe(false);
    });

});