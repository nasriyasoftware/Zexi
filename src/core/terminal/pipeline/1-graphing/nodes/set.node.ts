import BaseDataNode from "./assets/base.node";
import type { GraphNode } from "../types";

/**
 * Graph node representing JavaScript `Set` structures.
 *
 * `SetGraphNode` is part of the graph-building phase and represents
 * a collection of unique `GraphNode` values.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This node normalizes native `Set` instances into a structured graph
 * representation that can be safely traversed and rendered.
 *
 * It preserves:
 * - insertion order (Set semantics)
 * - uniqueness of entries
 * - full recursive structure of child nodes
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - Non-terminal node (contains child nodes)
 * - Each element is stored as a `GraphNode`
 * - Supports recursive traversal
 *
 * ---------------------------------------------------------------------
 * 🔷 SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Unlike arrays:
 * - order is insertion-based but semantically unordered
 *
 * Unlike objects:
 * - values are not keyed
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING NOTES
 * ---------------------------------------------------------------------
 *
 * Renderers may choose to represent this node as:
 *
 * - `{ Set(3) { ... } }` (debug style)
 * - `[ ... ]` (array-like flattening)
 * - `{}` (collapsed fallback mode)
 *
 * depending on the selected presentation layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPLEXITY
 * ---------------------------------------------------------------------
 *
 * - Add operation: O(1)
 * - Size lookup: O(1)
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class SetGraphNode extends BaseDataNode {
    /**
     * Internal set storage of graph nodes.
     * @since 1.0.0
     */
    readonly #_value: Set<GraphNode> = new Set();

    /**
     * Discriminated node type.
     * @since 1.0.0
     */
    readonly #_type: 'set' = 'set';

    /**
     * Creates a Set graph node.
     *
     * @since 1.0.0
     */
    constructor() { super('Set'); }

    /**
     * Node type discriminator.
     *
     * @returns `"set"`
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Underlying Set of graph nodes.
     *
     * @returns Set of child nodes.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Underlying Set of graph nodes.
     *
     * @returns Set of child nodes.
     * @since 1.0.0
     */
    get size() { return this.#_value.size; }

    /**
     * Adds a node to the set.
     *
     * @param item - Graph node to insert.
     * @since 1.0.0
     */
    add(item: GraphNode) {
        this.#_value.add(item);
    }

    /**
     * Creates a new empty SetGraphNode.
     *
     * @returns A new immutable {@link SetGraphNode}.
     * @since 1.0.0
     */
    static create() { return new SetGraphNode(); }
}

export default SetGraphNode;