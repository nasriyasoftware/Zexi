import BaseToken from "../../assets/__base.token__";

/**
 * Token representing the opening delimiter of an object-like structure.
 *
 * `ObjectOpenToken` defines the starting boundary of structured values
 * such as objects, arrays, maps, or sets.
 *
 * The actual symbol is provided at runtime because different structures
 * may use different opening delimiters (`{`, `[`, `(`, etc.).
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and represents
 * structural boundaries rather than literal characters.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - mark the beginning of a structured container
 * - decouple syntax from representation
 * - allow renderer-controlled formatting decisions
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for:
 *
 * - choosing whether to display the token visually
 * - determining spacing and layout around it
 * - handling compact vs expanded representation
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ObjectOpenToken extends BaseToken<'object-open'> {
    /**
     * Raw opening delimiter used for rendering.
     *
     * Examples:
     * - `{`
     * - `[`
     * - `(`
     *
     * @since 1.0.0
     */
    readonly #_token: string;

    /**
     * Creates a new object opening token.
     *
     * @param token - Opening delimiter symbol
     *
     * @since 1.0.0
     */
    constructor(token: string) {
        super('object-open');
        this.#_token = token;
    }

    /**
     * Returns the raw opening delimiter.
     *
     * @returns Opening symbol used in rendering
     *
     * @since 1.0.0
     */
    get token() {
        return this.#_token;
    }
}