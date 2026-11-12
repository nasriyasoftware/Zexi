import terminalIO from "../../../io"

/**
 * Tracks the last text TOM wrote to each zero-based terminal row.
 *
 * The buffer belongs to a viewport and is only a write cache; entry content
 * and logical line positions remain owned by the entry manager. A known row
 * stores the complete text last emitted for that row. `undefined` means the
 * row is not currently tracked or that its previous contents were invalidated;
 * `''` means the viewport knows the row is clear. The viewport uses this
 * distinction to remove stale managed output without erasing untracked output
 * from another writer or from before the viewport took ownership.
 *
 * ---------------------------------------------------------------------
 * 🔷 CACHE INVALIDATION
 * ---------------------------------------------------------------------
 *
 * A terminal resize changes available rows and may change upstream wrapping,
 * so every cache value is invalidated while the buffer is resized to the new
 * terminal height. A full reset has the same effect. A physical scroll shifts
 * cached rows up and leaves newly added slots untracked until the next render.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITE ORDER
 * ---------------------------------------------------------------------
 *
 * A changed row is recorded in the cache before terminal I/O moves the cursor,
 * clears the line, and writes replacement text. If one of those I/O operations
 * fails, the cache may claim a value that was only partially written; a reset
 * or resize is then needed to force a complete redraw.
 *
 * @internal This cache is an implementation detail of the terminal viewport.
 * @since 1.0.0
 */
class ViewportBuffer {
    /**
     * Last written text by zero-based terminal row.
     *
     * An undefined element is untracked or invalidated; `''` records a tracked,
     * cleared row. The array length is kept equal to the current terminal height.
     *
     * @internal
     * @since 1.0.0
     */
    #_buffer: Array<string | undefined> = [];

    /**
     * Allocates one cache slot per terminal row and subscribes to resize events.
     *
     * The initial allocation uses the terminal height available at construction.
     * Every resize changes the array length to the new height and fills all
     * slots with `undefined`, because the previous rendered layout can no
     * longer be assumed to match the resized terminal.
     *
     * @internal
     * @since 1.0.0
     */
    constructor() {
        terminalIO.events.on('resize', event => {
            this.#_buffer.length = terminalIO.height;
            this.#_buffer.fill(undefined);
        });

        this.#_buffer.length = terminalIO.height;
    }

    /**
     * Replaces a terminal row only when its cached content differs from `text`.
     *
     * The requested text is recorded in the cache first. Terminal I/O then
     * moves to column zero of the requested row, clears through the end of
     * that line, and writes the complete replacement text. An identical cached
     * value is a no-op and produces no cursor movement or write. Terminal I/O
     * errors propagate to the caller; because the cache is updated first, a
     * failed operation may require reset or resize to invalidate the cache.
     *
     * @param row - Zero-based terminal row to update. The caller is responsible
     * for passing a row within the current terminal height.
     * @param text - Complete replacement text for that row; this is not a
     * partial append.
     *
     * @internal
     * @since 1.0.0
     */
    updateRow(row: number, text: string) {
        const oldValue = this.#_buffer[row];
        if (oldValue === text) { return; }

        this.#_buffer[row] = text;

        terminalIO.output.cursorTo(0, row);
        terminalIO.output.clearLine(-1);
        terminalIO.output.write(text);
    }

    /**
     * Counts rows for which the buffer has a known value.
     *
     * Both non-empty text and the empty string count as tracked rows. Only
     * `undefined` is untracked. This count can be used when reclaiming viewport
     * origin space; it is not the count of non-empty rows.
     *
     * @returns Number of tracked terminal rows.
     *
     * @internal
     * @since 1.0.0
     */
    get size() {
        return this.#_buffer.reduce(
            (count, row) => count + (row === undefined ? 0 : 1),
            0
        );
    }

    /**
     * Resizes the cache to the current terminal height and invalidates every row.
     *
     * @internal
     * @since 1.0.0
     */
    reset() {
        this.#_buffer.length = terminalIO.height;
        this.#_buffer.fill(undefined);
    }

    /**
     * Removes cached entries for rows scrolled off the top of the terminal.
     *
     * The buffer is then extended or truncated to the current terminal height.
     * Any new slots remain `undefined`, so the viewport must render them before
     * their contents can be considered current. This method changes cache
     * positions only; it does not issue terminal scroll commands.
     *
     * @param rows - Number of top rows to discard; negative values are treated
     * as zero.
     *
     * @internal
     * @since 1.0.0
     */
    shiftUp(rows: number) {
        const total = Math.max(0, rows);
        this.#_buffer.splice(0, total);
        this.#_buffer.length = terminalIO.height;
    }

    /**
     * Clears a row only when TOM previously tracked its contents.
     *
     * An untracked row is left untouched, avoiding erasure of terminal output
     * that belongs to another writer or predates the viewport. If the row is
     * already tracked as empty, `updateRow()` detects the unchanged value and
     * performs no terminal I/O.
     *
     * @param row - Zero-based terminal row to clear when tracked.
     *
     * @internal
     * @since 1.0.0
     */
    clearIfTracked(row: number) {
        if (this.#_buffer[row] === undefined) { return; }
        this.updateRow(row, '');
    }
}

export default ViewportBuffer;