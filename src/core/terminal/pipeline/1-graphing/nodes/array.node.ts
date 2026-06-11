import BaseDataNode from "./assets/base.node";
import type { GraphNode } from "../types";

/**
 * Graph node representing a JavaScript array.
 *
 * This node stores array items as ordered child {@link GraphNode}s,
 * preserving insertion order exactly as encountered during traversal.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL IDENTITY
 * ---------------------------------------------------------------------
 *
 * Every container graph node automatically generates a unique immutable
 * structural identity symbol during construction.
 *
 * This identity is:
 *
 * - runtime-local (not serializable)
 * - memory-stable for the lifetime of the node
 * - strictly internal to the graph pipeline
 * - guaranteed unique via `Symbol()`
 *
 * It is used exclusively for internal pipeline coordination and must
 * never be treated as external or persistent identity.
 *
 * The identity does NOT represent:
 *
 * - JavaScript memory addresses
 * - persisted identifiers
 * - debug/export keys
 * - runtime object references exposed to consumers
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH ROLE
 * ---------------------------------------------------------------------
 *
 * Arrays are recursive container nodes:
 *
 * - each array item becomes its own graph node
 * - child nodes are stored sequentially
 * - nested structures are recursively preserved
 *
 * Example:
 *
 * ```ts
 * [1, "hello", { a: true }]
 * ```
 *
 * Becomes:
 *
 * ```txt
 * ArrayGraphNode
 * ├── PrimitiveGraphNode(1)
 * ├── PrimitiveGraphNode("hello")
 * └── ObjectGraphNode(...)
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 ORDER GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Array item order is always preserved.
 *
 * This is important for:
 *
 * - deterministic rendering
 * - serialization consistency
 * - stable snapshots/tests
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Items are added incrementally during graph construction via {@link add()}.
 *
 * The graph builder recursively populates this node while traversing
 * the source array.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING USAGE
 * ---------------------------------------------------------------------
 *
 * Representation/rendering layers may use this node to:
 *
 * - render JSON arrays
 * - render CLI lists
 * - apply multiline formatting
 * - collapse large collections
 * - measure layout complexity
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ArrayGraphNode extends BaseDataNode {
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
     * Ordered child graph nodes representing array items.
     * @since 1.0.0
     */
    readonly #_value: GraphNode[] = [];

    /**
     * Semantic graph node classification.
     * @since 1.0.0
     */
    readonly #_type: 'array' = 'array';

    /**
     * Creates a new empty array graph node.
     * @since 1.0.0
     */
    constructor() { super('Array'); }

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
     * @returns Always `"array"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Ordered array child nodes.
     *
     * Each item represents a recursively processed array element.
     *
     * @returns Ordered child graph nodes.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Appends a child graph node to the array.
     *
     * Items are stored in insertion order.
     *
     * @param item - Graph node representing the array item.
     * @since 1.0.0
     */
    add(item: GraphNode) {
        this.#_value.push(item);
    }

    /**
     * Creates a new {@link ArrayGraphNode}.
     *
     * Convenience factory method.
     *
     * @returns A new empty array graph node.
     * @since 1.0.0
     */
    static create() {
        return new ArrayGraphNode();
    }
}

export default ArrayGraphNode;