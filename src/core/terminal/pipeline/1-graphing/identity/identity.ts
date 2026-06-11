import GRAPH_NODES from "../nodes";
import type { GraphRefNode } from "../types";
import type { GraphRef, TrackableData } from "./types";

/**
 * Runtime graph identity tracker.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `GraphIdentityTracker` is responsible for preserving object identity
 * during graph construction.
 *
 * It guarantees:
 *
 * - shared JS references become shared graph nodes
 * - circular references are detected
 * - graph nodes are allocated only once per JS identity
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * This tracker belongs to the graph construction phase:
 *
 * ```txt
 * JavaScript Values
 *         ↓
 * GraphIdentityTracker
 *         ↓
 * Graph Nodes
 *         ↓
 * Representation Layer
 * ```
 *
 * It is the foundation that enables:
 *
 * - identity-preserving graphs
 * - alias-aware representation trees
 * - reference-aware tokenization
 *
 * ---------------------------------------------------------------------
 * 🔷 TWO DISTINCT TRACKING SYSTEMS
 * ---------------------------------------------------------------------
 *
 * The tracker internally maintains TWO independent systems:
 *
 * ## 1. Identity tracking
 *
 * Managed using:
 *
 * ```ts
 * WeakMap<TrackableData, GraphRef>
 * ```
 *
 * Used for:
 *
 * - preserving shared references
 * - reusing graph nodes
 * - occurrence counting
 *
 * ## 2. Circular traversal tracking
 *
 * Managed using:
 *
 * ```ts
 * WeakSet<TrackableData>
 * ```
 *
 * Used for:
 *
 * - detecting active traversal recursion
 * - identifying circular structures
 *
 * These are intentionally separate concepts.
 *
 * ---------------------------------------------------------------------
 * 🔷 SHARED REFERENCES
 * ---------------------------------------------------------------------
 *
 * Shared references are preserved.
 *
 * Example:
 *
 * ```ts
 * const shared = [1, 2];
 *
 * const obj = {
 *   x: shared,
 *   y: shared
 * };
 * ```
 *
 * Both:
 *
 * ```txt
 * x
 * y
 * ```
 *
 * will reference the SAME graph node.
 *
 * ---------------------------------------------------------------------
 * 🔷 CIRCULAR REFERENCES
 * ---------------------------------------------------------------------
 *
 * Circular references are detected using active traversal tracking.
 *
 * Example:
 *
 * ```ts
 * const a = {};
 * a.self = a;
 * ```
 *
 * During traversal:
 *
 * ```txt
 * a → self → a
 * ```
 *
 * the second encounter occurs while `a` is still active in the
 * traversal branch, therefore:
 *
 * ```txt
 * circular === true
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT DISTINCTION
 * ---------------------------------------------------------------------
 *
 * Shared references are NOT circular references.
 *
 * Example:
 *
 * ```ts
 * const shared = {};
 *
 * {
 *   a: shared,
 *   b: shared
 * }
 * ```
 *
 * is NOT circular because the second encounter occurs AFTER the
 * first traversal branch completed.
 *
 * ---------------------------------------------------------------------
 * 🔷 MEMORY SAFETY
 * ---------------------------------------------------------------------
 *
 * Weak collections are intentionally used:
 *
 * - `WeakMap`
 * - `WeakSet`
 *
 * This ensures tracking metadata does not prevent garbage collection.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * The tracker is optimized for:
 *
 * - deterministic graph construction
 * - identity preservation
 * - efficient node reuse
 * - recursion safety
 * - serializer pipeline consistency
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class GraphIdentityTracker {
    /**
     * Internal reference tracking primitive.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * `#_refs` preserves graph identity mappings between original runtime
     * JavaScript values and their corresponding graph nodes.
     *
     * This is the core mechanism enabling:
     *
     * - shared graph node reuse
     * - occurrence counting
     * - identity-preserving graph construction
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURE
     * ---------------------------------------------------------------------
     *
     * Implemented as:
     *
     * ```ts
     * WeakMap<TrackableData, GraphRef>
     * ```
     *
     * Where:
     *
     * - key   → original JavaScript reference
     * - value → graph identity metadata
     *
     * Example:
     *
     * ```ts
     * const shared = {};
     *
     * {
     *   a: shared,
     *   b: shared
     * }
     * ```
     *
     * Both `a` and `b` resolve to the SAME graph node because the same
     * JS reference maps to the same `GraphRef`.
     *
     * ---------------------------------------------------------------------
     * 🔷 OCCURRENCE COUNTING
     * ---------------------------------------------------------------------
     *
     * Each identity record tracks:
     *
     * ```ts
     * {
     *   node,
     *   count
     * }
     * ```
     *
     * allowing downstream systems to:
     *
     * - detect repeated references
     * - encode aliases
     * - generate reference tokens
     * - support serializer reference strategies
     *
     * ---------------------------------------------------------------------
     * 🔷 MEMORY SAFETY
     * ---------------------------------------------------------------------
     *
     * `WeakMap` is intentionally used so graph tracking metadata does not
     * prevent garbage collection of runtime objects.
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_refs = new WeakMap<TrackableData, GraphRef>();

    /**
     * Active traversal recursion tracker.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * `#_cyclic` tracks values currently being traversed in the ACTIVE
     * recursive branch of graph construction.
     *
     * This is used exclusively for:
     *
     * - circular reference detection
     * - recursion safety
     * - infinite recursion prevention
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT DISTINCTION
     * ---------------------------------------------------------------------
     *
     * This tracker does NOT preserve identity.
     *
     * Identity preservation is handled independently by:
     *
     * ```ts
     * #_refs
     * ```
     *
     * Instead, this set only answers:
     *
     * ```txt
     * "Is this value currently active in the recursion stack?"
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 CIRCULAR DETECTION MODEL
     * ---------------------------------------------------------------------
     *
     * Example:
     *
     * ```ts
     * const a = {};
     * a.self = a;
     * ```
     *
     * Traversal:
     *
     * ```txt
     * a
     * └── self
     *     └── a (already active)
     * ```
     *
     * The second encounter is considered circular because `a`
     * already exists inside the active traversal branch.
     *
     * ---------------------------------------------------------------------
     * 🔷 SHARED REFERENCES
     * ---------------------------------------------------------------------
     *
     * Shared references are NOT circular:
     *
     * ```ts
     * const shared = {};
     *
     * {
     *   a: shared,
     *   b: shared
     * }
     * ```
     *
     * because:
     *
     * - traversal of `a` completes
     * - `shared` is released
     * - traversal of `b` begins afterward
     *
     * therefore:
     *
     * ```txt
     * circular === false
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * Values are:
     *
     * - added when traversal begins
     * - removed via {@link release()}
     *
     * usually inside `finally` blocks to guarantee consistency.
     *
     * ---------------------------------------------------------------------
     * 🔷 MEMORY SAFETY
     * ---------------------------------------------------------------------
     *
     * `WeakSet` ensures traversal metadata does not retain runtime objects.
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_cyclic = new WeakSet<TrackableData>();

    /**
     * Internal identity tracking pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * `#_trackRef()` is the core identity resolution mechanism used during
     * graph construction.
     *
     * It:
     *
     * - preserves graph identity
     * - allocates graph nodes lazily
     * - detects repeated references
     * - detects active circular traversal
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * The method performs:
     *
     * 1. Existing identity lookup
     * 2. Circular traversal detection
     * 3. Graph node allocation (if needed)
     * 4. Occurrence counting
     *
     * ---------------------------------------------------------------------
     * 🔷 FIRST ENCOUNTER
     * ---------------------------------------------------------------------
     *
     * When a value is encountered for the first time:
     *
     * - a graph node is allocated
     * - the value/node pair is stored
     * - traversal becomes active
     *
     * Result:
     *
     * ```ts
     * {
     *   firstSeen: true,
     *   circular: false
     * }
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 REPEATED ENCOUNTERS
     * ---------------------------------------------------------------------
     *
     * When the value already exists:
     *
     * - the existing graph node is reused
     * - occurrence count increases
     *
     * This guarantees:
     *
     * ```txt
     * shared JS reference
     *          ↓
     * shared graph node
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 CIRCULAR DETECTION
     * ---------------------------------------------------------------------
     *
     * Circularity is determined independently using:
     *
     * ```ts
     * #_cyclic.has(value)
     * ```
     *
     * Meaning:
     *
     * - repeated reference ≠ circular reference
     * - only ACTIVE recursion branches are circular
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * ---------------------------------------------------------------------
     *
     * Returned tracking metadata is frozen using:
     *
     * ```ts
     * Object.freeze(...)
     * ```
     *
     * preventing accidental mutation during graph construction.
     *
     * ---------------------------------------------------------------------
     * 🔷 TYPE SAFETY
     * ---------------------------------------------------------------------
     *
     * The generic:
     *
     * ```ts
     * <T extends GraphRefNode>
     * ```
     *
     * preserves exact node typing based on the supplied factory.
     *
     * ---------------------------------------------------------------------
     *
     * @param value - Runtime reference-capable value.
     * @param factory - Graph node factory for the tracked value type.
     *
     * @returns Immutable tracking metadata describing:
     * - identity state
     * - circular state
     * - occurrence count
     * - graph node reference
     *
     * @internal
     * @since 1.0.0
     */
    #_trackRef<T extends GraphRefNode>(
        value: object,
        factory: (...args: any[]) => T
    ) {
        if (this.#_refs.has(value)) {
            const ref = this.#_refs.get(value)!

            const res = {
                node: ref.node as T,
                count: ++ref.count,
                firstSeen: false,
                circular: this.#_cyclic.has(value),
            }

            return Object.freeze(res);
        } else {
            const node = factory(value);
            const res = {
                firstSeen: true,
                circular: false,
                count: 1,
                node,
            }

            this.#_cyclic.add(value);
            this.#_refs.set(value, { node, count: 1 });

            return Object.freeze(res);
        }
    }

    /**
     * Graph identity tracking helpers grouped by runtime type.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * `track` provides specialized identity tracking entry points for all
     * reference-capable graph node categories.
     *
     * Each helper:
     *
     * - resolves graph identity
     * - allocates graph nodes lazily
     * - preserves shared references
     * - detects circular traversal
     *
     * ---------------------------------------------------------------------
     * 🔷 SUPPORTED TYPES
     * ---------------------------------------------------------------------
     *
     * Supported tracked structures:
     *
     * - arrays
     * - functions
     * - maps
     * - objects
     * - sets
     * - errors
     *
     * Primitive values are intentionally excluded because primitives
     * do not possess meaningful runtime reference identity in JavaScript.
     *
     * ---------------------------------------------------------------------
     * 🔷 NODE REUSE
     * ---------------------------------------------------------------------
     *
     * If the same runtime reference is encountered multiple times:
     *
     * ```ts
     * x === y
     * ```
     *
     * then:
     *
     * ```txt
     * track.x(...)
     * ```
     *
     * returns the SAME graph node instance.
     *
     * ---------------------------------------------------------------------
     * 🔷 FACTORY BINDING
     * ---------------------------------------------------------------------
     *
     * Each helper binds directly to its corresponding graph node factory:
     *
     * ```ts
     * GRAPH_NODES.Array.create
     * GRAPH_NODES.Object.create
     * ```
     *
     * ensuring exact graph node typing.
     *
     * ---------------------------------------------------------------------
     * 🔷 PIPELINE ROLE
     * ---------------------------------------------------------------------
     *
     * These helpers form the identity boundary between:
     *
     * ```txt
     * runtime JS references
     *         ↓
     * graph node identities
     * ```
     *
     * enabling downstream phases to preserve structural aliasing safely.
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    readonly track = {
        array: (value: any[]) => this.#_trackRef(value, GRAPH_NODES.Array.create),
        function: (value: Function) => this.#_trackRef(value, GRAPH_NODES.Function.create),
        map: (value: Map<any, any>) => this.#_trackRef(value, GRAPH_NODES.Map.create),
        object: (value: Object) => this.#_trackRef(value, GRAPH_NODES.Object.create),
        set: (value: Set<any>) => this.#_trackRef(value, GRAPH_NODES.Set.create),
        error: (value: Error) => this.#_trackRef(value, GRAPH_NODES.Error.create),
    }

    /**
     * Releases a value from the active traversal recursion set.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Removes a runtime value from:
     *
     * ```ts
     * #_cyclic
     * ```
     *
     * indicating that traversal of the current recursion branch has
     * completed safely.
     *
     * ---------------------------------------------------------------------
     * 🔷 WHY THIS MATTERS
     * ---------------------------------------------------------------------
     *
     * Circular detection is branch-sensitive.
     *
     * A value must only be considered circular while actively being
     * traversed.
     *
     * Once traversal completes:
     *
     * - the value is released
     * - future encounters become valid shared references
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * const shared = {};
     *
     * {
     *   a: shared,
     *   b: shared
     * }
     * ```
     *
     * Traversal of `a`:
     *
     * ```txt
     * add(shared)
     * process(shared)
     * release(shared)
     * ```
     *
     * Later traversal of `b`:
     *
     * ```txt
     * shared is no longer active
     * therefore NOT circular
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION SAFETY
     * ---------------------------------------------------------------------
     *
     * Typically called inside:
     *
     * ```ts
     * finally { ... }
     * ```
     *
     * blocks to guarantee cleanup even when exceptions occur.
     *
     * ---------------------------------------------------------------------
     *
     * @param value - Runtime reference-capable value to release.
     *
     * @returns `true` if the value existed in the active traversal set.
     *
     * @since 1.0.0
     */
    release(value: TrackableData): boolean {
        return this.#_cyclic.delete(value);
    }
}

export default GraphIdentityTracker;