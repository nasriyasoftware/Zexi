import type ScreenCell from "./cell";
import type TerminalEntry from "./terminal-cell";
import type { ZexiLogLevel } from "../types";
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

export interface ScreenCellEngineEvents {
    /**
     * Callback invoked whenever the visible state of the cell changes.
     *
     * The renderer uses this callback to synchronize screen state after:
     *
     * - direct value updates
     * - template re-rendering
     * - height recalculation
     *
     * @since 1.0.0
     */
    onUpdate: (cell: ScreenCell) => void;

    onRemove: () => void;
}

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
 * Extends the rendered entry data with its stable identity, current layout
 * position, and terminal row at which the entry begins.
 *
 * The `id` remains stable for the lifetime of the entry, while `index` and
 * `startsAt` are derived from the entry's current position within the layout.
 *
 * @since 1.0.0
 */
export type SnapshotEntry = SnapshotEntryData & {
    /**
     * Stable identity assigned when the entry is registered with the screen
     * layout.
     *
     * The identity remains unchanged for the lifetime of the entry and can
     * therefore be used to locate the entry independently of its current
     * position in the layout.
     *
     * @since 1.0.0
     */
    readonly id: symbol;

    /**
     * Current zero-based index of the entry within the layout.
     *
     * The index is derived dynamically from the entry's stable {@link id}.
     * Consequently, it automatically reflects structural changes such as
     * insertion or removal of entries before this entry.
     *
     * @since 1.0.0
     */
    readonly index: number;

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

/**
 * Handles logging requests generated by a terminal entry update.
 *
 * The logger receives the value that should be recorded and the fully
 * resolved logging options for the update.
 *
 * The message is already rendered into its terminal representation. The
 * logger therefore records the supplied string directly without applying
 * the normal value serialization pipeline.
 *
 * @param message - Already-rendered terminal entry value to log.
 * @param options - Resolved logging options for the update.
 *
 * @internal
 * @since 1.0.0
 */
export type TerminalEntryUpdateLogger = (
    message: string,
    options: Required<TerminalEntryLogOptions>
) => void;

/**
 * Controls whether a terminal entry update should produce a log event.
 *
 * Logging is disabled by default. When enabled, the updated entry value is
 * recorded using the specified log level.
 *
 * These options control logging only and do not affect how the entry is
 * rendered or updated.
 *
 * @since 1.0.0
 */
export type TerminalEntryLogOptions = {
    /**
     * Determines whether the updated entry value should be logged.
     *
     * When `false`, the entry is updated without producing a log event.
     *
     * @default false
     */
    log?: boolean;

    /**
     * Specifies the log level used when the update is logged.
     *
     * This option has no effect when {@link log} is `false`.
     *
     * @default 'info'
     */
    level?: ZexiLogLevel;
}

/**
 * Controls a direct value update performed on a terminal entry.
 *
 * These options combine entry finalization with optional logging of the
 * resulting entry value.
 *
 * @since 1.0.0
 */
export type TerminalEntryUpdateOptions = Prettify<
    Pick<TerminalCellOptions, 'final'> & TerminalEntryLogOptions
>;

/**
 * Controls a parameter update performed on a template-based terminal entry.
 *
 * In addition to controlling finalization and optional logging, these options
 * determine whether the supplied parameters are merged with or replace the
 * entry's existing template parameters.
 *
 * @since 1.0.0
 */
export type TerminalEntryParamsUpdateOptions = Prettify<
    TerminalEntryUpdateOptions & {
        /**
         * Determines how the supplied template parameters are applied.
         *
         * When `true`, the supplied parameters are merged with the existing
         * parameters. When `false`, the existing parameters are replaced.
         *
         * @default true
         */
        patch?: boolean;
    }
>;