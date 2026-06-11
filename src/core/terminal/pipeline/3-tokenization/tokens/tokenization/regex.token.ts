import BaseToken from "../assets/__base.token__";
import type RegExpRepresentationNode from "../../../2-representation/nodes/regex.node";

/**
 * Semantic token representing a JavaScript `RegExp` value.
 *
 * `RegExpToken` preserves a runtime regular expression during the
 * tokenization phase without converting it into a string representation.
 *
 * This allows renderers to decide how regex values should be displayed,
 * formatted, or annotated depending on output mode.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `RegExpToken` belongs to the semantic tokenization layer and
 * represents a leaf value in the rendering pipeline.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * JavaScript RegExp
 *        ↓
 * Graphing
 *        ↓
 * RegExpGraphNode
 *        ↓
 * Representation
 *        ↓
 * RegExpRepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * RegExpToken
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
 * - the original `RegExp` instance
 * - pattern and flags semantics
 * - renderer-controlled formatting behavior
 *
 * without forcing early serialization into `/pattern/flags` strings.
 *
 * This enables renderers to:
 *
 * - display raw regex syntax
 * - highlight pattern components
 * - annotate flags (`g`, `i`, `m`, etc.)
 * - switch between compact and expanded views
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `RegExpToken` does NOT define visual representation.
 *
 * Renderers are responsible for:
 *
 * - converting regex to string form
 * - escaping and formatting output
 * - applying ANSI styling
 * - handling compact vs expanded display modes
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The underlying `RegExp` instance is immutable after construction.
 *
 * The token preserves the original reference to ensure deterministic
 * rendering behavior.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class RegExpToken extends BaseToken<'regex'> {
    /**
     * Underlying JavaScript `RegExp` instance.
     *
     * @since 1.0.0
     */
    readonly #_regex: RegExp;

    /**
     * Creates a new regular expression token.
     *
     * @param regex - Runtime `RegExp` instance
     *
     * @since 1.0.0
     */
    constructor(regex: RegExp) {
        super('regex')
        this.#_regex = regex
    }

    /**
     * Returns the underlying regular expression.
     *
     * Renderers may use this value to:
     *
     * - stringify regex patterns
     * - extract flags
     * - apply syntax highlighting
     * - format debug output
     *
     * @returns `RegExp` instance
     *
     * @since 1.0.0
     */
    get value() {
        return this.#_regex
    }

    /**
     * Creates a `RegExpToken` from a `RegExpRepresentationNode`.
     *
     * This bridges:
     *
     * - representation normalization
     * - semantic tokenization
     *
     * @param node - Representation node containing a RegExp value
     * @returns A new `RegExpToken` instance
     *
     * @since 1.0.0
     */
    static from(node: RegExpRepresentationNode) {
        return new RegExpToken(node.value)
    }
}