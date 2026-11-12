import EntryLinesController from "./entry.lines.ct";

/**
 * Stores one cell's complete content and the logical lines derived from it.
 *
 * A `ScreenEntry` is the boundary between a cell's rendered string and the
 * ordered line model consumed by the viewport. It retains the original,
 * unwrapped content so the line controller can reflow it at a new terminal
 * width. The entry also owns a stable symbol identity, a one-based start line,
 * error-output metadata, and height bookkeeping used by the manager when
 * content changes.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITY BOUNDARY
 * ---------------------------------------------------------------------
 *
 * The entry is responsible for parsing its own content and renumbering its
 * generated lines when its start position changes. The entries manager
 * maintains ordering and positions relative to sibling entries. The viewport
 * maps those logical lines onto terminal rows and performs terminal I/O. An
 * entry never writes to the terminal or determines which lines are visible.
 *
 * ---------------------------------------------------------------------
 * 🔷 HEIGHT HISTORY
 * ---------------------------------------------------------------------
 *
 * `currentHeight` is the current number of generated logical lines.
 * `lastHeight` changes only when a refresh changes that count. The manager
 * uses the difference between these values to calculate a layout delta after
 * an update; a content change with the same line count leaves the height delta
 * at zero.
 *
 * @internal This class is used by TOM and is not a public terminal API.
 * @since 1.0.0
 */
class ScreenEntry {
    /**
     * Complete, unwrapped content received from the corresponding cell.
     *
     * This is the source text for every reflow. A content update replaces the
     * complete value; terminal resize reparses this retained value using the
     * latest terminal width.
     *
     * @internal
     * @since 1.0.0
     */
    #_content = '';

    /**
     * One-based logical line at which the entry's first generated line begins.
     *
     * This position is assigned and adjusted by the entries manager. Updating
     * it also renumbers all currently generated lines through
     * {@link #_helpers}.
     *
     * @internal
     * @since 1.0.0
     */
    #_startsAt: number;

    /**
     * Stable symbol identity used by the entry manager to find this entry.
     *
     * The identity does not change when content is replaced, reflowed, moved,
     * or renumbered.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_id = Symbol();

    /**
     * Owns this entry's generated line array and local line parsing.
     *
     * The entry uses the controller to regenerate lines at the current
     * terminal width and then assigns each line its global logical number.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_linesCT: EntryLinesController;

    /**
     * Height bookkeeping used to calculate the effect of content changes.
     *
     * `currentHeight` is the latest number of generated lines. `lastHeight`
     * is updated only when a refresh detects a different height, allowing the
     * entry manager to calculate the delta after an update.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_parsed = {
        currentHeight: 0,
        lastHeight: 0
    }

    /**
     * Entry metadata retained independently from content and line layout.
     *
     * `isError` identifies the origin category for downstream model consumers;
     * it does not select a different wrapping, numbering, or viewport path.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_flags = {
        isError: false
    }

    /**
     * Operations shared by refresh and line-position changes.
     *
     * `syncNumber` keeps the generated lines' one-based numbers aligned with
     * the entry start. `refresh` reparses retained content, synchronizes
     * numbering, and updates the height history only when the line count
     * changes.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Synchronizes each generated line number with the entry's current start.
         *
         * Line instances are retained by the controller during a position
         * change; updating their numbers avoids rebuilding identical text.
         *
         * @internal
         * @since 1.0.0
         */
        syncNumber: () => {
            const lines = this.#_linesCT.lines;
            const startsAt = this.#_startsAt;

            for (let i = 0; i < lines.length; i++) {
                const line = this.#_linesCT.lines[i];

                if (startsAt + i === line.number) { continue; }

                line.changeNumber(startsAt + i);
            }
        },

        /**
         * Regenerates lines from current content and records any height change.
         *
         * @returns `true` if the number of generated lines changed; otherwise
         * `false`.
         *
         * @internal
         * @since 1.0.0
         */
        refresh: () => {
            const ct = this.#_linesCT;
            ct.update(this.#_content);
            this.#_helpers.syncNumber();

            const height = ct.lines.length;
            const changed = height !== this.#_parsed.currentHeight;

            if (changed) {
                this.#_parsed.lastHeight = this.#_parsed.currentHeight;
                this.#_parsed.currentHeight = height;
            }

            return changed;
        }
    }

