import DataObjectRepresentationNode from "./assets/data-object.node";
import type { RepresentationNode } from "../types";

/**
 * Set representation node.
 *
 * Represents a JavaScript `Set` in the representation layer.
 *
 * This node is the renderer-facing counterpart of the graph-level Set node.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Set representation nodes provide a renderer-friendly, ordered snapshot
 * of a JavaScript `Set` after transformation into representation form.
 *
 * Unlike native `Set`, this representation:
 *
 * - preserves insertion order deterministically
 * - is optimized for rendering and serialization
 * - stores fully resolved representation nodes only
 *
 * It acts as a stable intermediate structure between graph traversal
 * and final serialization output.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL IDENTITY
 * ---------------------------------------------------------------------
 *
 * Each `SetRepresentationNode` has an internally generated immutable
 * identity symbol.
 *
 * This identity is:
 *
 * - unique per representation node instance
 * - not derived from the underlying Set or graph node reference
 * - not exposed externally
 * - not serializable
 *
 * It is used exclusively in the representation layer for:
 *
 * - deduplication of repeated set structures
 * - token reuse during tokenization
 * - maintaining stable graph → representation → token mapping
 *
 * ⚠️ Important:
 * This identity does NOT represent JavaScript Set identity.
 * It represents representation-layer identity only.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURE
 * ---------------------------------------------------------------------
 *
 * Internally, set entries are stored as:
 *
 * ```ts
 * RepresentationNode[]
 * ```
 *
 * Each item is already fully transformed and ready for rendering.
 *
 * This guarantees:
 *
 * - no raw JS values remain
 * - nested structures are preserved
 * - deterministic iteration order
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers typically display sets as:
 *
 * - `Set( ... )`
 * - `{ ... }` (flattened form depending on renderer mode)
 *
 * Example:
 *
 * ```txt
 * Set(1, 2, 3)
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DIFFERENCE FROM MAP / OBJECT
 * ---------------------------------------------------------------------
 *
 * - Set → ordered collection of values
 * - Map → key/value associations
 * - Object → structured property graph
 *
 * This node represents only values, not relationships or keys.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Set representation nodes are immutable after construction:
 *
 * - internal items array is fixed after creation
 * - identity symbol remains constant for lifecycle
 * - no structural mutation is permitted post-creation
 *
 * ⚠️ Note:
 * The internal array is not cloned. External mutation of the input
 * array may affect this node if shared by reference.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * SetRepresentationNode.create(items)
 * ```
 *
 * where `items` are already fully resolved representation nodes.
 *
 * This ensures a deterministic pipeline:
 *
 * GraphNode → RepresentationNode → TokenNode → Serializer Output
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node is strictly typed as:
 *
 * ```ts
 * 'set'
 * ```
 *
 * allowing renderers to distinguish it from:
 *
 * - arrays
 * - maps
 * - objects
 *
 * without runtime heuristics.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class SetRepresentationNode extends DataObjectRepresentationNode {
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
     * Internal set items.
     *
     * Each item is a fully resolved representation node.
     *
     * @since 1.0.0
     */
    readonly #_items: RepresentationNode[];

    /**
     * Creates a new set representation node.
     *
     * @param items - Representation nodes contained in the set.
     *
     * @since 1.0.0
     */
    constructor(items: RepresentationNode[]) {
        super('set', 'Set');
        this.#_items = items;
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
     * Set items.
     *
     * @returns Array of representation nodes.
     * @since 1.0.0
     */
    get items() { return this.#_items; }

    /**
     * Creates a new Set representation node.
     *
     * @param items - Fully resolved representation nodes.
     *
     * @returns SetRepresentationNode instance.
     * @since 1.0.0
     */
    static create(items: RepresentationNode[]) {
        return new SetRepresentationNode(items);
    }
}

export default SetRepresentationNode;