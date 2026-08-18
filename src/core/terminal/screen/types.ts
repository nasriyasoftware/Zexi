import type TerminalEntry from "./terminal-cell";
import type { BaseQueueTask, Prettify } from "@nasriya/atomix";

/**
 * Initial configuration for a terminal screen cell.
 *
 * A cell can be initialized in one of two modes:
 *
 * - **Direct mode** — renders a string value directly.
 * - **Template mode** — renders a template using the supplied parameters.
 *
 * ---------------------------------------------------------------------
 * 🔷 DIRECT MODE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * {
 *     value: 'Loading...'
 * }
 * ```
 *
 * The `value` is rendered directly. A template may optionally be provided
 * for later template-based updates.
 *
 * ---------------------------------------------------------------------
 * 🔷 TEMPLATE MODE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * {
 *     template: 'Progress: ${value}%',
 *     params: { value: 50 }
 * }
 * ```
 *
 * The `params` object provides the initial values used to render the
 * template. Template mode requires a `template`.
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION
 * ---------------------------------------------------------------------
 *
 * Setting `final` to `true` finalizes the cell after its initial value has
 * been rendered, preventing subsequent updates.
 *
 * @since 1.0.0
 */
export type TerminalCellOptions = Prettify<{
    /**
     * Finalizes the cell immediately after initialization.
     *
     * @default false
     * @since 1.0.0
     */
    final?: boolean;
} & ({
    /**
     * Initial string value rendered directly by the cell.
     *
     * @since 1.0.0
     */
    value: string;

    /**
     * Optional template that can be used for subsequent parameter updates.
     *
     * @since 1.0.0
     */
    template?: string;
} | {
    /**
     * Initial template parameters used to render the cell.
     *
     * @since 1.0.0
     */
    params: Record<string, unknown>;

    /**
     * Template used to render the supplied parameters.
     *
     * @since 1.0.0
     */
    template: string;
})>;

/**
 * Data required to register a rendered entry in the screen snapshot.
 *
 * This type represents the rendered state supplied when an entry is added
 * to the snapshot. The snapshot derives the entry's terminal position from
 * the current snapshot height and cursor position.
 *
 * @since 1.0.0
 */
export interface SnapshotEntryData {
    /** The value of the cell */
    value: string;
    /** The number of lines the cell spans */
    height: number;
}

/**
 * A registered entry in the screen snapshot.
 *
 * Extends the rendered entry data with the terminal row at which the entry
 * begins.
 *
 * The `startsAt` position is calculated relative to the terminal cursor
 * position captured when the screen subsystem was initialized. As entries
 * are
 * added, their positions advance according to the total height of the
 * entries preceding them.
 *
 * @since 1.0.0
 */
export type SnapshotEntry = SnapshotEntryData & {
    /**
     * Terminal row at which the entry begins.
     *
     * The position includes the terminal space that existed before Zexi
     * began managing screen output. It therefore does not necessarily start
     * at row `0`.
     *
     * @since 1.0.0
     */
    startsAt: number;
};

/**
 * Function used by the screen renderer to render a screen value.
 *
 * The renderer receives the value to render and returns the resulting
 * terminal output representation.
 *
 * @since 1.0.0
 */
export type TerminalRendererFunc = (index: number, updatedEntry: SnapshotEntry) => void;

/**
 * Queue task used to create a dynamic terminal entry.
 *
 * The task payload contains the {@link TerminalEntry} created for the entry.
 * This task type is used specifically by the terminal's dynamic-entry
 * creation pipeline.
 *
 * @since 1.0.0
 */
export type TerminalEntryCellTask = BaseQueueTask<TerminalEntry>;