import type FunctionGraphNode from "../../1-graphing/nodes/function.node";

/**
 * Function representation node.
 *
 * Represents a JavaScript function in the representation layer.
 *
 * This node is the renderer-facing counterpart of {@link FunctionGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Function nodes encapsulate JavaScript function values in a stable,
 * render-safe structure for inspection and display.
 *
 * Unlike graph nodes, representation nodes do not analyze or traverse
 * function internals — they only carry a reference for rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL IDENTITY
 * ---------------------------------------------------------------------
 *
 * Each `FunctionRepresentationNode` has an internally generated immutable
 * identity symbol.
 *
 * This identity is:
 *
 * - unique per representation node instance
 * - not derived from the underlying function reference
 * - not exposed to external consumers
 * - not serializable
 *
 * It is used exclusively inside the representation layer for:
 *
 * - node deduplication
 * - token reuse during tokenization
 * - stable reference mapping from graph → representation → tokens
 *
 * ⚠️ Important:
 * This identity does NOT represent JavaScript function identity.
 * It represents representation-layer identity only.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers typically display function nodes as:
 *
 * - `[Function]`
 * - `[Function name]`
 * - `ƒ name() { ... }` (advanced renderers)
 *
 * Example outputs:
 *
 * ```txt
 * [Function]
 * ```
 *
 * or
 *
 * ```txt
 * [Function: myHandler]
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 LIMITATIONS
 * ---------------------------------------------------------------------
 *
 * This node does NOT:
 *
 * - introspect function body
 * - evaluate closures
 * - serialize executable code
 *
 * It is strictly a reference wrapper.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Function representation nodes are immutable after construction:
 *
 * - underlying function reference is read-only
 * - internal identity symbol is fixed
 * - no mutation of structural metadata is allowed
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * FunctionRepresentationNode.from(functionGraphNode)
 * ```
 *
 * This guarantees a deterministic 1:1 mapping from:
 *
 * - FunctionGraphNode → FunctionRepresentationNode
 *
 * preserving identity continuity across pipeline stages.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node is strictly typed as:
 *
 * ```ts
 * 'function'
 * ```
 *
 * allowing renderers to identify function values without runtime
 * inspection or heuristics.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class FunctionRepresentationNode {
    /**
     * Unique immutable structural identity symbol.
     *
     * This symbol is automatically generated during construction and is
     * used internally throughout the compilation pipeline to:
     *
     * - track structural node identity
     * - memoize downstream transformations
     * - cache representation/token stages
     * - detect repeated structures
     *
     * The symbol is runtime-local and intentionally non-serializable.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol = Symbol();

    /**
     * Semantic node type identifier.
     *
     * Always `"function"`.
     *
     * @since 1.0.0
     */
    readonly #_type: 'function' = 'function';

    /**
     * Underlying JavaScript function reference.
     *
     * Represents the original function from the graph layer.
     *
     * @since 1.0.0
     */
    readonly #_value: Function;

    /**
     * Creates a new function representation node.
     *
     * @param value - JavaScript function reference.
     *
     * @since 1.0.0
     */
    constructor(value: Function) {
        this.#_value = value;
    }

    /**
     * Unique immutable graph node identifier.
     *
     * @returns Stable graph node identifier.
     * @since 1.0.0
     */
    get id(): symbol {
        return this.#_id;
    }

    /**
     * Semantic node type.
     *
     * @returns Always `"function"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Underlying function reference.
     *
     * @returns Original JavaScript function.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Converts a function graph node into a representation node.
     *
     * This transformation is lossless and preserves the original
     * function reference without modification.
     *
     * @param node - Function graph node.
     *
     * @returns Function representation node.
     * @since 1.0.0
     */
    static from(node: FunctionGraphNode) {
        return new FunctionRepresentationNode(node.value);
    }
}

export default FunctionRepresentationNode;