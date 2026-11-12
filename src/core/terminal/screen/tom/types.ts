import type { BaseQueueTask, Prettify } from "@nasriya/atomix";
import type { ZexiLogLevel } from "../../types";
import type TerminalCell from "./cells/terminal.cell";

/**
 * Queue task whose action result is an externally exposed terminal cell.
 *
 * This alias specializes Atomix's {@link BaseQueueTask} result type for the
 * task that creates a {@link TerminalCell}. Its `action` resolves to that cell,
 * and the queue passes the same typed result to `onResolve`, where the terminal
 * attaches the cell's update logger before exposing it to the caller.
 *
 * @internal This alias supports the terminal's internal entry queue.
 * @since 1.0.0
 */
export type TerminalCellTask = BaseQueueTask<TerminalCell>;

/**
 * Initial configuration for a cell managed by the terminal object model.
 *
 * The required properties form a structural union: provide either a direct
 * `value`, optionally paired with a template, or both `template` and `params`.
 * The template is retained for later parameter-based updates; a direct value
 * remains the cell's current output until it is explicitly updated.
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
 * for later template-based updates. The initial value is not interpolated
 * through that template.
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
 * The own enumerable properties of `params` provide the initial replacement
 * values. Matching `${key}` placeholders are replaced with `String(value)`;
 * placeholders without a matching parameter remain in the output. Template
 * mode requires a `template` because no direct value is supplied.
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION
 * ---------------------------------------------------------------------
 *
 * Setting `final` to `true` applies the initial direct value or parameter
 * render first, then finalizes the cell. Later value updates, template changes,
 * and parameter updates are rejected. Finalization does not remove the cell.
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR OUTPUT
 * ---------------------------------------------------------------------
 *
 * Setting `isError` to `true` stores error-output metadata on the corresponding
 * entry. The flag does not select different formatting, line wrapping, or
 * viewport placement behavior.
 *
 * @since 1.0.0
 */
export type TerminalCellOptions = Prettify<{
    /**
     * Finalizes the cell after its initial content has been installed.
     *
     * The initial content is still rendered. Finalization only prevents later
     * changes; it does not remove the cell or freeze the containing screen.
     *
     * @default false
     * @since 1.0.0
     */
    final?: boolean;

    /**
     * Marks the cell's entry as originating from error output.
     *
     * The TOM entry retains this flag for consumers of the entry model. It
     * does not affect wrapping or line placement.
     *
     * @default false
     * @since 1.0.0
     */
    isError?: boolean;
} & ({
    /**
     * Initial string rendered directly as the cell's current value.
     *
     * This branch does not interpolate the value through the optional
     * `template`. Later calls to `update()` also preserve that template and its
     * stored parameters.
     *
     * @since 1.0.0
     */
    value: string;

    /**
     * Optional template retained for subsequent parameter updates.
     *
     * The initial direct value is not rendered through this template. Supplying
     * it does not create initial template parameters.
     *
     * @since 1.0.0
     */
    template?: string;
} | {
    /**
     * Initial template parameters used to produce the first rendered value.
     *
     * Parameter values are converted with JavaScript `String()` during
     * interpolation. Keys without a matching placeholder are retained in cell
     * state but do not alter the rendered string.
     *
     * @since 1.0.0
     */
    params: Record<string, unknown>;

    /**
     * Template used to render the supplied parameters.
     *
     * Each matching `${key}` placeholder is replaced globally for the supplied
     * key. The template remains active for later `updateParams()` calls.
     *
     * @since 1.0.0
     */
    template: string;
})>;

/**
 * Callback contract connecting cell lifecycle changes to the screen engine.
 *
 * The screen engine supplies these functions when constructing a cell. The
 * cell owns when they are called; consumers should not create or replace this
 * interface as a separate event subscription system.
 *
 * @internal
 * @since 1.0.0
 */
export interface ScreenCellEngineEvents {
    /**
     * Callback invoked when the cell's rendered string actually changes.
     *
     * The cell sends the complete rendered value, not a diff or partial patch.
     * It suppresses notifications during construction, ignores updates after
     * removal, and does not notify when the new value equals the old value.
     * The renderer uses this callback to synchronize screen state after:
     *
     * - direct value updates
     * - template re-rendering
     * - height recalculation
     *
     * @since 1.0.0
     */
    onUpdate: (content: string) => void;

    /**
     * Callback invoked when the cell is removed from the managed screen.
     *
     * The terminal object model uses this callback to remove the cell's
     * corresponding entry and synchronize affected terminal rows. The cell
     * marks itself removed before invoking this callback, so reentrant or later
     * update attempts are ignored.
     *
     * The callback is invoked at most once for a given cell.
     *
     * @since 1.0.0
     */
    onRemove: () => void;
}

