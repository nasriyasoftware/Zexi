import DateRepresentationNode from "../../../2-representation/nodes/date.node";
import BaseToken from "../assets/__base.token__";

/**
 * Semantic token representing a JavaScript `Date` value.
 *
 * `DateToken` is produced during the tokenization phase from a
 * `DateRepresentationNode` and preserves the semantic identity
 * of a runtime `Date` object in token form.
 *
 * Unlike plain string serialization, this token retains the original
 * `Date` instance so renderers can decide how temporal values should
 * be presented.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `DateToken` belongs to the semantic tokenization layer.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * JavaScript Date
 *        ↓
 * Graphing
 *        ↓
 * DateGraphNode
 *        ↓
 * Representation
 *        ↓
 * DateRepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * DateToken
 *        ↓
 * Rendering
 * ```
 *
 * This token represents semantic temporal data,
 * not presentation formatting.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The token exists to preserve:
 *
 * - temporal semantics
 * - original runtime date values
 * - renderer-controlled formatting
 *
 * without prematurely converting dates into strings.
 *
 * This allows renderers to:
 *
 * - apply locale formatting
 * - display relative time
 * - render timestamps differently per output target
 * - apply date-specific syntax highlighting
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `DateToken` does NOT define how dates should appear visually.
 *
 * Renderers are responsible for:
 *
 * - string formatting
 * - localization
 * - timezone handling
 * - ANSI styling
 * - compact vs expanded formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The underlying `Date` reference is immutable after token creation.
 *
 * The token itself does not mutate the date object.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKENIZATION SOURCE
 * ---------------------------------------------------------------------
 *
 * `DateToken` instances are typically created via:
 *
 * - `DateToken.from(node)`
 *
 * using a `DateRepresentationNode` generated during the
 * representation phase.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class DateToken extends BaseToken<'date'> {
    /**
     * Underlying JavaScript `Date` instance represented by this token.
     *
     * @since 1.0.0
     */
    readonly #_date: Date;

    /**
     * Creates a new semantic date token.
     *
     * @param date - JavaScript `Date` instance to encapsulate
     *
     * @since 1.0.0
     */
    constructor(date: Date) {
        super('date');
        this.#_date = date;
    }

    /**
     * Returns the underlying `Date` instance.
     *
     * Renderers may use this value to:
     *
     * - apply locale formatting
     * - render relative timestamps
     * - produce ISO strings
     * - generate styled temporal output
     *
     * @returns Encapsulated `Date` object
     *
     * @since 1.0.0
     */
    get value(): Date {
        return this.#_date;
    }

    /**
     * Creates a `DateToken` from a `DateRepresentationNode`.
     *
     * This method acts as the bridge between:
     *
     * - representation normalization
     * - semantic tokenization
     *
     * @param node - Representation node containing a date value
     * @returns A new `DateToken` instance
     *
     * @since 1.0.0
     */
    static from(node: DateRepresentationNode) {
        return new DateToken(node.value);
    }
}