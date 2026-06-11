import DataObjectRepresentationNode from "./assets/data-object.node";
import type { RepresentationNode } from "../types";

/**
 * Array representation container node.
 *
 * Represents an ordered collection of representation nodes within
 * the representation layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ArrayRepresentationNode` is the renderer-oriented counterpart of
 * `ArrayGraphNode`.
 *
 * Unlike graph nodes, representation nodes are specifically designed
 * for rendering engines and serialization systems.
 *
 * This node preserves:
 * - item ordering
 * - array semantics
 * - structural rendering metadata
 *
 * while exposing a renderer-friendly structure.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers use this node to generate array-like structures:
 *
 * Examples:
 *
 * ```txt
 * [1, 2, 3]
 * ```
 *
 * ```json
 * ["a", "b", "c"]
 * ```
 *
 * The base class provides:
 * - opening token `[`
 * - closing token `]`
 * - semantic type metadata
 *
 * while this class provides the actual ordered items.
 *
 * ---------------------------------------------------------------------
 * 🔷 ITEM MODEL
 * ---------------------------------------------------------------------
 *
 * Items are stored in insertion order using a standard array.
 *
 * Each item is itself another {@link RepresentationNode},
 * enabling recursive rendering trees.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * The node reference itself is immutable after construction.
 *
 * Renderers are expected to treat item collections as read-only.
 *
 * ---------------------------------------------------------------------
 * 🔷 FACTORY API
 * ---------------------------------------------------------------------
 *
 * The static `create()` method provides a semantic construction API
 * aligned with other representation nodes.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ArrayRepresentationNode extends DataObjectRepresentationNode {
    /**
     * Ordered array items.
     *
     * Each item represents a recursively transformed child node
     * from the representation layer.
     *
     * @since 1.0.0
     */
    readonly #_items: RepresentationNode[];

    /**
     * Creates a new array representation node.
     *
     * @param items - Ordered array items.
     * @since 1.0.0
     */
    constructor(items: RepresentationNode[]) {
        super('array', 'Array');
        this.#_items = items;
    }

    /**
     * Ordered representation items.
     *
     * Preserves original array ordering.
     *
     * @returns Array item collection.
     * @since 1.0.0
     */
    get items() { return this.#_items; }

    /**
     * Creates a new array representation node.
     *
     * Convenience factory method aligned with the representation
     * node construction model.
     *
     * @param items - Ordered array items.
     *
     * @returns A new {@link ArrayRepresentationNode}.
     * @since 1.0.0
     */
    static create(items: RepresentationNode[]) { return new ArrayRepresentationNode(items); }
}

export default ArrayRepresentationNode;