/**
 * Half-open interval of one-based logical screen line numbers.
 *
 * `start` identifies the first included line. `end` identifies the boundary
 * immediately after the range, so the affected line numbers satisfy
 * `start <= line < end`. This convention allows the range length to be
 * calculated as `end - start` and represents an empty range when both values
 * are equal.
 *
 * Entries and manager operations use this coordinate system. The viewport
 * converts logical line numbers to zero-based terminal row indices; callers
 * must not pass a range value directly to a cursor-position API.
 *
 * @internal
 * @since 1.0.0
 */
export interface LinesRange {
    /**
     * One-based logical number of the first included line.
     *
     * @internal
     * @since 1.0.0
     */
    start: number;

    /**
     * Exclusive one-based boundary after the affected lines.
     *
     * @internal
     * @since 1.0.0
     */
    end: number;
}

/**
 * Describes the logical region affected by replacing an entry's content.
 *
 * The inherited range is half-open and may include subsequent entries whose
 * positions shifted after the updated entry changed height. `heightDelta`
 * reports the updated entry's own line-count change, independently of the
 * total affected range length. When no height change occurs, the range still
 * describes the updated entry's current lines.
 *
 * @internal
 * @since 1.0.0
 */
export type EntryUpdateRange = Readonly<LinesRange & {
    /**
     * Difference between the updated entry's new and previous heights.
     * Positive means growth, negative means shrinkage, and zero means unchanged.
     *
     * @internal
     * @since 1.0.0
     */
    heightDelta: number;
}>;

/**
 * Controls logging for one terminal cell update.
 *
 * Logging is disabled by default. When enabled, the updated cell value is
 * recorded using the specified log level. `TerminalCell` passes the resolved
 * options to its attached logger after delegating the update; the logger
 * decides whether to emit anything based on `log`.
 *
 * These options control logging only and do not affect the value, template,
 * parameters, finalization state, line layout, or screen rendering.
 *
 * @since 1.0.0
 */
export type TerminalCellLogOptions = {
    /**
     * Determines whether the attached logger should record the resulting value.
     *
     * When `false`, the cell is still updated, but the logger should not emit a
     * log event for this update.
     *
     * @default false
     * @since 1.0.0
     */
    log?: boolean;

    /**
     * Specifies the level supplied to the attached logger when logging is
     * enabled.
     *
     * This option has no effect when {@link log} is `false`.
     *
     * @default 'info'
     * @since 1.0.0
     */
    level?: ZexiLogLevel;
};

/**
 * Controls one direct string-value update performed on a terminal cell.
 *
 * These options combine cell finalization with optional logging of the
 * resulting cell value. The string replaces the current output and leaves the
 * active template and stored template parameters unchanged.
 *
 * The `final` option is inherited from {@link TerminalCellOptions}, while
 * the logging options determine whether the updated value produces a log
 * event and which log level is used. Logging is evaluated after the cell has
 * processed the update.
 *
 * @since 1.0.0
 */
export type TerminalCellUpdateOptions = Prettify<
    Pick<TerminalCellOptions, 'final'> & TerminalCellLogOptions
>;

/**
 * Controls one parameter update performed on a template-based terminal cell.
 *
 * In addition to controlling finalization and optional logging, these options
 * determine whether the supplied parameters are merged with or replace the
 * cell's existing template parameters. Replacing parameters clears the old
 * map before storing the supplied own properties and rendering the active
 * template.
 *
 * @since 1.0.0
 */
export type TerminalCellParamsUpdateOptions = Prettify<
    TerminalCellUpdateOptions & {
        /**
         * Determines whether the update patches or replaces stored parameters.
         *
         * When `true`, supplied keys overwrite matching stored keys while
         * unspecified keys remain available for rendering. When `false`, the
         * existing map is cleared before the supplied keys are stored.
         *
         * @default true
         * @since 1.0.0
         */
        patch?: boolean;
    }
>;

/**
 * Receives logging configuration and rendered text from terminal cell updates.
 *
 * `TerminalCell` invokes this handler after its superclass has processed a
 * direct value or parameter update. It supplies the resulting cell value and
 * both resolved options, including defaults, even when `log` is `false`; the
 * handler is responsible for suppressing output in that case.
 *
 * The message is already the rendered string, including any template
 * substitutions. A logger can pass it to the terminal's entry-logging path
 * directly without re-running template rendering or general value
 * serialization. Initial-value logging is handled separately by entry
 * creation and does not use this update callback.
 *
 * @param message - Already-rendered terminal cell value to log.
 * @param options - Resolved logging options for the update.
 *
 * @internal
 * @since 1.0.0
 */
export type TerminalCellUpdateLogger = (
    message: string,
    options: Required<TerminalCellLogOptions>
) => void;