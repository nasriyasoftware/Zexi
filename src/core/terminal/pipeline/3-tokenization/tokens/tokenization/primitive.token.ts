import BaseToken from "../assets/__base.token__";
import AnsiMeta from "../../container/ansi_meta/ansi.meta";
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
 * 🔷 ANSI NOTE
 * ---------------------------------------------------------------------
 *
 * ANSI metadata is considered part of the *enrichment layer*, not
 * the semantic token definition.
 *
 * It may be replaced or reset in future pipeline stages without
 * violating token immutability guarantees.
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
     * ANSI metadata container associated with this primitive token.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE IN PIPELINE
     * ---------------------------------------------------------------------
     *
     * This object stores resolved ANSI styling information applied during
     * the enrichment phase of the rendering pipeline.
     *
     * It allows primitive tokens to carry contextual styling derived from:
     *
     * - traversal context (e.g. maps, objects, errors)
     * - type-based default styling
     * - renderer-specific formatting rules
     *
     * ---------------------------------------------------------------------
     * 🔷 MUTABILITY MODEL
     * ---------------------------------------------------------------------
     *
     * - Mutated only during enrichment
     * - Treated as read-only during rendering
     * - Resolved using first-write-wins semantics internally
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN INTENT
     * ---------------------------------------------------------------------
     *
     * This field decouples:
     *
     * - semantic value (`type`, `value`)
     * - visual representation (ANSI styling)
     *
     * allowing renderers to remain stateless.
     *
     * ---------------------------------------------------------------------
     * @internal
     */
    readonly #_ansi = new AnsiMeta();

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
     * Semantic classification of the primitive value.
     *
     * This type is preserved from the graph and representation layers
     * without transformation.
     *
     * It is used by renderers to determine:
     *
     * - formatting rules
     * - default ANSI styling
     * - serialization strategy
     *
     * @returns Primitive type identifier
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Raw primitive value from the representation layer.
     *
     * This value is guaranteed to be unformatted and unescaped.
     *
     * Renderers may transform this value for display purposes, but
     * must not mutate the underlying token.
     *
     * Typical uses:
     *
     * - string formatting (quoted/unquoted)
     * - number formatting (locale, precision)
     * - boolean/null rendering
     *
     * @returns Raw primitive value
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Exposes the ANSI metadata container for this token.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Provides controlled access to styling metadata assigned during
     * the enrichment phase.
     *
     * Renderers use this to:
     *
     * - read resolved ANSI colors
     * - apply styling to output strings
     * - inspect contextual styling decisions
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTES
     * ---------------------------------------------------------------------
     *
     * This getter exposes the underlying `AnsiMeta` instance directly,
     * not a copy.
     *
     * Mutations are allowed only during enrichment phase and are assumed
     * to be deterministic and controlled by the pipeline.
     *
     * ---------------------------------------------------------------------
     * @returns AnsiMeta instance associated with this token
     * @since 1.0.0
     */
    get ansi() { return this.#_ansi; }

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