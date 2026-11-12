import atomix from "@nasriya/atomix";
import ScreenCell from "./cell";
import type {
    TerminalCellUpdateLogger,
    TerminalCellUpdateOptions,
    TerminalCellParamsUpdateOptions
} from "../types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Screen cell that reports update requests to an attached logging handler.
 *
 * `TerminalCell` extends {@link ScreenCell} with optional per-update logging.
 * It uses the same rendered value, template state, lifecycle rules, and engine
 * callbacks as its base class. The only additional behavior is that each
 * `update()` or `updateParams()` call passes the resulting rendered string and
 * resolved logging settings to a handler after the base update method returns.
 *
 * ---------------------------------------------------------------------
 * 🔷 UPDATE BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * A direct update replaces the current rendered value while preserving the
 * active template and parameters:
 *
 * ```ts
 * cell.update('Downloading package...');
 * ```
 *
 * A parameter update patches or replaces the template parameters and renders
 * the active template:
 *
 * ```ts
 * cell.updateParams({ progress: 50 });
 * ```
 *
 * The base class performs validation, state changes, finalization, and engine
 * notifications. If that base call throws, the logger is not invoked. If it
 * returns without changing output (for example, when a removed cell ignores
 * the update), the logger is still invoked with the cell's current value.
 *
 * ---------------------------------------------------------------------
 * 🔷 UPDATE LOGGING
 * ---------------------------------------------------------------------
 *
 * Logging is disabled by default. Both overrides resolve `log` to `false` and
 * `level` to `'info'` when omitted, then call the attached handler after the
 * base update returns. The handler receives the already-rendered cell value
 * and decides whether `log: true` should create an actual log event. The
 * handler must be attached before the first update; otherwise the non-null
 * invocation fails at runtime.
 *
 * ```ts
 * cell.update('Download complete.', {
 *     log: true,
 *     level: 'info'
 * });
 * ```
 *
 * Initial-value logging is performed by entry creation separately; these
 * overrides concern later update calls.
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION AND REMOVAL
 * ---------------------------------------------------------------------
 *
 * Both update methods accept `final: true`. The base class applies the value
 * or parameters first, then locks further value and template changes. A
 * finalized cell can still be removed. Removal does not prevent the override
 * from invoking the logger on later ignored update requests; the handler gets
 * the unchanged current value and the request's logging options.
 *
 * @internal This implementation type is created by the terminal entry system.
 * @since 1.0.0
 */
class TerminalCell extends ScreenCell {
    /**
     * Optional logging handler attached to this terminal cell.
     *
     * The handler receives the current rendered value and normalized logging
     * configuration after a base update returns. It is assigned once through
     * {@link attachLogger}; public updates assume it has already been attached.
     *
     * @since 1.0.0
     */
    #_logger?: TerminalCellUpdateLogger;

