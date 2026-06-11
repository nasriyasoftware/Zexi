import BaseDataNode from "./assets/base.node";
import type { GraphNode } from "../types";

/**
* Graph representation node for JavaScript `Map` structures.
*
* This node preserves key-value relationships using graph-level
* `GraphNode` instances instead of raw JavaScript values.
*
* ---------------------------------------------------------------------
* 🔷 PURPOSE
* ---------------------------------------------------------------------
*
* `MapGraphNode` represents a structured collection of key-value pairs
* where both keys and values are recursively converted into graph nodes.
*
* It exists to ensure:
* - deterministic traversal of map entries
* - consistent rendering across different output layers
* - preservation of non-string keys (unlike JSON)
*
* ---------------------------------------------------------------------
* 🔷 KEY DESIGN GOALS
* ---------------------------------------------------------------------
*
* - Preserve insertion semantics of Map
* - Support complex key types (objects, arrays, etc.)
* - Avoid coercion to plain object representations
* - Enable renderer-specific formatting strategies
*
* ---------------------------------------------------------------------
* 🔷 INTERNAL STRUCTURE
* ---------------------------------------------------------------------
*
* Internally, this node stores entries as:
*
* ```
* Map<GraphNode, GraphNode>
* ```
*
* This ensures both keys and values are fully part of the graph model.
*
* ---------------------------------------------------------------------
* 🔷 ORDER & SIZE
* ---------------------------------------------------------------------
*
* - Entry order is preserved (native Map behavior)
* - Size reflects the number of key-value pairs
*
* ---------------------------------------------------------------------
* 🔷 RENDERING NOTES
* ---------------------------------------------------------------------
*
* Renderers may choose to represent this node as:
*
* - `Map(key => value)`
* - `{ key: value }` (lossy JSON fallback)
* - multiline block structures
*
* depending on output constraints and target format.
*
* ---------------------------------------------------------------------
* 🔷 MUTABILITY MODEL
* ---------------------------------------------------------------------
*
* Entries are added incrementally during graph construction.
* Once built, the node is treated as immutable by renderers.
*
* ---------------------------------------------------------------------
* @since 1.0.0
*/
class MapGraphNode extends BaseDataNode {
    /**
     * Internal map storage of graph entries.
     * @since 1.0.0
     */
    readonly #_value: Map<GraphNode, GraphNode> = new Map();

    /**
     * Constant node type identifier.
     * @since 1.0.0
     */
    readonly #_type: 'map' = 'map';

    /**
     * Constant node type identifier.
     * @since 1.0.0
     */
    constructor() { super('Map'); }

    /**
     * Node type discriminator.
     * @returns Always `"map"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Internal key-value storage of the map.
     *
     * @returns Map of GraphNode keys to GraphNode values.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Number of entries in the map.
     *
     * @returns Entry count.
     * @since 1.0.0
     */
    get size() { return this.#_value.size; }

    /**
     * Adds a key-value pair to the graph map.
     *
     * @param key - Graph node representing the key.
     * @param value - Graph node representing the value.
     *
     * @since 1.0.0
     */
    add(key: GraphNode, value: GraphNode) {
        this.#_value.set(key, value);
    }

    /**
     * Creates a new empty MapGraphNode.
     *
     * @returns A new map graph node instance.
     * @since 1.0.0
     */
    static create() { return new MapGraphNode(); }
}

export default MapGraphNode;