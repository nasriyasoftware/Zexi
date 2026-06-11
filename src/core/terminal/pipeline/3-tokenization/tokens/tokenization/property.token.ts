import BaseToken from "../assets/__base.token__";
import PropertyNode from "../../../1-graphing/nodes/assets/property.node";

/**
 * Semantic token representing an object property entry.
 *
 * `PropertyToken` describes a property key extracted from the graphing
 * and representation layers, preserving both:
 *
 * - the property name
 * - the property kind (data, getter, setter, method)
 *
 * without collapsing it into a raw string during tokenization.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `PropertyToken` belongs to the semantic tokenization layer and
 * represents metadata about object structure rather than raw syntax.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * Object / Class Instance
 *        ↓
 * Graphing
 *        ↓
 * PropertyNode
 *        ↓
 * Representation
 *        ↓
 * PropertyNode (normalized with metadata)
 *        ↓
 * Tokenization
 *        ↓
 * PropertyToken
 *        ↓
 * Rendering
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to preserve:
 *
 * - property identity (name)
 * - property semantics (kind)
 *
 * instead of treating all properties as simple string keys.
 *
 * This enables renderers to distinguish between:
 *
 * - regular fields
 * - getters
 * - setters
 * - methods
 *
 * ---------------------------------------------------------------------
 * 🔷 PROPERTY KIND MODEL
 * ---------------------------------------------------------------------
 *
 * The `type` field represents the semantic classification of the property:
 *
 * - `property` → plain data field
 * - `getter` → computed accessors
 * - `setter` → mutation accessors
 * - `method` → function property
 *
 * This metadata is critical for advanced inspection rendering modes.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `PropertyToken` does NOT define visual representation.
 *
 * Renderers are responsible for:
 *
 * - deciding whether to display property kind
 * - formatting keys in compact vs expanded mode
 * - applying styling (e.g. dim getters/methods)
 * - handling alignment in object layouts
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Both property name and kind are immutable after construction
 * to ensure deterministic rendering across layouts and modes.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class PropertyToken extends BaseToken<'property'> {
    /**
     * Property name (key) extracted from the graph/representation layer.
     *
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Semantic classification of the property.
     *
     * Derived from the graph layer `PropertyNode.kind`, indicating whether
     * the property is a:
     *
     * - data property
     * - getter
     * - setter
     * - method
     *
     * @since 1.0.0
     */
    readonly #_kind: PropertyNode['kind'];

    /**
     * Creates a new property token.
     *
     * @param args - Constructor parameters of the originating `PropertyNode`
     *
     * @since 1.0.0
     */
    constructor(...args: ConstructorParameters<typeof PropertyNode>) {
        super('property');

        this.#_name = args[0];
        this.#_kind = args[1];
    }

    /**
     * Returns the property name (key).
     *
     * @returns Property identifier string
     *
     * @since 1.0.0
     */
    get value() { return this.#_name; }

    /**
     * Returns the property kind classification.
     *
     * Used by renderers to differentiate between:
     *
     * - fields
     * - getters
     * - setters
     * - methods
     *
     * @returns Property kind
     *
     * @since 1.0.0
     */
    get type() { return this.#_kind; }

    /**
     * Creates a `PropertyToken` from a `PropertyNode`.
     *
     * This bridges:
     *
     * - graph-level property metadata
     * - semantic tokenization layer
     *
     * @param node - Property node from the graph/representation layer
     * @returns A new `PropertyToken` instance
     *
     * @since 1.0.0
     */
    static from(node: PropertyNode) {
        return new PropertyToken(node.name, node.kind);
    }
}