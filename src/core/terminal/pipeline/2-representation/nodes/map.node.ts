import DataObjectRepresentationNode from "./assets/data-object.node";
import type { RepresentationNode } from "../types";

/**
 * Map representation node.
 *
 * Represents a JavaScript `Map` structure in the representation layer.
 *
 * This node is the renderer-facing counterpart of {@link MapGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Map representation nodes provide a structured, renderer-friendly view
 * of key-value pairs where both keys and values are already converted
 * into representation nodes.
 *
 * This ensures:
 *
 * - full support for non-primitive keys
 * - deterministic rendering order
 * - stable structural representation across pipeline stages
 * - independence from JavaScript runtime Map semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL IDENTITY
 * ---------------------------------------------------------------------
 *
 * Each `MapRepresentationNode` has an internally generated immutable
 * identity symbol.
 *
 * This identity is:
 *
 * - unique per representation node instance
 * - not derived from the underlying GraphNode or Map instance
 * - not exposed externally
 * - not serializable
 *
 * It is used internally for:
 *
 * - representation-level deduplication
 * - token reuse during tokenization
 * - maintaining graph → representation → token continuity
 *
 * ⚠️ Important:
 * This identity does NOT represent JavaScript Map identity.
 * It represents representation-layer identity only.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURE
 * ---------------------------------------------------------------------
 *
 * Internally, a map node stores entries as:
 *
 * ```ts
 * Map<RepresentationNode, RepresentationNode>
 * ```
 *
 * meaning both keys and values are fully processed representation nodes.
 *
 * This guarantees that:
 *
 * - keys are not raw JS values
 * - nested structures remain fully resolved
 * - rendering is deterministic and schema-independent
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers typically display map nodes as:
 *
 * - `Map { key => value }`
 * - `{ key: value }` (JSON-style fallback)
 *
 * depending on the active serializer or output target.
 *
 * Keys are rendered recursively using their own representation rules.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Map representation nodes are immutable after construction:
 *
 * - internal entry map is read-only after initialization
 * - identity symbol remains constant for lifecycle
 * - no structural mutation is permitted post-creation
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * MapRepresentationNode.create(mapEntries)
 * ```
 *
 * where `mapEntries` are already fully transformed representation nodes.
 *
 * This guarantees a deterministic transformation pipeline:
 *
 * GraphNode → RepresentationNode → TokenNode → Serialized Output
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * This node is strictly typed as:
 *
 * ```ts
 * 'map'
 * ```
 *
 * allowing renderers to distinguish it from:
 *
 * - object nodes
 * - array nodes
 * - set nodes
 *
 * without runtime heuristics.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class MapRepresentationNode extends DataObjectRepresentationNode {
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
     * Internal map entries.
     *
     * Each key and value is a fully resolved representation node.
     *
     * @since 1.0.0
     */
    readonly #_entries: Map<RepresentationNode, RepresentationNode>;

    /**
     * Creates a new map representation node.
     *
     * @param entries - Fully processed key-value representation map.
     *
     * @since 1.0.0
     */
    constructor(entries: Map<RepresentationNode, RepresentationNode>) {
        super('map', 'Map');
        this.#_entries = entries;
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
     * Map entries.
     *
     * @returns Immutable reference to internal entries map.
     * @since 1.0.0
     */
    get entries() { return this.#_entries; }

    /**
     * Creates a new Map representation node.
     *
     * @param entries - Representation-level map entries.
     *
     * @returns MapRepresentationNode instance.
     * @since 1.0.0
     */
    static create(entries: Map<RepresentationNode, RepresentationNode>) {
        return new MapRepresentationNode(entries);
    }
}

export default MapRepresentationNode;