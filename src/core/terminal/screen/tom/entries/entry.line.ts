import consoleStyler from "../../../styling/styler";

/**
 * One wrapped line in the terminal object model's logical screen sequence.
 *
 * An `EntryLine` is a derived record created by the entry-lines controller
 * for one portion of a cell's rendered value. It carries the owning entry's
 * stable identity, the line's text, its one-based logical line number, and a
 * cached per-code-unit width estimate. The line object does not write to the
 * terminal or decide where it is visible; the entry manager assigns logical
 * positions and the viewport maps those positions onto terminal rows.
 *
 * ---------------------------------------------------------------------
 * 🔷 LINE IDENTITY AND NUMBERING
 * ---------------------------------------------------------------------
 *
 * All lines generated from the same entry share its symbol identity. The
 * `number` property is global to the complete managed screen sequence rather
 * than local to the owning entry. Reflow and entry insertions or removals may
 * change this number while preserving the line object's identity and text.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH ESTIMATE
 * ---------------------------------------------------------------------
 *
 * Width is computed once from the initial text. The loop count uses the
 * length of the ANSI-stripped text, but each width lookup reads the code unit
 * at the same index from the original text. Consequently, an ANSI sequence
 * before visible characters can cause the cached width to be based on escape
 * sequence characters rather than the visible characters. For ASCII-only
 * content this can accidentally produce the same count, because both the
 * escape characters and visible characters contribute one unit; styled
 * content containing non-ASCII characters can receive an incorrect estimate.
 * This is a current implementation limitation for styled values.
 *
 * Each lookup adds 1, 2, or 3 according to the code unit's numeric value. The
 * 4-unit branch is unreachable for `charCodeAt()` results, which are at most
 * `0xFFFF`. A supplementary Unicode character is represented by two
 * surrogate code units and therefore contributes twice. Even without the
 * ANSI indexing limitation, this is a code-unit heuristic rather than
 * terminal display columns: it does not account for wide glyphs, combining
 * marks, or grapheme clusters.
 *
 * @internal This is an implementation record used by TOM and is not public API.
 * @since 1.0.0
 */
class EntryLine {
    /**
     * Stable symbol identity of the entry that generated this line.
     *
     * The identity remains the same for every line produced from one entry and
     * is used to associate derived lines with their owning entry after reflow.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_entryId: symbol;

    /**
     * Text assigned to this logical line when the line object was created.
     *
     * Line text is immutable after construction; a content update creates a
     * new set of line objects through the entry line controller.
     *
     * @internal
     * @since 1.0.0
     */
    #_text: string;

    /**
     * Cached width estimate calculated for the line's initial text.
     *
     * The current calculation iterates over ANSI-stripped text but reads
     * code units from the original string at matching indexes. Styled prefixes
     * can therefore make the estimate inaccurate. The value is retained for
     * cursor placement and is not recomputed when the line number changes.
     *
     * @internal
     * @since 1.0.0
     */
    #_width: number;

    /**
     * One-based logical line number within the complete managed screen sequence.
     *
     * This is not a zero-based terminal row. The viewport translates it to a
     * terminal row using its current logical and physical origins.
     *
     * @internal
     * @since 1.0.0
     */
    #_number: number = 1;

    /**
     * Creates a line for one entry and calculates its cached width estimate.
     *
     * The supplied line number is stored as-is; callers are responsible for
     * providing the positive one-based number appropriate to the entry. Width
     * is computed once using numeric thresholds for code units read from the
     * original string at indexes selected by the ANSI-stripped string length.
     * Styled prefixes can therefore skew the estimate; see the class
     * documentation for the measurement limitations.
     *
     * @param entryId - Stable identity of the owning entry.
     * @param meta - Initial text and one-based logical line number.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(entryId: symbol, meta: { text: string, number: number }) {
        this.#_entryId = entryId;
        this.#_number = meta.number;
        const text = this.#_text = meta.text;
        const visibleText = consoleStyler.strip(text);

        let width = 0;
        for (let i = 0; i < visibleText.length; i++) {
            const charCode = text.charCodeAt(i);
            if (charCode <= 0x7F) {
                width += 1;
            } else if (charCode <= 0x7FF) {
                width += 2;
            } else if (charCode <= 0xFFFF) {
                width += 3;
            } else {
                width += 4;
            }
        }

        this.#_width = width;
    }

    /**
     * Returns the stable identity of the line's owning entry.
     *
     * @returns The entry's stable symbol identity.
     *
     * @internal
     * @since 1.0.0
     */
    get entryId() { return this.#_entryId; }

    /**
     * Returns the cached width estimate, not a terminal-cell display width.
     *
     * @returns The width estimate calculated from the line's initial text.
     *
     * @internal
     * @since 1.0.0
     */
    get width() { return this.#_width; }

    /**
     * Returns the text assigned when this line was created.
     *
     * @returns The immutable text content of this line object.
     *
     * @internal
     * @since 1.0.0
     */
    get text() { return this.#_text; }

    /**
     * Returns the current one-based logical line number.
     *
     * @returns The line number in the complete logical screen sequence.
     *
     * @internal
     * @since 1.0.0
     */
    get number() { return this.#_number; }

    /**
     * Changes the global logical line number without changing line content.
     *
     * The entry uses this when its start position changes or when preceding
     * entries gain or lose wrapped lines. Only values greater than zero are
     * rejected; this method does not verify that the value is an integer.
     *
     * @param value - New logical line number; expected to be a positive integer.
     * @throws Error if `value` is zero or negative.
     *
     * @internal
     * @since 1.0.0
     */
    changeNumber(value: number) {
        if (value <= 0) {
            throw new Error(`Invariant violation: Entry line number must be greater than 0, but got ${value}.`);
        }

        this.#_number = value;
    }
}

export default EntryLine;