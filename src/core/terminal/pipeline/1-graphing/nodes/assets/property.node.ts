/**
 * Supported object member classifications.
 *
 * These kinds describe how a property behaves semantically
 * within an object graph.
 *
 * ---------------------------------------------------------------------
 * 🔷 PROPERTY TYPES
 * ---------------------------------------------------------------------
 *
 * - `property`
 *   Standard data property.
 *
 * - `method`
 *   Function-valued prototype member.
 *
 * - `getter`
 *   Getter accessor descriptor.
 *
 * - `setter`
 *   Setter accessor descriptor.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type PropertyKind = 'property' | 'method' | 'getter' | 'setter';

/**
 * Semantic object property descriptor used by object graph nodes.
 *
 * `PropertyNode` represents metadata about a property-like member
 * discovered during graph construction.
 *
 * Unlike raw JavaScript property descriptors, this class provides
 * a normalized and renderer-friendly representation suitable for:
 * - graph traversal
 * - rendering
 * - serialization
 * - formatting engines
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This node exists to distinguish between:
 * - standard properties
 * - prototype methods
 * - getters
 * - setters
 *
 * Renderers can use this metadata to generate richer output:
 *
 * Examples:
 * - `name: "John"`
 * - `[method render]`
 * - `[getter size]`
 * - `[setter value]`
 *
 * ---------------------------------------------------------------------
 * 🔷 GENERIC TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The generic parameter preserves the exact property kind
 * at the type level.
 *
 * Example:
 *
 * ```ts
 * const prop = PropertyNode.create('render', 'method');
 * // prop.kind inferred as "method"
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * Property nodes are immutable after construction.
 *
 * ---------------------------------------------------------------------
 * @template T - Specific property classification.
 * @since 1.0.0
 */
class PropertyNode<T extends PropertyKind = PropertyKind> {
    /**
     * Internal property name.
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Internal semantic property kind.
     * @since 1.0.0
     */
    readonly #_kind: T;

    /**
     * Creates a new property node.
     *
     * @param name - Property name.
     * @param kind - Semantic property classification.
     *
     * @since 1.0.0
     */
    constructor(name: string, kind: T) {
        this.#_name = name;
        this.#_kind = kind;
    }

    /**
     * Property name.
     *
     * @returns The original property identifier.
     * @since 1.0.0
     */
    get name() { return this.#_name; }

    /**
     * Semantic property classification.
     *
     * @returns The property kind.
     * @since 1.0.0
     */
    get kind() { return this.#_kind; }

    /**
     * Creates a new property node.
     *
     * Convenience factory preserving generic inference.
     *
     * @param value - Property name.
     * @param kind - Semantic property classification.
     *
     * @returns A new immutable {@link PropertyNode}.
     * @since 1.0.0
     */
    static create<T extends PropertyKind>(value: string, kind: T) {
        return new PropertyNode(value, kind);
    }
}

export default PropertyNode;