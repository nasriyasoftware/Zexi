import terminalIO from "../../../io";
import ViewportBuffer from "./viewport.buffer";
import type EntriesManager from "../entries/entry.manager";
import type EntryLine from "../entries/entry.line";

/**
 * Maps logical entry lines onto terminal rows and reconciles their output.
 *
 * `TerminalViewport` is the physical-layout layer of TOM. The entry manager
 * supplies ordered entries whose lines have one-based logical line numbers;
 * the viewport translates those numbers to zero-based terminal row indices
 * and writes the currently visible lines through terminal I/O. It also tracks
 * which rows it has written so later renders can avoid duplicate writes and
 * clear stale managed output.
 *
 * ---------------------------------------------------------------------
 * 🔷 COORDINATE SYSTEM
 * ---------------------------------------------------------------------
 *
 * `_rowStart` is the one-based terminal row representing `_lineStart`, the
 * one-based logical line at the top of the viewport mapping. The first mapping
 * begins at the cursor row captured during terminal initialization. As output
 * scrolls, `_rowStart` moves toward row one; after it reaches row one,
 * `_lineStart` advances to represent lines that have scrolled off-screen.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING AND OWNERSHIP
 * ---------------------------------------------------------------------
 *
 * Each render derives visible rows from the manager's current entries, writes
 * changed row text, and clears rows previously tracked by the viewport that no
 * longer have a visible line. The row buffer is therefore a record of output
 * TOM has touched, not a second copy of logical content. Rows not previously
 * tracked are left untouched when they become empty, preserving output owned
 * by another writer or printed before TOM began managing the screen.
 *
 * The viewport neither stores cell content nor decides how content wraps.
 * Entry lines are produced by the entry layer using the current terminal
 * width. Their cached width metric is a code-unit heuristic, so the
 * cursor column selected after rendering may not match a grapheme-aware
 * terminal display width for all Unicode text.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCROLLING
 * ---------------------------------------------------------------------
 *
 * A positive height delta can extend logical content beyond the terminal.
 * Physical scrolling is initiated only when the caller identifies the change
 * as a newly created entry. Ordinary updates adjust the model but do not scroll
 * the terminal through this method. Negative deltas can reclaim a previously
 * advanced row origin without physically scrolling the screen upward.
 *
 * @internal This class belongs to the terminal screen implementation.
 * @since 1.0.0
 */
class TerminalViewport {
    /**
     * Source of truth for ordered entries, wrapped lines, and logical positions.
     *
     * The viewport traverses this manager during every render; it does not
     * cache an independent entry or line collection.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_entries: EntriesManager;

    /**
     * Cache of rows last written by the viewport.
     *
     * `undefined` buffer entries are not owned or are invalidated; the empty
     * string marks a row that the viewport knows it cleared.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_buffer = new ViewportBuffer();

    /**
     * One-based terminal row at which the first mapped logical line begins.
     *
     * This origin can move upward as terminal rows are physically scrolled,
     * until it reaches row one. Further scrolling then advances
     * {@link #_lineStart}.
     *
     * @internal
     * @since 1.0.0
     */
    #_rowStart = 1;

    /**
     * One-based logical line represented by {@link #_rowStart}.
     *
     * Advancing this value discards logical lines that have scrolled off the
     * top of the terminal while keeping the remaining line-to-row mapping
     * continuous.
     *
     * @internal
     * @since 1.0.0
     */
    #_lineStart = 1;

    /**
     * Creates the logical-to-physical mapping over an entry manager.
     *
     * The initial terminal row is clamped to `[1, terminal height]` using the
     * one-based cursor position recorded by terminal I/O. Logical numbering
     * begins at line one regardless of the captured cursor row. The row buffer
     * is initialized separately from this coordinate mapping.
     *
     * @param entries - Manager whose entries provide the viewport's lines.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(entries: EntriesManager) {
        this.#_entries = entries;

        this.#_rowStart = Math.max(
            1,
            Math.min(terminalIO.height, terminalIO.initialCursor.row)
        );
    }

    /**
     * Converts a one-based logical line number to a zero-based terminal row.
     *
     * The calculation offsets the requested line from `_lineStart`, then adds
     * that offset to `_rowStart`. Lines before the logical origin or beyond
     * the current terminal height are off-screen and produce `null`. The
     * result is a row index suitable for cursor positioning and buffer access.
     *
     * @param num - One-based logical line number to map.
     * @returns Zero-based terminal row, or `null` if the line is off-screen.
     *
     * @internal
     * @since 1.0.0
     */
    #_getLineRow(num: number) {
        const logicalRow = num - this.#_lineStart + this.#_rowStart - 1;
        if (
            logicalRow < 0 ||
            logicalRow >= terminalIO.height
        ) { return null; }

