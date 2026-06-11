import BaseToken from "../assets/__base.token__";

/**
 * Semantic token representing a structural separator in collections.
 *
 * `SeparatorToken` is used to represent boundaries between elements in
 * sequential structures such as arrays, sets, maps, and object entries.
 *
 * Unlike raw punctuation, this token preserves the *semantic role* of
 * separation without enforcing a specific rendering strategy.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `SeparatorToken` belongs to the semantic tokenization layer and
 * represents structural boundaries between sibling elements.
 *
 * It does NOT represent formatting decisions such as spacing or line
 * breaks; those are handled by higher-level spacing tokens and renderers.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - mark element boundaries in collections
 * - decouple syntax from layout decisions
 * - allow renderer-controlled formatting strategies
 * - support compact and expanded output modes
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED VALUES
 * ---------------------------------------------------------------------
 *
 * The token supports two separator styles:
 *
 * - `,` → standard list separation (arrays, objects, sets)
 * - `;` → alternative structural separation (maps or debug formats)
 *
 * This allows different structural semantics depending on context.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for:
 *
 * - deciding whether separators are visible
 * - controlling spacing around separators
 * - converting separators into line breaks in expanded mode
 * - collapsing or removing separators in compact mode if needed
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `SeparatorToken` contributes:
 *
 * - zero structural meaning beyond separation
 * - a renderer-controlled visible symbol
 *
 * The actual displayed character is defined by `value`.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class SeparatorToken extends BaseToken<'separator'> {
    /**
     * Internal separator symbol used to delimit elements.
     *
     * @since 1.0.0
     */
    readonly #_value: ',' | ';';

    /**
     * Creates a new separator token.
     *
     * @param value - Separator character (`','` or `';'`)
     * @default `,`
     *
     * @since 1.0.0
     */
    constructor(value: ',' | ';' = ',') {
        super('separator');
        this.#_value = value;
    }

    /**
     * Returns the separator character.
     *
     * Renderers use this value to determine how collection elements are
     * visually separated in the final output.
     *
     * @returns Separator symbol
     *
     * @since 1.0.0
     */
    get value(): ',' | ';' {
        return this.#_value;
    }
}