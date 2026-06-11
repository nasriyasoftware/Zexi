import BaseToken from "../../assets/__base.token__";

/**
 * Token representing the closing delimiter of an object-like structure.
 *
 * `ObjectCloseToken` defines the end boundary of structured values such
 * as objects, arrays, maps, or sets.
 *
 * The actual symbol is provided at runtime because different structures
 * may use different closing delimiters (`}`, `]`, `)`, etc.).
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and represents
 * structural closure rather than literal characters.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - mark the end of a structured container
 * - define balanced structural boundaries
 * - support renderer-controlled formatting logic
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for:
 *
 * - matching open/close pairs
 * - applying indentation alignment
 * - managing multiline wrapping behavior
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ObjectCloseToken extends BaseToken<'object-close'> {
    /**
     * Raw closing delimiter used for rendering.
     *
     * Examples:
     * - `}`
     * - `]`
     * - `)`
     *
     * @since 1.0.0
     */
    readonly #_token: string;

    /**
     * Creates a new object closing token.
     *
     * @param token - Closing delimiter symbol
     *
     * @since 1.0.0
     */
    constructor(token: string) {
        super('object-close');
        this.#_token = token;
    }

    /**
     * Returns the raw closing delimiter.
     *
     * @returns Closing symbol used in rendering
     *
     * @since 1.0.0
     */
    get token() {
        return this.#_token;
    }
}