    /**
     * Creates an entry with its initial identity, position, metadata, and content.
     *
     * The constructor assigns the supplied start line, constructs the line
     * controller, and immediately stores and parses the initial content through
     * {@link updateContent}. That first refresh populates `lines` and
     * establishes `currentHeight`; no terminal output is emitted here.
     *
     * @param configs - Initial content, position, and metadata.
     * @param configs.content - Complete unwrapped string to parse into lines.
     * @param configs.startsAt - Positive one-based logical start line assigned
     * by the manager.
     * @param configs.isError - Whether this entry represents error output.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(configs: {
        content: string;
        startsAt: number;
        isError: boolean;
    }) {
        this.#_flags.isError = configs.isError;
        this.#_startsAt = configs.startsAt;

        this.#_linesCT = new EntryLinesController(this.#_id, this.#_startsAt);
        this.updateContent(configs.content);
    }

    /**
     * Returns the manager-facing stable identity for this entry.
     *
     * @returns This entry's stable symbol identity.
     *
     * @internal
     * @since 1.0.0
     */
    get id() { return this.#_id; }

    /**
     * Returns the one-based logical line at which this entry begins.
     *
     * @returns The current first logical line number of this entry.
     *
     * @internal
     * @since 1.0.0
     */
    get startsAt() { return this.#_startsAt; }

    /**
     * Indicates whether this entry was created for error output.
     *
     * @returns `true` when error-output metadata was set at creation.
     *
     * @internal
     * @since 1.0.0
     */
    get isError() { return this.#_flags.isError; }

    /**
     * Returns the current number of wrapped logical lines.
     *
     * @returns The current generated line count.
     *
     * @internal
     * @since 1.0.0
     */
    get height() { return this.#_parsed.currentHeight; }

    /**
     * Returns the height from immediately before the most recent height-changing
     * refresh.
     *
     * A refresh that does not change height does not update this value, so it
     * may describe an earlier layout change rather than the immediately
     * preceding refresh.
     *
     * @returns The prior line count from the latest height-changing refresh.
     *
     * @internal
     * @since 1.0.0
     */
    get lastHeight() { return this.#_parsed.lastHeight; }

    /**
     * Returns the controller's current generated line array.
     *
     * The array is the backing collection, not a defensive copy. TOM consumers
     * read it for layout; they must not mutate it.
     *
     * @returns The backing array of current generated lines.
     *
     * @internal
     * @since 1.0.0
     */
    get lines() { return this.#_linesCT.lines; }

    /**
     * Recomputes this entry's lines from retained content at the current width.
     *
     * The entry keeps its current start line while reparsing and synchronizes
     * the new line objects to that position. If the line count changes,
     * `lastHeight` is set to the prior height and `height` reflects the new one.
     *
     * @returns `true` if the generated line count changed; otherwise `false`.
     *
     * @internal
     * @since 1.0.0
     */
    refresh() { return this.#_helpers.refresh(); }

    /**
     * Replaces the complete content and reparses its generated lines.
     *
     * The content is retained before refresh so later terminal-width changes
     * can reflow the new value. Existing line objects are replaced by the
     * controller, even when the resulting height remains the same.
     *
     * @param content - New complete, unwrapped cell value.
     * @returns `true` if the generated line count changed; otherwise `false`.
     *
     * @internal
     * @since 1.0.0
     */
    updateContent(content: string) {
        this.#_content = content;
        return this.#_helpers.refresh();
    }

    /**
     * Moves the entry and all generated lines toward the beginning of the
     * logical sequence.
     *
     * This delegates validation and line renumbering to {@link setStartsAt}.
     * The entry manager supplies the removed height when compacting entries.
     *
     * @param amount - Number of logical lines to move; defaults to one. The
     * value must not move the entry before line one.
     *
     * @internal
     * @since 1.0.0
     */
    moveUp(amount: number = 1) {
        this.setStartsAt(this.#_startsAt - amount);
    }

    /**
     * Moves the entry and all generated lines toward the end of the logical
     * sequence.
     *
     * This delegates validation and line renumbering to {@link setStartsAt}.
     * The entry manager supplies the preceding height increase when content
     * above this entry grows.
     *
     * @param amount - Number of logical lines to move; defaults to one.
     *
     * @internal
     * @since 1.0.0
     */
    moveDown(amount: number = 1) {
        this.setStartsAt(this.#_startsAt + amount);
    }

    /**
     * Assigns a new one-based start and renumbers every current generated line.
     *
     * The position must be a positive integer. Validation happens before the
     * entry start or any line number changes, so invalid input leaves the entry
     * unchanged. An empty entry has no line objects to renumber, but its start
     * line is still updated.
     *
     * @param startsAt - New positive integer logical line number.
     * @throws RangeError if `startsAt` is not a positive integer.
     *
     * @internal
     * @since 1.0.0
     */
    setStartsAt(startsAt: number) {
        if (!Number.isInteger(startsAt) || startsAt < 1) {
            throw new RangeError(`Entry start line must be a positive integer, received ${startsAt}.`);
        }

        this.#_startsAt = startsAt;
        this.#_helpers.syncNumber();
    }
}

export default ScreenEntry;