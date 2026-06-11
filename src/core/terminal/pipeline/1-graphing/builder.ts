import GRAPH_NODES from "./nodes";
import CircularReferenceError from "./identity/circular.error";
import GraphIdentityTracker from "./identity/identity";
import buildStack from "./helpers/build.stack";
import type { GraphConfig } from "../4-rendering/types/types";
import type { ErrorGraphNodeData, GraphNode } from "./types";
import PropsExtractor from "./helpers/props.extractor";

/**
 * Recursive JavaScript → Graph transformation engine.
 *
 * `GraphBuilder` is the foundational structural normalization phase
 * of the terminal inspection pipeline.
 *
 * It transforms arbitrary JavaScript runtime values into a deterministic,
 * traversable graph composed entirely of typed `GraphNode` instances.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * The graph builder represents the FIRST semantic transformation phase:
 *
 * ```text
 * JavaScript Runtime Values
 *              ↓
 * GraphBuilder
 *              ↓
 * Graph Nodes
 *              ↓
 * Representation Layer
 *              ↓
 * Representation Nodes
 *              ↓
 * Tokenization Layer
 *              ↓
 * Tokens
 *              ↓
 * Rendering / Serialization
 *              ↓
 * Output
 * ```
 *
 * This phase converts unsafe, recursive, runtime-native JavaScript
 * structures into a deterministic graph abstraction suitable for
 * downstream rendering systems.
 *
 * ---------------------------------------------------------------------
 * 🔷 PRIMARY RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * The graph builder is responsible for:
 *
 * - runtime type detection
 * - structural normalization
 * - recursive traversal
 * - graph node allocation
 * - graph identity preservation
 * - circular reference detection
 * - shared reference preservation
 * - prototype descriptor extraction
 * - `toJSON()` transformations
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH MODEL
 * ---------------------------------------------------------------------
 *
 * Every traversed runtime value becomes either:
 *
 * - a primitive graph node
 * - a reference-capable graph node
 *
 * Primitive values:
 *
 * ```txt
 * string
 * number
 * bigint
 * boolean
 * symbol
 * null
 * undefined
 * ```
 *
 * are copied by value and therefore produce independent graph nodes.
 *
 * Reference-capable runtime values:
 *
 * ```txt
 * Array
 * Object
 * Map
 * Set
 * Function
 * Error
 * ```
 *
 * preserve graph identity.
 *
 * ---------------------------------------------------------------------
 * 🔷 CANONICAL MODE (DETERMINISTIC ORDERING)
 * ---------------------------------------------------------------------
 *
 * When `GraphConfig.canonical = true`, object traversal order is
 * normalized to guarantee deterministic output.
 *
 * This affects:
 *
 * ### 1. Object.entries traversal
 *
 * Keys are sorted lexicographically:
 *
 * ```ts
 * { b: 1, a: 2 } → { a: 2, b: 1 }
 * ```
 *
 * ### 2. Property descriptor traversal
 *
 * Getter/setter/value descriptors are also sorted using the same rule.
 *
 * ---------------------------------------------------------------------
 * 🔷 WHY THIS EXISTS
 * ---------------------------------------------------------------------
 *
 * JavaScript does NOT guarantee stable object property ordering across:
 *
 * - construction styles
 * - reflection APIs
 * - engine optimizations
 *
 * Canonical mode ensures:
 *
 * - reproducible serialization
 * - stable testing behavior
 * - deterministic rendering pipelines
 * - consistent hashing of graphs
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT SEMANTIC NOTE
 * ---------------------------------------------------------------------
 *
 * Canonical ordering is a PURE SERIALIZATION CONCERN.
 *
 * It does NOT modify:
 *
 * - runtime object semantics
 * - prototype behavior
 * - property descriptors
 * - execution logic
 *
 * It only affects traversal order during graph construction.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * One of the most important responsibilities of `GraphBuilder`
 * is preserving structural identity across the graph.
 *
 * Identity preservation is based on:
 *
 * ```ts
 * JS runtime reference identity
 * ```
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
 * During graphing:
 *
 * ```txt
 * x → ArrayGraphNode#1
 * y → ArrayGraphNode#1
 * ```
 *
 * Both properties reference the SAME graph node instance.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT DISTINCTION
 * ---------------------------------------------------------------------
 *
 * The graph builder preserves:
 *
 * ```txt
 * structural identity
 * ```
 *
 * NOT:
 *
 * ```txt
 * runtime object references
 * ```
 *
 * After graph construction:
 *
 * - the original JS references are discarded
 * - graph nodes become the new identity system
 * - downstream phases operate purely on graph identity
 *
 * ---------------------------------------------------------------------
 * 🔷 SHARED REFERENCES
 * ---------------------------------------------------------------------
 *
 * Shared references are intentionally preserved.
 *
 * Example:
 *
 * ```ts
 * const prefs = [1, 2];
 *
 * {
 *   a: prefs,
 *   b: prefs
 * }
 * ```
 *
 * Results in:
 *
 * ```txt
 * a === b (graph identity)
 * ```
 *
 * meaning:
 *
 * ```ts
 * nodeA === nodeB
 * ```
 *
 * This behavior is essential for:
 *
 * - reference-aware tokenization
 * - duplicate structure collapsing
 * - serializer reference semantics
 * - deterministic identity tracking
 *
 * ---------------------------------------------------------------------
 * 🔷 CIRCULAR REFERENCE SAFETY
 * ---------------------------------------------------------------------
 *
 * Circular references are detected using
 * {@link GraphIdentityTracker}.
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
 * the builder detects that:
 *
 * ```txt
 * a
 * ```
 *
 * already exists in the ACTIVE traversal branch.
 *
 * Depending on configuration:
 *
 * - ignore
 * - mark
 * - throw
 *
 * behavior is applied.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT:
 * SHARED ≠ CIRCULAR
 * ---------------------------------------------------------------------
 *
 * Shared references are NOT considered circular.
 *
 * Example:
 *
 * ```ts
 * const shared = {};
 *
 * {
 *   x: shared,
 *   y: shared
 * }
 * ```
 *
 * is valid because:
 *
 * - traversal of `x` completes
 * - the object is released from active recursion tracking
 * - traversal of `y` safely reuses the canonical graph node
 *
 * ---------------------------------------------------------------------
 * 🔷 RECURSION MODEL
 * ---------------------------------------------------------------------
 *
 * The builder recursively traverses:
 *
 * - arrays
 * - maps
 * - sets
 * - objects
 * - prototype chains
 *
 * Every nested structure becomes recursively normalized into graph nodes.
 *
 * ---------------------------------------------------------------------
 * 🔷 OBJECT PROCESSING MODEL
 * ---------------------------------------------------------------------
 *
 * Generic object traversal includes:
 *
 * 1. Own enumerable properties
 * 2. Prototype methods
 * 3. Getters
 * 4. Setters
 * 5. Prototype data properties
 *
 * Property semantics are normalized BEFORE entering representation.
 *
 * ---------------------------------------------------------------------
 * 🔷 SPECIAL OBJECT HANDLING
 * ---------------------------------------------------------------------
 *
 * Dedicated graph nodes exist for:
 *
 * - primitives
 * - arrays
 * - sets
 * - maps
 * - regexp
 * - date
 * - error
 * - function
 * - object
 * - unknown fallback values
 *
 * ---------------------------------------------------------------------
 * 🔷 toJSON SUPPORT
 * ---------------------------------------------------------------------
 *
 * Objects implementing:
 *
 * ```ts
 * toJSON()
 * ```
 *
 * are transformed BEFORE graphing.
 *
 * This allows:
 *
 * - DTO normalization
 * - serializer-controlled structure
 * - external shape projection
 *
 * before graph identity is finalized.
 *
 * ---------------------------------------------------------------------
 * 🔷 LOSSLESS STRUCTURAL MODEL
 * ---------------------------------------------------------------------
 *
 * The graph layer preserves:
 *
 * - structure
 * - hierarchy
 * - ordering
 * - collection semantics
 * - graph identity
 * - shared references
 *
 * while intentionally discarding:
 *
 * - original JS references
 * - runtime mutability semantics
 * - execution semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 DOWNSTREAM PHASE CONTRACT
 * ---------------------------------------------------------------------
 *
 * The graph builder guarantees:
 *
 * - deterministic graph identity
 * - stable recursive topology
 * - canonical shared nodes
 *
 * Downstream phases may therefore:
 *
 * - compare graph node identity directly
 * - preserve aliasing relationships
 * - emit reference-aware tokens
 * - collapse duplicate structures safely
 *
 * ---------------------------------------------------------------------
 * 🔷 PHASE BOUNDARY CLARITY
 * ---------------------------------------------------------------------
 *
 * `GraphBuilder` does NOT:
 *
 * - perform representation formatting
 * - tokenize output
 * - render values
 * - serialize strings
 * - decide visual layouts
 *
 * Its responsibility is STRICTLY:
 *
 * ```txt
 * runtime → graph normalization
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 THREAD SAFETY
 * ---------------------------------------------------------------------
 *
 * Builder instances are stateful due to:
 *
 * - identity tracking
 * - active recursion tracking
 *
 * A single instance should process only one graph build at a time.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class GraphBuilder {
    /**
     * Runtime graph builder configuration.
     *
     * Controls identity and circular reference behavior during
     * recursive graph construction.
     *
     * -----------------------------------------------------------------
     * 🔷 RESPONSIBILITIES
     * -----------------------------------------------------------------
     *
     * The configuration determines how the builder handles:
     *
     * - circular references
     * - shared identities
     * - recursion safety
     * - fallback graph semantics
     *
     * -----------------------------------------------------------------
     * 🔷 CIRCULAR REFERENCE MODES
     * -----------------------------------------------------------------
     *
     * Supported strategies:
     *
     * - `ignore`
     *   Circular branches are replaced with safe fallback primitives.
     *
     * - `mark`
     *   Circular branches become descriptive placeholder primitives.
     *
     * - `throw`
     *   Circular traversal immediately throws an error.
     *
     * -----------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * -----------------------------------------------------------------
     *
     * The configuration reference is immutable after construction.
     *
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_config: GraphConfig;

    /**
     * Internal graph identity tracker.
     *
     * Responsible for:
     *
     * - preserving graph identity
     * - detecting shared references
     * - detecting circular traversal
     * - mapping JS runtime references to graph nodes
     *
     * -----------------------------------------------------------------
     * 🔷 IDENTITY MODEL
     * -----------------------------------------------------------------
     *
     * During graph construction:
     *
     * ```txt
     * JS runtime references
     *            ↓
     * GraphIdentityTracker
     *            ↓
     * Graph nodes
     * ```
     *
     * The tracker guarantees that identical runtime references
     * produce canonical graph node identities.
     *
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT
     * -----------------------------------------------------------------
     *
     * This tracker exists ONLY during graph construction.
     *
     * After graphing:
     *
     * - JS references are discarded
     * - graph nodes become the canonical identity system
     *
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_refs = new GraphIdentityTracker();

    /**
     * Creates a new graph builder instance.
     *
     * -----------------------------------------------------------------
     * 🔷 BUILDER LIFECYCLE
     * -----------------------------------------------------------------
     *
     * Each builder instance owns:
     *
     * - an isolated identity tracker
     * - isolated recursion tracking state
     * - isolated graph traversal context
     *
     * This ensures deterministic graph construction without
     * cross-build contamination.
     *
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT
     * -----------------------------------------------------------------
     *
     * Builder instances are stateful and should not be reused
     * concurrently.
     *
     * -----------------------------------------------------------------
     *
     * @param config - Graph identity and circular reference behavior.
     *
     * @since 1.0.0
     */
    constructor(config: GraphConfig) {
        this.#_config = config;
    }

    /**
     * Internal recursive graph transformation pipeline.
     *
     * Recursively transforms arbitrary runtime values into canonical
     * graph nodes while preserving structural semantics and graph identity.
     *
     * -----------------------------------------------------------------
     * 🔷 PIPELINE RESPONSIBILITIES
     * -----------------------------------------------------------------
     *
     * This method performs:
     *
     * - runtime type detection
     * - graph node allocation
     * - recursive traversal
     * - identity preservation
     * - circular reference detection
     * - prototype extraction
     * - structural normalization
     *
     * -----------------------------------------------------------------
     * 🔷 EXECUTION FLOW
     * -----------------------------------------------------------------
     *
     * The recursive pipeline follows:
     *
     * ```text
     * Primitive Detection
     *        ↓
     * Collection Handling
     *        ↓
     * Special Object Handling
     *        ↓
     * Generic Object Traversal
     *        ↓
     * Fallback Handling
     * ```
     *
     * -----------------------------------------------------------------
     * 🔷 GRAPH IDENTITY PRESERVATION
     * -----------------------------------------------------------------
     *
     * Reference-capable runtime values are tracked using:
     *
     * - WeakMap identity tracking
     * - active recursion tracking
     *
     * If a runtime reference was already graphed:
     *
     * ```txt
     * existing graph node is reused
     * ```
     *
     * instead of allocating a new graph node.
     *
     * -----------------------------------------------------------------
     * 🔷 SHARED REFERENCE EXAMPLE
     * -----------------------------------------------------------------
     *
     * ```ts
     * const shared = [1, 2];
     *
     * {
     *   x: shared,
     *   y: shared
     * }
     * ```
     *
     * Results in:
     *
     * ```txt
     * x → ArrayGraphNode#A
     * y → ArrayGraphNode#A
     * ```
     *
     * NOT:
     *
     * ```txt
     * x → ArrayGraphNode#A
     * y → ArrayGraphNode#B
     * ```
     *
     * -----------------------------------------------------------------
     * 🔷 CIRCULAR REFERENCE DETECTION
     * -----------------------------------------------------------------
     *
     * Active recursion branches are tracked independently from
     * graph identity.
     *
     * This allows:
     *
     * - shared references
     * - identity preservation
     *
     * while still preventing:
     *
     * - infinite recursion
     * - cyclic traversal
     *
     * -----------------------------------------------------------------
     * 🔷 SAFETY GUARANTEES
     * -----------------------------------------------------------------
     *
     * The pipeline guarantees:
     *
     * - deterministic traversal
     * - safe recursion termination
     * - canonical graph identity
     * - branch-safe reference release
     *
     * Reference-capable runtime values are ALWAYS released using:
     *
     * ```ts
     * finally
     * ```
     *
     * ensuring traversal correctness even during exceptions.
     *
     * -----------------------------------------------------------------
     * 🔷 OBJECT PROCESSING
     * -----------------------------------------------------------------
     *
     * Generic object traversal includes:
     *
     * - own enumerable properties
     * - prototype methods
     * - getters
     * - setters
     * - inherited descriptors
     *
     * Property semantics are normalized BEFORE representation.
     * 
     * ---------------------------------------------------------------------
     * 🔷 CANONICAL OBJECT TRAVERSAL
     * ---------------------------------------------------------------------
     *
     * If `config.canonical` is enabled:
     *
     * - `Object.entries(target)` is sorted lexicographically by key
     * - `Object.getOwnPropertyDescriptors(target)` is also sorted
     *
     * This guarantees deterministic traversal order across runs.
     *
     * If disabled, JavaScript engine-defined ordering is preserved.
     * 
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT PHASE BOUNDARY
     * -----------------------------------------------------------------
     *
     * This method only constructs graph topology.
     *
     * It does NOT:
     *
     * - create representation nodes
     * - create tokens
     * - serialize output
     * - render values
     *
     * -----------------------------------------------------------------
     *
     * @param value - Arbitrary runtime value.
     *
     * @returns Canonical graph node representation.
     *
     * @internal
     * @since 1.0.0
     */
    #_process(value: unknown): GraphNode {
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'bigint' ||
            typeof value === 'symbol' ||
            typeof value === 'boolean' ||
            value === null ||
            value === undefined
        ) {
            return GRAPH_NODES.Primitive.create(value);
        }

        if (Array.isArray(value)) {
            try {
                const trackRes = this.#_refs.track.array(value);

                if (trackRes.circular) {
                    switch (this.#_config.cycles) {
                        case 'ignore': {
                            return GRAPH_NODES.Primitive.create(null);
                        }

                        case 'mark': {
                            return GRAPH_NODES.Primitive.create(`[Circular:Array:${trackRes.count}]`);
                        }

                        case 'throw': {
                            throw new CircularReferenceError();
                        }
                    }
                }

                if (trackRes.firstSeen) {
                    for (const item of value) {
                        trackRes.node.add(this.#_process(item));
                    }

                    return trackRes.node;
                } else {
                    return trackRes.node;
                }
            } finally {
                this.#_refs.release(value);
            }
        }

        if (value instanceof Set) {
            try {
                const trackRes = this.#_refs.track.set(value);

                if (trackRes.circular) {
                    switch (this.#_config.cycles) {
                        case 'ignore': {
                            return GRAPH_NODES.Primitive.create(null);
                        }

                        case 'mark': {
                            return GRAPH_NODES.Primitive.create(`[Circular:Set:${trackRes.count}]`);
                        }

                        case 'throw': {
                            throw new CircularReferenceError();
                        }
                    }
                }

                if (trackRes.firstSeen) {
                    for (const item of value) {
                        trackRes.node.add(this.#_process(item));
                    }

                    return trackRes.node;
                } else {
                    return trackRes.node;
                }
            } finally {
                this.#_refs.release(value);
            }
        }

        if (value instanceof Map) {
            try {
                const trackRes = this.#_refs.track.map(value);

                if (trackRes.circular) {
                    switch (this.#_config.cycles) {
                        case 'ignore': {
                            return GRAPH_NODES.Primitive.create(null);
                        }

                        case 'mark': {
                            return GRAPH_NODES.Primitive.create(`[Circular:Map:${trackRes.count}]`);
                        }

                        case 'throw': {
                            throw new CircularReferenceError();
                        }
                    }
                }

                if (trackRes.firstSeen) {
                    for (const [k, v] of value) {
                        const kNode = this.#_process(k);
                        const vNode = this.#_process(v);

                        trackRes.node.add(kNode, vNode);
                    }

                    return trackRes.node;
                } else {
                    return trackRes.node;
                }
            } finally {
                this.#_refs.release(value);
            }
        }

        if (value instanceof RegExp) {
            return GRAPH_NODES.RegExp.create(value);
        }

        if (value instanceof Date) {
            return GRAPH_NODES.Date.create(value);
        }

        if (value instanceof Error) {
            try {
                const trackRes = this.#_refs.track.error(value);

                if (trackRes.circular) {
                    switch (this.#_config.cycles) {
                        case 'ignore': {
                            return GRAPH_NODES.Primitive.create(null);
                        }

                        case 'mark': {
                            const parts = [
                                'Circular',
                                value.name,
                                trackRes.count - 1
                            ];

                            return GRAPH_NODES.Primitive.create(`[${parts.join(':')}]`);
                        }

                        case 'throw': {
                            throw new CircularReferenceError();
                        }
                    }
                }

                if (trackRes.firstSeen) {
                    const data: ErrorGraphNodeData = {
                        name: value.name || 'Error',
                        message: value.message || undefined,
                        cause: value.cause ? this.#_process(value.cause) : undefined,
                        stack: buildStack(value.stack)
                    };

                    trackRes.node.assign(data);

                    return trackRes.node;
                } else {
                    return trackRes.node;
                }
            } finally {
                this.#_refs.release(value);
            }
        }

        if (typeof value === 'function') {
            try {
                const trackRes = this.#_refs.track.function(value);
                return trackRes.node;
            } finally {
                this.#_refs.release(value);
            }
        }

        if (typeof value === 'object') {
            try {
                const trackRes = this.#_refs.track.object(value);

                if (typeof (value as any).toJSON === 'function') {
                    const transformed = (value as any).toJSON();
                    return this.#_process(transformed);
                }

                if (trackRes.circular) {
                    switch (this.#_config.cycles) {
                        case 'ignore': {
                            return GRAPH_NODES.Primitive.create(null);
                        }

                        case 'mark': {
                            const parts = [
                                'Circular',
                                trackRes.node.className,
                                trackRes.count - 1
                            ];

                            return GRAPH_NODES.Primitive.create(`[${parts.join(':')}]`);
                        }

                        case 'throw': {
                            throw new CircularReferenceError();
                        }
                    }
                }

                if (trackRes.firstSeen) {
                    const props = PropsExtractor.extract(value, { canonical: this.#_config.canonical });

                    for (const prop of props) {
                        trackRes.node.add(
                            GRAPH_NODES.Object.createProp(prop.name, prop.kind),
                            this.#_process(prop.value)
                        );
                    }
                    
                    return trackRes.node;
                } else {
                    return trackRes.node;
                }
            } finally {
                this.#_refs.release(value);
            }
        }

        return GRAPH_NODES.Unknown.create(value);
    }

    /**
     * Builds a canonical graph representation from a runtime value.
     *
     * This is the primary public entry point of the graphing phase.
     *
     * -----------------------------------------------------------------
     * 🔷 PIPELINE ROLE
     * -----------------------------------------------------------------
     *
     * This method initiates:
     *
     * ```text
     * JavaScript Runtime
     *        ↓
     * Recursive Graph Normalization
     *        ↓
     * Canonical Graph Tree
     * ```
     *
     * -----------------------------------------------------------------
     * 🔷 OUTPUT GUARANTEES
     * -----------------------------------------------------------------
     *
     * The resulting graph guarantees:
     *
     * - deterministic structure
     * - stable graph identity
     * - preserved shared references
     * - circular safety
     * - renderer-safe traversal
     *
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT
     * -----------------------------------------------------------------
     *
     * After graph construction:
     *
     * - original JS references are discarded
     * - graph nodes become the canonical identity system
     *
     * -----------------------------------------------------------------
     *
     * @param value - Runtime value to graph.
     *
     * @returns Root graph node.
     *
     * @since 1.0.0
     */
    build(value: unknown): GraphNode {
        return this.#_process(value);
    }

    /**
     * Convenience static graph construction helper.
     *
     * Creates an isolated temporary builder instance internally.
     *
     * -----------------------------------------------------------------
     * 🔷 USAGE MODEL
     * -----------------------------------------------------------------
     *
     * Useful for:
     *
     * - one-off graph generation
     * - testing
     * - stateless utility usage
     * - serializer entry points
     *
     * without manually managing builder lifecycle.
     *
     * -----------------------------------------------------------------
     * 🔷 ISOLATION GUARANTEE
     * -----------------------------------------------------------------
     *
     * Each invocation creates:
     *
     * - a fresh identity tracker
     * - fresh recursion tracking
     * - isolated graph state
     *
     * ensuring deterministic independent graph construction.
     *
     * -----------------------------------------------------------------
     *
     * @param value - Runtime value to graph.
     * @param config - Graph identity configuration.
     *
     * @returns Root graph node.
     *
     * @since 1.0.0
     */
    static build(value: unknown, config: GraphConfig): GraphNode {
        return new GraphBuilder(config).build(value);
    }
}

export default GraphBuilder;