import terminalIO from "../../../io";
import EntryLine from "./entry.line";

/**
 * Converts an entry's complete string value into width-constrained line records.
 *
 * The controller reads the current width from terminal I/O whenever content
 * is updated. It first splits the value at `\n`, preserving empty segments,
 * then slices any segment longer than the available width into consecutive
 * chunks. Every parse replaces the contents of the existing {@link lines}
 * array with newly created line objects whose numbers initially start at one.
 * The owning entry subsequently assigns their positions in the full logical
 * screen sequence.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRAPPING MODEL
 * ---------------------------------------------------------------------
 *
 * Wrapping is based on JavaScript string length and `slice()` indices, which
 * count UTF-16 code units. It does not seek word boundaries or account for
 * terminal display columns, ANSI escape sequences, grapheme clusters, wide
 * glyphs, or combining marks. A newline creates a new segment; `\r` is not
 * removed or interpreted specially.
 *
 * The parser assumes terminal I/O reports a positive width. Its loop advances
 * by the supplied width when slicing a long segment, so a zero width is not a
 * supported input.
 *
 * @internal This controller is an implementation detail of the screen model.
 * @since 1.0.0
 */
class EntryLinesController {
    /**
     * Current line records generated from the entry's retained content.
     *
     * Parsing clears and repopulates this array in place, preserving the array
     * identity for consumers that retain a reference. The individual
     * {@link EntryLine} objects are newly allocated on each parse. This is a
     * mutable internal collection; callers must not add, remove, or reorder its
     * elements because entry heights and line numbering depend on it.
     *
     * @internal
     * @since 1.0.0
     */
    readonly lines: EntryLine[] = [];

    /**
     * Stable owning-entry identity copied into each generated line.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_entryId: symbol;

    /**
     * Initial one-based logical line origin retained by this controller.
     *
     * `setStartingNumber()` does not change this field. The owning entry keeps
     * the authoritative current origin and synchronizes line numbers when it
     * moves; `sync()` uses this originally supplied value.
     *
     * @internal
     * @since 1.0.0
     */
    #_startsAt: number;

    /**
     * Splits newline-separated content and slices each segment to `width` units.
     *
     * Empty segments are preserved as empty lines, including the single empty
     * segment produced by empty content and segments created by leading,
     * adjacent, or trailing newline characters. An over-width segment is
     * sliced without word-boundary handling. Each generated line gets a new
     * object and a local one-based number. The method uses the provided width;
     * obtaining the width and synchronizing global line positions are separate
     * operations.
     *
     * @param content - Complete content to parse.
     * @param width - Maximum number of JavaScript UTF-16 code units in each
     * chunk. Must be positive when any segment is longer than zero.
     *
     * @internal
     * @since 1.0.0
     */
    #_parse(content: string, width: number) {
        this.lines.length = 0;

        for (const line of content.split('\n')) {
            if (line.length <= width) {
                this.#_addLine(line);
                continue;
            }

            let offset = 0;
            while (offset < line.length) {
                this.#_addLine(line.slice(offset, offset + width));
                offset += width;
            }
        }
    }

    /**
     * Appends a newly allocated line with its local number and owning identity.
     *
     * @param value - Text assigned to the generated line.
     *
     * @internal
     * @since 1.0.0
     */
    #_addLine(value: string) {
        this.lines.push(
            new EntryLine(
                this.#_entryId, {
                text: value,
                number: this.lines.length + 1
            })
        );
    }

    /**
     * Creates the line controller associated with a single logical entry.
     *
     * Construction does not parse content; the entry's initial update performs
     * the first parse. The starting line is retained as the controller's
     * original origin, while the owning entry is authoritative for subsequent
     * position changes.
     *
     * @param entryId - Stable identity shared by all lines from this entry.
     * @param startsAt - Initial one-based global line number for the entry.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(entryId: symbol, startsAt: number) {
        this.#_entryId = entryId;
        this.#_startsAt = startsAt;
    }

    /**
     * Returns the line origin supplied when the controller was constructed.
     *
     * @returns The controller's original one-based start line.
     *
     * @internal
     * @since 1.0.0
     */
    get startsAt() { return this.#_startsAt; }

    /**
     * Assigns consecutive logical line numbers to the current line objects.
     *
     * The operation validates that the first line number is positive, then
     * numbers each line consecutively. It rejects non-positive values but
     * does not independently enforce an integer value. It does not change the
     * retained `startsAt` field, nor does it change the owning entry's start;
     * the entry is responsible for keeping its own position and line numbers
     * synchronized.
     *
     * @param startsAt - Positive number for the first generated line.
     * @throws Error if `startsAt` is zero or negative.
     *
     * @internal
     * @since 1.0.0
     */
    setStartingNumber(startsAt: number) {
        if (startsAt <= 0) {
            throw new Error(`Invariant violation: Entry lines starting number must be greater than 0, but got ${startsAt}.`);
        }

        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i]
            line.changeNumber(startsAt + i);
        }
    }

    /**
     * Rebuilds the generated line list using the current terminal width.
     *
     * The parser clears and repopulates the existing `lines` array. Resulting
     * line numbers begin at one; the owning entry is responsible for assigning
     * their global positions. Content is treated as a complete replacement,
     * not appended to the previous value.
     *
     * @param content - Complete content string to reparse.
     *
     * @internal
     * @since 1.0.0
     */
    update(content: string) {
        this.#_parse(content, terminalIO.width);
    }

    /**
     * Renumbers current lines from the controller's original starting origin.
     *
     * Existing line objects are updated in place when their number differs.
     * This method uses the origin originally supplied to the constructor, even
     * if `setStartingNumber()` has since assigned another number. Normal entry
     * positioning is synchronized by the owning entry's own position helper;
     * this method is not that helper and is not used for ordinary entry moves.
     *
     * @internal
     * @since 1.0.0
     */
    sync() {
        const startsAt = this.#_startsAt;

        for (let i = 0; i < this.lines.length; i++) {
            const line = this.lines[i];
            const newValue = startsAt + i;

            if (newValue === line.number) { continue; }

            line.changeNumber(newValue);
        }
    }
}

export default EntryLinesController;