    /**
     * Creates a terminal cell by forwarding the cell wiring and initial state
     * to {@link ScreenCell}.
     *
     * This constructor does not attach the logger. The entry-creation path
     * attaches it after constructing the cell and before resolving it to the
     * caller, so later updates can safely use the handler.
     *
     * @param args - Arguments forwarded to the {@link ScreenCell} constructor.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(...args: ConstructorParameters<typeof ScreenCell>) {
        super(...args);
    }

    /**
     * Replaces the rendered value and forwards the resulting value to the logger.
     *
     * The supplied string completely replaces the current cell output.
     * Direct updates do not modify the cell's active template or stored
     * template parameters.
     *
     * ---------------------------------------------------------------------
     * 🔷 DIRECT UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * cell.update('Downloading package...');
     * ```
     *
     * The supplied value becomes the cell's new rendered output.
     *
     * ---------------------------------------------------------------------
     * 🔷 LOGGING
     * ---------------------------------------------------------------------
     *
     * Updates do not produce log events by default.
     *
     * A particular update can be logged explicitly:
     *
     * ```ts
     * cell.update('Download complete.', {
     *     log: true,
     *     level: 'info'
     * });
     * ```
     *
     * After the base update returns, the current rendered value is passed to
     * the attached handler along with resolved options. The handler is called
     * even when `log` is false or when the base cell ignored an update because
     * it had been removed. A base-class validation or finalization error is
     * thrown before the handler runs.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the cell after the new value has been
     * applied. The logger call occurs after that finalization.
     *
     * When `final` is `true`:
     *
     * - the value is updated
     * - the cell becomes immutable
     * - subsequent updates are rejected
     *
     * @param value - New rendered output value.
     * @param options - Update, finalization, and logging configuration.
     *
     * @throws Error If the cell has already been finalized or update options
     * fail the base class's runtime validation.
     * @throws TypeError If a logger has not been attached to the cell.
     *
     * @since 1.0.0
     */
    override update(
        value: string,
        options?: TerminalCellUpdateOptions
    ): void {
        const updateOptions: Record<string, unknown> = {};
        if (options && hasOwnProp(options, 'final')) {
            updateOptions.final = options.final;
        }

        super.update(value, updateOptions);

        this.#_logger!(this.value, {
            log: options?.log ?? false,
            level: options?.level ?? 'info'
        });
    }

    /**
     * Applies template parameters, renders the template, and forwards the
     * resulting value to the logger.
     *
     * The cell must have an active template before its parameters can be
     * updated. The supplied parameters are applied to the template, and the
     * cell is re-rendered.
     *
     * ---------------------------------------------------------------------
     * 🔷 PARAMETER UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * cell.updateParams({ progress: 50 });
     * ```
     *
     * The resulting rendered value becomes the cell's new output.
     *
     * ---------------------------------------------------------------------
     * 🔷 TEMPLATE PATCHING
     * ---------------------------------------------------------------------
     *
     * By default, supplied parameters are merged with the parameters already
     * stored by the cell:
     *
     * ```ts
     * cell.updateParams({ progress: 50 });
     * cell.updateParams({ status: 'Downloading' });
     * ```
     *
     * Setting `patch` to `false` replaces all previously stored parameters
     * before applying the supplied values:
     *
     * ```ts
     * cell.updateParams(
     *     { progress: 100 },
     *     { patch: false }
     * );
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 LOGGING
     * ---------------------------------------------------------------------
     *
     * Parameter updates do not produce log events by default.
     *
     * A particular update can be logged explicitly:
     *
     * ```ts
     * cell.updateParams(
     *     { status: 'Failed' },
     *     {
     *         log: true,
     *         level: 'error'
     *     }
     * );
     * ```
     *
     * After the base update returns, the current rendered value is passed to
     * the attached handler with resolved logging options. The handler is called
     * even when `log` is false or when the base cell ignored the update because
     * it had been removed. A base-class error prevents the handler call.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the cell after the parameters have
     * been applied and the template has been rendered.
     *
     * When `final` is `true`:
     *
     * - the parameters are updated
     * - the cell is re-rendered
     * - the cell becomes immutable
     * - subsequent updates are rejected
     *
     * @param params - Template parameters to apply.
     * @param options - Parameter update, patching, finalization, and logging
     * configuration.
     *
     * @throws Error If the cell has already been finalized, if options are
     * invalid, or if no truthy template is assigned to the cell.
     * @throws TypeError If `params` is not a record.
     * @throws TypeError If a logger has not been attached to the cell.
     *
     * @since 1.0.0
     */
    override updateParams(
        params: Record<string, unknown>,
        options?: TerminalCellParamsUpdateOptions
    ): void {
        const updateOptions: Record<string, unknown> = {};
        if (options) {
            if (hasOwnProp(options, 'final')) {
                updateOptions.final = options.final;
            }

            if (hasOwnProp(options, 'patch')) {
                updateOptions.patch = options.patch;
            }
        }

        super.updateParams(params, updateOptions);

        this.#_logger!(this.value, {
            log: options?.log ?? false,
            level: options?.level ?? 'info'
        });
    }

    /**
     * Attaches the one logging handler used by a terminal cell.
     *
     * The entry-creation path calls this after constructing the cell and before
     * exposing it to its caller. The handler receives each update's current
     * rendered string and resolved logging options. It is invoked regardless of
     * the `log` flag; the handler decides whether to emit a log event.
     *
     * A handler can only be attached once. Attempting to attach another
     * handler to the same cell throws an invariant error. This method does not
     * separately validate that the supplied handler is a function at runtime;
     * callers are expected to satisfy the declared type.
     *
     * @param terminalCell - Terminal cell receiving the logging handler.
     * @param handler - Logging handler used for cell updates.
     *
     * @throws Error If a logging handler has already been attached.
     *
     * @internal
     * @since 1.0.0
     */
    static attachLogger(
        terminalCell: TerminalCell,
        handler: TerminalCellUpdateLogger
    ): void {
        if (terminalCell.#_logger) {
            throw new Error('Invariant violation: logger is already attached.');
        }

        terminalCell.#_logger = handler;
    }
}

export default TerminalCell;