        return logicalRow;
    }

    /**
     * Returns the row cache used to avoid redundant output and track rows
     * managed by this viewport.
     *
     * @returns The viewport's row buffer.
     *
     * @internal
     * @since 1.0.0
     */
    get buffer() { return this.#_buffer; }

    /**
     * Restores the initial logical-to-terminal mapping and invalidates cached rows.
     *
     * This is used after terminal output has been cleared. It restores the
     * initial cursor row, resets the logical origin to line one, and marks all
     * buffer rows untracked so the next render writes current content again.
     *
     * @internal
     * @since 1.0.0
     */
    reset() {
        this.#_rowStart = Math.max(
            1,
            Math.min(terminalIO.height, terminalIO.initialCursor.row)
        );
        this.#_lineStart = 1;
        this.#_buffer.reset();
    }

    /**
     * Reconciles all currently visible logical lines with terminal rows.
     *
     * The current entries are traversed in manager order and each visible line
     * is assigned to its mapped row. Changed rows are written through the
     * buffer; rows that were previously tracked but no longer have a visible
     * line are cleared. If any line is visible, the cursor is placed at the end
     * of the last visible line, with its column capped to the last terminal
     * column. The line width used for this position is the entry line's cached
     * code-unit heuristic, not a terminal display-column calculation.
     *
     * An empty visible result still clears all tracked rows, then returns
     * without an explicit final cursor placement because no line provides a
     * destination.
     *
     * @internal
     * @since 1.0.0
     */
    render() {
        const linesByRow = new Map<number, EntryLine>();

        for (const entry of this.#_entries.entries) {
            for (const line of entry.lines) {
                const row = this.#_getLineRow(line.number);
                if (row !== null) {
                    linesByRow.set(row, line);
                }
            }
        }

        for (let row = 0; row < terminalIO.height; row++) {
            const line = linesByRow.get(row);
            if (line) {
                this.buffer.updateRow(row, line.text);
            } else {
                this.buffer.clearIfTracked(row);
            }
        }

        if (linesByRow.size === 0) { return; }

        const lastVisibleRow = (() => {
            let lastVisibleRow = -1;

            for (const row of linesByRow.keys()) {
                if (row > lastVisibleRow) {
                    lastVisibleRow = row;
                }
            }

            return lastVisibleRow;
        })();


        const lastVisibleLine = linesByRow.get(lastVisibleRow)!;
        const column = Math.min(
            lastVisibleLine.width,
            terminalIO.width - 1
        );
        terminalIO.output.cursorTo(column, lastVisibleRow);
    }

    /**
     * Adjusts scroll origins after a logical content height change.
     *
     * Negative deltas calculate how many tracked rows are no longer needed and
     * move `_rowStart` back toward row one. They do not physically scroll the
     * terminal. Positive deltas compare the final logical line against the
     * terminal height. If overflow exists and `forNewEntry` is true, the
     * method scrolls once per overflow row, shifts the buffer up, then moves
     * `_rowStart` upward or advances `_lineStart` after the row origin reaches
     * one. Positive updates without that flag do not initiate scrolling here.
     *
     * When `TEST_ITEMS_GENERATED` is set, a positive overflow sets
     * `TERMINAL_OVERFLOW`. A positive delta with no overflow throws until that
     * environment marker is already set; this guard enforces the test suite's
     * expected item-generation order and does not affect normal runs.
     *
     * @param delta - Change in the total logical line count. Negative values
     * represent shrinkage; positive values represent growth.
     * @param options - Optional origin metadata.
     * @param options.forNewEntry - When `true`, permits physical scrolling if
     * the added entry overflows the terminal; defaults to `false`.
     *
     * @internal
     * @since 1.0.0
     */
    updatePosition(delta: number, options?: { forNewEntry?: boolean }) {
        if (delta < 0) {
            const underflow = Math.max(0, -delta - this.#_buffer.size);
            this.#_rowStart = Math.max(1, this.#_rowStart - underflow);
            return;
        }

        if (delta === 0) { return; }

        const lastLogicalLine = this.#_entries.totalLines;
        const lastRow = lastLogicalLine - this.#_lineStart + this.#_rowStart - 1;
        const overflow = Math.max(0, lastRow - terminalIO.height + 1);

        if (process.env.TEST_ITEMS_GENERATED) {
            if (overflow > 0) {
                process.env.TERMINAL_OVERFLOW = 'true';
            } else if (process.env.TERMINAL_OVERFLOW !== 'true') {
                throw new Error(`A delta of ${delta} is attempting to overflow the terminal after the first overflow was `);
            }
        }

        if (overflow > 0 && options?.forNewEntry === true) {
            for (let i = 0; i < overflow; i++) {
                terminalIO.output.cursorTo(0, terminalIO.height - 1);
                terminalIO.output.write('\r\n');
                this.#_buffer.shiftUp(1);

                if (this.#_rowStart > 1) {
                    this.#_rowStart--;
                } else {
                    this.#_lineStart++;
                }
            }
        }
    }
}

export default TerminalViewport;