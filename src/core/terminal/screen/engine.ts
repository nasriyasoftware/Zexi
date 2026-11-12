import terminalIO from "../io";
import TerminalObjectModel from "./tom/tom";
import ScreenCell from "./tom/cells/cell";
import TerminalCell from "./tom/cells/terminal.cell";
import type { TerminalCellOptions } from "./tom/types";

/**
 * Coordinates terminal object-model updates and renders managed cells through
 * terminal I/O.
 *
 * `ScreenEngine` is the rendering boundary between the terminal API's cell
 * objects and {@link TerminalObjectModel} (TOM). It delegates entry identity,
 * line parsing, ordering, viewport mapping, row caching, and reflow to TOM,
 * then exposes high-level operations for creating entries, adding a blank
 * line, and clearing the active terminal screen before resetting TOM.
 *
 * The engine does not initialize the process streams or select the terminal
 * screen. `ZexiTerminal` schedules `terminalIO.initialize()` before queued
 * screen work; terminal I/O owns the startup screen policy, cursor and size
 * queries, and readiness transition. TOM reads the resulting initial cursor
 * position and terminal dimensions from `terminalIO` when it constructs and
 * updates its viewport.
 *
 * ---------------------------------------------------------------------
 * 🔷 CELL AND ENTRY OWNERSHIP
 * ---------------------------------------------------------------------
 *
 * A cell is the mutable value exposed to a caller. TOM stores the cell's
 * rendered text as a stable entry and associates update and removal handlers
 * with that entry's identity. When the cell changes or is removed, TOM
 * recalculates logical line positions and asks the viewport to reconcile the
 * affected terminal rows.
 *
 * The engine supports two cell targets:
 *
 * - `internal` creates a {@link ScreenCell} for terminal-owned rendering work.
 * - `external` creates a {@link TerminalCell} that can be returned by the
 *   public terminal API and can carry terminal-specific logging behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING AND POSITIONING
 * ---------------------------------------------------------------------
 *
 * TOM retains logical entry content and positions; the viewport maps visible
 * logical lines to physical terminal rows. It writes changed row contents,
 * clears rows previously owned by the viewport that are no longer occupied,
 * and positions the cursor after the last visible line. The engine does not
 * keep a second layout snapshot or calculate terminal columns itself.
 *
 * The viewport uses the cursor origin and dimensions supplied by terminal I/O.
 * Its line-width metric is a layout heuristic rather than a full grapheme-aware
 * terminal display-width calculation, so some Unicode or control-sequence
 * content can require special handling in the TOM layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 INITIALIZATION BOUNDARY
 * ---------------------------------------------------------------------
 *
 * `ScreenEngine` assumes terminal initialization has completed before TOM
 * creates a cell. TOM checks `terminalIO.ready` and throws an invariant error
 * if a cell is created too early. The engine does not start initialization or
 * change the original/alternate screen itself.
 *
 * Initialization is queued by `ZexiTerminal` before operations such as log
 * printing, `createEntry()`, and `clear()` are added to the shared terminal
 * queue. This preserves the synchronous public API while ensuring that the
 * queued cell operation runs only after `terminalIO.initialize()` completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 TERMINAL CLEARING AND TOM RESET
 * ---------------------------------------------------------------------
 *
 * {@link clear} moves the cursor to row zero, column zero, erases that line
 * and all rows below it, then clears TOM's entries and resets its viewport
 * mapping and rendered-row buffer. This clears the active screen from its
 * origin, including any terminal content that predates TOM; it is not limited
 * to rows previously written by the viewport. Cells created before the clear
 * are detached from TOM, so subsequent updates to those cells no longer render.
 *
 * @since 1.0.0
 */
class ScreenEngine {
    /**
     * Terminal object model that owns managed entries and viewport rendering.
     *
     * The engine delegates entry creation, content updates, removal, reflow,
     * and clearing to this single TOM instance. Keeping it on the engine means
     * every cell managed by this engine shares the same entry sequence and row
     * cache.
     *
     * @since 1.0.0
     */
    readonly #_tom = new TerminalObjectModel();

