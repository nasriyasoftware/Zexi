/**
 * Base abstraction shared by all graph and representation nodes.
 *
 * This class provides a stable runtime identity for data nodes by exposing
 * a normalized node name used throughout the serialization pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `BaseDataNode` exists to establish a common contract between all node types.
 *
 * Every node in the system:
 * - has a semantic name
 * - participates in recursive traversal
 * - may be inspected by renderers or transformers
 *
 * The node name acts as lightweight runtime metadata and enables:
 * - renderer branching
 * - debugging
 * - graph introspection
 * - snapshot testing
 * - transformation pipelines
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTES
 * ---------------------------------------------------------------------
 *
 * - Node names are immutable after construction
 * - The base class intentionally contains minimal behavior
 * - Specialized semantics belong to derived node types
 *
 * ---------------------------------------------------------------------
 * 🔷 INHERITANCE
 * ---------------------------------------------------------------------
 *
 * This class is extended by:
 * - graph nodes
 * - representation nodes
 * - future transformation/intermediate nodes
 *
 * Examples:
 * - `PrimitiveGraphNode`
 * - `ObjectGraphNode`
 * - `MapRepresentationNode`
 *
 * ---------------------------------------------------------------------
 * @abstract
 * @since 1.0.0
 */
abstract class BaseDataNode {
    /**
     * Internal immutable node name.
     *
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Internal immutable node name.
     *
     * @since 1.0.0
     */
    constructor(name: string) {
        this.#_name = name;
    }

    /**
     * Semantic node identifier.
     *
     * This value is used by renderers and transformation layers
     * to determine node behavior without relying on constructor names.
     *
     * @returns The immutable node name.
     *
     * @since 1.0.0
     */
    get name(): string { return this.#_name; }
}

export default BaseDataNode;