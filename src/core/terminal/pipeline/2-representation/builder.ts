import REP_NODES from "./nodes";
import GRAPH_NODES from "../1-graphing/nodes";
import type PropertyNode from "../1-graphing/nodes/assets/property.node";
import type { ErrorRepNodeData, RepresentationNode } from "./types";
import type { GraphNode } from "../1-graphing/types";

/**
 * Identity-aware representation builder.
 *
 * Converts low-level structural {@link GraphNode} instances into
 * renderer-oriented {@link RepresentationNode} instances while preserving
 * GRAPH IDENTITY semantics.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * The RepresentationBuilder is the SECOND phase in the pipeline and is
 * responsible for converting GraphNodes into stable, renderer-ready
 * representation trees.
 *
 * Unlike the Graph phase (which tracks JS runtime identity), this phase
 * tracks GRAPH NODE IDENTITY.
 *
 * Meaning:
 *
 * - identical GraphNode instances MUST map to identical RepresentationNodes
 * - repeated traversal of the same GraphNode does NOT create duplicates
 * - structural reuse is preserved across the representation tree
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ARCHITECTURE
 * ---------------------------------------------------------------------
 *
 * ```txt
 * JavaScript Value
 *        ↓
 * GraphBuilder (JS identity tracking)
 *        ↓
 * GraphNode Tree (deduplicated structure)
 *        ↓
 * RepresentationBuilder (GRAPH identity tracking)
 *        ↓
 * RepresentationNode Tree
 *        ↓
 * Tokenization Layer
 *        ↓
 * Rendering Layer
 *        ↓
 * Serialization
 *        ↓
 * Output String
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * This layer uses:
 *
 * ```ts
 * Map<GraphNode, RepresentationNode>
 * ```
 *
 * to ensure:
 *
 * - each GraphNode is transformed exactly once
 * - repeated GraphNode references reuse the same RepresentationNode
 * - structural aliasing is preserved
 *
 * Example:
 *
 * ```ts
 * const shared = [1, 2];
 * const obj = { x: shared, y: shared };
 * ```
 *
 * After representation:
 *
 * - x → ArrayRepresentationNode A
 * - y → SAME ArrayRepresentationNode A
 *
 * NOT two separate arrays.
 *
 * ---------------------------------------------------------------------
 * 🔷 DIFFERENCE FROM GRAPH PHASE
 * ---------------------------------------------------------------------
 *
 * | Phase          | Identity tracked |
 * |----------------|-----------------|
 * | GraphBuilder    | JS runtime refs |
 * | Representation  | GraphNode refs  |
 *
 * GraphBuilder merges JS duplicates.
 * RepresentationBuilder preserves graph-level aliasing.
 *
 * ---------------------------------------------------------------------
 * 🔷 CACHING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * This builder is stateful and memoized:
 *
 * - `#_refs` prevents duplicate representation construction
 * - ensures deterministic reuse across recursion branches
 *
 * This is NOT a performance optimization alone — it is a semantic rule.
 *
 * ---------------------------------------------------------------------
 * 🔷 RECURSION MODEL
 * ---------------------------------------------------------------------
 *
 * Traversal is depth-first and memoized:
 *
 * 1. Check if GraphNode already has RepresentationNode
 * 2. If yes → return cached node immediately
 * 3. If no → construct representation recursively
 * 4. Store mapping before returning
 *
 * This ordering ensures:
 *
 * - cycle safety
 * - structural consistency
 * - reference stability
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * RepresentationNodes are immutable after construction.
 *
 * However:
 *
 * - the builder itself is stateful
 * - reuse is intentional and required for identity correctness
 *
 * ---------------------------------------------------------------------
 * 🔷 LIMITATION / GUARANTEE
 * ---------------------------------------------------------------------
 *
 * This layer guarantees:
 *
 * - no duplicate RepresentationNodes for same GraphNode
 * - stable identity across traversal paths
 *
 * It does NOT:
 *
 * - interpret rendering rules
 * - perform tokenization
 * - flatten or serialize structures
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This layer is the first point where:
 *
 * > structural identity becomes semantic identity
 *
 * Downstream phases (tokenization & rendering) depend on this guarantee.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class RepresentationBuilder {
    /**
     * Graph identity cache.
     *
     * -----------------------------------------------------------------
     * 🔷 PURPOSE
     * -----------------------------------------------------------------
     *
     * Tracks already processed GraphNode → RepresentationNode mappings.
     *
     * This ensures:
     *
     * - each GraphNode is only converted once
     * - repeated GraphNode references reuse the same RepresentationNode
     * - structural aliasing is preserved across the representation tree
     *
     * -----------------------------------------------------------------
     * 🔷 IDENTITY MODEL
     * -----------------------------------------------------------------
     *
     * Key property:
     *
     * ```ts
     * GraphNode === GraphNode (reference equality)
     * ```
     *
     * Value property:
     *
     * ```ts
     * RepresentationNode (cached output)
     * ```
     *
     * This Map is NOT a performance cache — it is a semantic guarantee.
     *
     * -----------------------------------------------------------------
     * 🔷 EFFECT
     * -----------------------------------------------------------------
     *
     * Without this map:
     *
     * - shared GraphNodes would be duplicated
     * - tokenization would lose reference structure
     *
     * With this map:
     *
     * - representation becomes identity-stable
     * - downstream tokenization can safely emit ReferenceTokens
     *
     * -----------------------------------------------------------------
     * @internal
     */
    readonly #_refs = new Map<GraphNode, RepresentationNode>();

    /**
     * Internal recursive graph-to-representation transformer.
     *
     * -----------------------------------------------------------------
     * 🔷 RESPONSIBILITY
     * -----------------------------------------------------------------
     *
     * Converts a single GraphNode into its corresponding
     * RepresentationNode while preserving:
     *
     * - structural recursion
     * - identity reuse
     * - type-specific transformation rules
     *
     * -----------------------------------------------------------------
     * 🔷 IDENTITY RULE
     * -----------------------------------------------------------------
     *
     * Before processing a node:
     *
     * - if node already exists in `#_seen`, return cached result
     *
     * This guarantees:
     *
     * ```ts
     * process(node) === process(node)
     * ```
     *
     * across all traversal paths.
     *
     * -----------------------------------------------------------------
     * 🔷 RECURSION STRATEGY
     * -----------------------------------------------------------------
     *
     * The function performs depth-first traversal:
     *
     * 1. Identify GraphNode type
     * 2. If cached → return immediately
     * 3. Recursively process children
     * 4. Construct RepresentationNode
     * 5. Store in `#_seen`
     * 6. Return result
     *
     * -----------------------------------------------------------------
     * 🔷 WHY CACHE EARLY?
     * -----------------------------------------------------------------
     *
     * The cache is written AFTER child processing begins safely because:
     *
     * - Graph phase already guarantees no circular structures
     * - identity is stable at GraphNode level
     *
     * -----------------------------------------------------------------
     * @internal
     */
    #_process(node: GraphNode): RepresentationNode {
        if (node instanceof GRAPH_NODES.Primitive) {
            return REP_NODES.Primitive.from(node);
        }

        if (node instanceof GRAPH_NODES.Array) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const entries: RepresentationNode[] = [];

            for (const entry of node.value) {
                entries.push(this.#_process(entry));
            }

            const repNode = REP_NODES.Array.create(entries);
            this.#_refs.set(node, repNode);

            return repNode;
        }

        if (node instanceof GRAPH_NODES.Set) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const entries: RepresentationNode[] = [];

            for (const entry of node.value) {
                entries.push(this.#_process(entry));
            }

            const repNode = REP_NODES.Set.create(entries);
            this.#_refs.set(node, repNode);

            return repNode;
        }

        if (node instanceof GRAPH_NODES.Map) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const entries: Map<RepresentationNode, RepresentationNode> = new Map();

            for (const [key, value] of node.value) {
                const k = this.#_process(key);
                const v = this.#_process(value);
                entries.set(k, v);
            }

            const repNode = REP_NODES.Map.create(entries);
            this.#_refs.set(node, repNode);

            return repNode;
        }

        if (node instanceof GRAPH_NODES.RegExp) {
            return REP_NODES.RegExp.from(node);
        }

        if (node instanceof GRAPH_NODES.Date) {
            return REP_NODES.Date.from(node);
        }

        if (node instanceof GRAPH_NODES.Error) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const data: ErrorRepNodeData = {
                name: node.data.name,
                message: node.data.message,
                stack: node.data.stack,
                cause: node.data.cause ? this.#_process(node.data.cause) : undefined
            }
            
            const repNode = REP_NODES.Error.create(data);
            this.#_refs.set(node, repNode);

            return repNode;
        }

        if (node instanceof GRAPH_NODES.Function) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const repNode = REP_NODES.Function.from(node);
            this.#_refs.set(node, repNode);

            return repNode;
        }

        if (node instanceof GRAPH_NODES.Unknown) {
            const value = String(node.value);
            return new REP_NODES.Primitive('string', value);
        }

        if (node instanceof GRAPH_NODES.Object) {
            if (this.#_refs.has(node)) {
                return this.#_refs.get(node)!;
            }

            const entries: Map<PropertyNode, RepresentationNode> = new Map();

            for (const [prop, value] of node.data) {
                const v = this.#_process(value);
                entries.set(prop, v);
            }

            const repNode = REP_NODES.Object.create({
                entries,
                type: node.type,
                className: node.className
            });

            this.#_refs.set(node, repNode);

            return repNode;
        }

        return new REP_NODES.Primitive('string', '<Unknown node type>');
    }

    /**
     * Builds a representation tree from a GraphNode root.
     *
     * -----------------------------------------------------------------
     * 🔷 PURPOSE
     * -----------------------------------------------------------------
     *
     * Entry point for converting a full GraphNode tree into a
     * RepresentationNode tree.
     *
     * This method guarantees:
     *
     * - identity-aware transformation
     * - deterministic output structure
     * - stable reuse of shared GraphNodes
     *
     * -----------------------------------------------------------------
     * 🔷 IDENTITY GUARANTEE
     * -----------------------------------------------------------------
     *
     * If two branches reference the same GraphNode:
     *
     * ```ts
     * node.x === node.y   (Graph identity)
     * ```
     *
     * then:
     *
     * ```ts
     * build(x) === build(y)  (Representation identity)
     * ```
     *
     * -----------------------------------------------------------------
     * @param graph - Root GraphNode
     * @returns Root RepresentationNode
     * @since 1.0.0
     */
    build(graph: GraphNode): RepresentationNode {
        return this.#_process(graph);
    }

    /**
     * Stateless convenience builder.
     *
     * -----------------------------------------------------------------
     * 🔷 BEHAVIOR
     * -----------------------------------------------------------------
     *
     * Creates a new RepresentationBuilder instance per call.
     *
     * This ensures:
     *
     * - no cross-call identity leakage
     * - safe reuse in concurrent pipelines
     * - deterministic results per invocation
     *
     * -----------------------------------------------------------------
     * ⚠️ NOTE
     * -----------------------------------------------------------------
     *
     * This is NOT a memoized global cache.
     *
     * Identity tracking is scoped per invocation only.
     *
     * -----------------------------------------------------------------
     * @param graph - Root GraphNode
     * @returns Root RepresentationNode
     * @since 1.0.0
     */
    static build(graph: GraphNode): RepresentationNode {
        return new RepresentationBuilder().build(graph);
    }
}

export default RepresentationBuilder;