    /**
     * Creates and registers a new screen output entry.
     *
     * The created entry becomes part of the rendering pipeline immediately.
     * Any future updates or removal of the entry are automatically propagated
     * into the terminal renderer.
     *
     * By default, the method creates an internal {@link ScreenCell}. When the
     * `target` is set to `'external'`, the method creates a {@link TerminalCell}
     * intended to be returned through the terminal's public API.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION REQUIREMENT
     * ---------------------------------------------------------------------
     *
     * Terminal I/O must be ready before an entry can be created. TOM checks
     * this prerequisite before registering a cell and throws an invariant
     * violation if creation is attempted too early.
     *
     * ---------------------------------------------------------------------
     * 🔷 REGISTRATION
     * ---------------------------------------------------------------------
     *
     * Creating an entry performs the following operations:
     *
     * TOM registers the cell's initial value and metadata, creates a stable
     * entry identity, then supplies update and removal handlers to the cell.
     * Those handlers use the identity to update or remove the associated TOM
     * entry, allowing TOM to reflow later entries and render the affected rows.
     *
     * ---------------------------------------------------------------------
     * 🔷 OUTPUT METADATA
     * ---------------------------------------------------------------------
     *
     * The `isError` option is captured when the entry is registered and stored
     * on its TOM entry.
     *
     * When `isError` is `true`, the entry's output is written through the
     * terminal's stderr stream instead of stdout.
     *
     * The value is established when the entry is created and remains unchanged
     * for the lifetime of the TOM entry. It is therefore not part of the
     * mutable rendered state propagated by the update handler.
     *
     * ---------------------------------------------------------------------
     * 🔷 UPDATE PROPAGATION
     * ---------------------------------------------------------------------
     *
     * Once registered, changes to the entry are propagated through the internal
     * update event handler.
     *
     * The handler updates the TOM entry identified during creation. TOM
     * recalculates line positions and renders the visible rows affected by the
     * update.
     *
     * ---------------------------------------------------------------------
     * 🔷 REMOVAL
     * ---------------------------------------------------------------------
     *
     * The entry is associated with an internal removal event handler.
     *
     * When invoked, the handler:
     *
     * - removes the TOM entry using its stable identity
     * - reflows the remaining entries
     * - updates or clears affected viewport rows
     *
     * The removal handler is executed at most once. Once an entry has been
     * removed, it cannot be removed from the screen again.
     *
     * ---------------------------------------------------------------------
     * 🔷 TARGET
     * ---------------------------------------------------------------------
     *
     * The optional `target` parameter determines the type of entry created:
     *
     * - `'internal'` or omitted → creates a {@link ScreenCell}
     * - `'external'` → creates a {@link TerminalCell}
     *
     * The external target is intended for entries exposed through the terminal's
     * public API, while the default target is used internally by the screen
     * engine.
     *
     * ---------------------------------------------------------------------
     * 🔷 ENTRY LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * The cell remains associated with its TOM entry until it is removed or the
     * screen is cleared. TOM owns the entry's current logical-line positions;
     * they may change when other entries are updated or removed.
     *
     * @param config - Initial configuration for the entry.
     * @param target - Determines whether an internal or externally exposed entry
     * is created.
     * @returns The created screen cell or terminal entry, depending on `target`.
     *
     * @throws Error if terminal I/O is not ready.
     *
     * @since 1.0.0
     */
    create<T extends 'internal' | 'external' = 'internal'>(
        config: TerminalCellOptions,
        target?: T
    ): T extends 'external' ? TerminalCell : ScreenCell {
       return this.#_tom.create(config, target);
    }

    /**
     * Inserts an immutable empty line into the screen.
     *
     * Useful for:
     *
     * - spacing
     * - visual grouping
     * - section separation
     *
     * TOM retains the blank cell as an entry, so it occupies a logical line and
     * affects the positions of subsequent entries.
     *
     * @since 1.0.0
     */
    newLine() {
        this.create({ value: '', final: true });
    }

    /**
     * Clears the active terminal screen from its origin and resets TOM.
     *
     * The cursor moves to row zero, column zero, the current line and every
     * row below it are cleared, and TOM removes every registered entry and
     * resets its viewport mapping and rendered-row buffer. This operation
     * clears the screen from the origin rather than limiting the erase to rows
     * tracked as TOM output, so output that existed before TOM began managing
     * the screen can also be removed. Cells returned before this call are
     * detached from TOM; updating them afterward does not render.
     *
     * @since 1.0.0
     */
    clear() {
        terminalIO.output.cursorTo(0, 0);
        terminalIO.output.clearLine(1);
        terminalIO.output.clearScreenDown();
        this.#_tom.clear();
    }
}

export default ScreenEngine;