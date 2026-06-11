import BaseToken from "../assets/__base.token__";
import type { SeparatorTokenValue } from "../../types";

/**
 * Semantic token representing a key-value separator in structured data.
 *
 * `KeyValueSeparatorToken` is used to represent the relationship between
 * a key and its associated value in object-like structures such as:
 *
 * - objects
 * - maps
 * - records
 * - function argument-style representations
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and represents
 * structural meaning rather than raw punctuation.
 *
 * Unlike `SeparatorToken`, which represents generic list separation,
 * this token explicitly encodes a **key → value relationship**.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - preserve structural meaning of key-value pairs
 * - decouple representation from literal syntax (`:`, `=`, `=>`)
 * - allow renderers to choose formatting style per output target
 * - support multiple structural conventions (JS, Map, functional style)
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED FORMATS
 * ---------------------------------------------------------------------
 *
 * The token can represent multiple syntactic conventions:
 *
 * - `:`  → object-style key-value separation
 * - `=`  → assignment-style representation
 * - `=>` → map or arrow-style association
 *
 * This enables flexible rendering strategies depending on context:
 *
 * - JSON-like output
 * - JavaScript object output
 * - functional or debug-style output
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for:
 *
 * - choosing how to visually display the separator
 * - applying spacing rules around the separator
 * - adapting format to layout mode (compact vs pretty)
 *
 * The token itself does NOT enforce formatting rules.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `KeyValueSeparatorToken` contributes:
 *
 * - zero semantic width by itself
 * - a renderer-defined printable symbol
 *
 * The actual visual output depends on `value`.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Once constructed, the separator value is immutable and
 * guarantees consistent rendering behavior throughout the pipeline.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class KeyValueSeparatorToken extends BaseToken<'key-value-separator'> {
    /**
     * Internal separator symbol used to represent key-value relationships.
     *
     * @since 1.0.0
     */
    readonly #_token: SeparatorTokenValue;

    /**
     * Creates a new key-value separator token.
     *
     * @param token - The separator style to use (`:`, `=`, or `=>`)
     * @default `:`
     *
     * @since 1.0.0
     */
    constructor(token: SeparatorTokenValue = ':') {
        super('key-value-separator');
        this.#_token = token;
    }

    /**
     * Returns the raw separator symbol.
     *
     * Renderers use this value to determine how to visually represent
     * the relationship between a key and its value.
     *
     * @returns Separator symbol (`:`, `=`, or `=>`)
     *
     * @since 1.0.0
     */
    get value() {
        return this.#_token;
    }
}