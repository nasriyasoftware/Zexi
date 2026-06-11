import PropertyNode from "../../1-graphing/nodes/assets/property.node";
import ObjectGraphNode from "../../1-graphing/nodes/object.node";
import DataObjectRepresentationNode from "./assets/data-object.node";
import type { RepresentationNode } from "../types";

interface CreateData {
    className: string,
    type: ObjectGraphNode['type'],
    entries: Map<PropertyNode, RepresentationNode>
}

/**
 * Object representation node.
 *
 * Represents a structured JavaScript object in the representation layer.
 *
 * This node is the renderer-facing counterpart of {@link ObjectGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Object representation nodes provide a normalized, renderer-ready view
 * of JavaScript objects after graph transformation.
 *
 * They contain fully processed property entries where:
 *
 * - keys are {@link PropertyNode}
 * - values are {@link RepresentationNode}
 *
 * This ensures consistent rendering across:
 *
 * - plain objects
 * - class instances
 * - record-like structures
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL IDENTITY
 * ---------------------------------------------------------------------
 *
 * Each `ObjectRepresentationNode` has an internally generated immutable
 * identity symbol.
 *
 * This identity is:
 *
 * - unique per representation node instance
 * - not derived from the underlying GraphNode or JS object reference
 * - not exposed externally
 * - not serializable
 *
 * It is used exclusively within the representation layer for:
 *
 * - deduplication of repeated object structures
 * - token reuse during tokenization
 * - stable mapping from graph → representation → token streams
 *
 * ⚠️ Important:
 * This identity does NOT represent JavaScript object identity.
 * It represents representation-layer identity only.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURE
 * ---------------------------------------------------------------------
 *
 * Each object node contains:
 *
 * ```ts
 * Map<PropertyNode, RepresentationNode>
 * ```
 *
 * This allows metadata-rich property representation, including:
 *
 * - property name
 * - property kind (data property / method / getter / setter)
 * - structural ordering stability
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers may interpret object nodes differently depending on target:
 *
 * - JSON renderer → `{ key: value }`
 * - terminal renderer → indented tree view
 * - inspector renderer → expandable structured view
 *
 * The `className` and `type` fields influence formatting:
 *
 * - `"Object"` → standard object literal `{ }`
 * - `"Record"` → JSON-like structure
 * - class instances → labeled constructor output
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKENS
 * ---------------------------------------------------------------------
 *
 * Inherited structural token behavior from {@link DataObjectRepresentationNode}:
 *
 * - `{}` defines object boundaries in serialized output
 *
 * These tokens define structural grouping for downstream serializers.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Object representation nodes are immutable after construction:
 *
 * - internal entries map is not replaced post-creation
 * - identity symbol remains constant for lifecycle
 * - structure is fixed after graph transformation
 *
 * ⚠️ Note:
 * The internal Map is not cloned. External mutation of the original
 * reference may affect the node if not properly isolated at construction time.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * ObjectRepresentationNode.create({
 *   className,
 *   type,
 *   entries
 * })
 * ```
 *
 * where `entries` are already fully resolved representation nodes.
 *
 * This guarantees a deterministic pipeline:
 *
 * GraphNode → RepresentationNode → TokenNode → Serializer Output
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node preserves:
 *
 * - `type` → object or record
 * - `className` → runtime constructor name or `"Record"`
 *
 * enabling renderer specialization without runtime heuristics.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ObjectRepresentationNode extends DataObjectRepresentationNode {
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
     * Property entries of the object.
     *
     * Each entry maps a {@link PropertyNode} to a fully resolved
     * representation node.
     *
     * @since 1.0.0
     */
    readonly #_entries: Map<PropertyNode, RepresentationNode>

    /**
     * Creates a new object representation node.
     *
     * @param data - Object metadata and entries.
     *
     * @since 1.0.0
     */
    constructor(data: CreateData) {
        super(data.type, data.className);
        this.#_entries = data.entries;
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
     * Object property entries.
     *
     * @returns Internal entries map.
     * @since 1.0.0
     */
    get entries() { return this.#_entries; }

    /**
     * Creates a new object representation node.
     *
     * @param data - Object structure and metadata.
     *
     * @returns ObjectRepresentationNode instance.
     * @since 1.0.0
     */
    static create(data: CreateData) {
        return new ObjectRepresentationNode(data);
    }
}

export default ObjectRepresentationNode;