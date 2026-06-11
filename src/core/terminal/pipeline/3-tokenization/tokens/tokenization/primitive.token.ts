import BaseToken from "../assets/__base.token__";
import PrimitiveRepresentationNode from "../../../2-representation/nodes/primitive.node";
import type { PrimitiveType, PrimtiveNodeData } from "../../../1-graphing/types";

/**
 * Semantic token representing a JavaScript primitive value.
 *
 * `PrimitiveToken` is used to represent all non-object, non-structured
 * runtime values during the tokenization phase, preserving both:
 *
 * - the primitive type
 * - the raw primitive value
 *
 * without converting them into string representations prematurely.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `PrimitiveToken` belongs to the semantic tokenization layer and
 * represents the final normalized form of leaf values in the pipeline.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * JavaScript Primitive
 *        ↓
 * Graphing
 *        ↓
 * PrimitiveGraphNode
 *        ↓
 * Representation
 *        ↓
 * PrimitiveRepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * PrimitiveToken
 *        ↓
 * Rendering
 * ```
 *
 * Primitive values are always leaf nodes in the system.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to preserve:
 *
 * - exact primitive type identity
 * - raw runtime value
 * - renderer-controlled formatting decisions
 *
 * without enforcing any string conversion rules at tokenization time.
 *
 * This allows renderers to:
 *
 * - format numbers (fixed, scientific, locale-aware)
 * - format strings (escaped, quoted, raw)
 * - render booleans/null/undefined consistently
 * - apply ANSI styling per type
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE MODEL
 * ---------------------------------------------------------------------
 *
 * A primitive is represented by two pieces of metadata:
 *
 * - `type` → semantic primitive classification
 * - `value` → raw runtime value
 *
 * This separation allows renderers to apply type-based formatting
 * without losing original value fidelity.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `PrimitiveToken` does NOT define display rules.
 *
 * Renderers are responsible for:
 *
 * - converting values to string form
 * - applying quoting rules
 * - applying ANSI styling
 * - handling locale-specific formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Both `type` and `value` are immutable after construction to ensure
 * deterministic rendering output across all renderer implementations.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class PrimitiveToken extends BaseToken<'primitive'> {
    /**
     * Semantic classification of the primitive value.
     *
     * Examples:
     * - `string`
     * - `number`
     * - `boolean`
     * - `null`
     * - `undefined`
     *
     * @since 1.0.0
     */
    readonly #_type: PrimitiveType;

    /**
     * Raw primitive runtime value.
     *
     * This is the original value extracted from the representation
     * layer without any string conversion or formatting applied.
     *
     * @since 1.0.0
     */
    readonly #_value: PrimtiveNodeData;

    /**
     * Creates a new primitive token.
     *
     * @param type - Primitive type classification
     * @param value - Raw primitive runtime value
     *
     * @since 1.0.0
     */
    constructor(type: PrimitiveType, value: PrimtiveNodeData) {
        super('primitive');
        this.#_type = type;
        this.#_value = value;
    }

    /**
     * Returns the primitive type classification.
     *
     * @returns Primitive type identifier
     *
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Returns the raw primitive value.
     *
     * Renderers may use this value to:
     *
     * - format output strings
     * - apply type-based styling
     * - perform locale-aware formatting
     *
     * @returns Raw primitive value
     *
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Creates a `PrimitiveToken` from a `PrimitiveRepresentationNode`.
     *
     * This bridges:
     *
     * - representation normalization
     * - semantic tokenization
     *
     * @param node - Representation node containing a primitive value
     * @returns A new `PrimitiveToken` instance
     *
     * @since 1.0.0
     */
    static from(node: PrimitiveRepresentationNode) {
        return new PrimitiveToken(node.type, node.value);
    }
}