import atomix from "@nasriya/atomix";
import type { ScreenCellEngineEvents, TerminalCellOptions } from "../types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * Stateful rendering unit used by the terminal screen engine.
 *
 * A `ScreenCell` owns one complete rendered string and the optional template
 * state used to derive that string. It also tracks the cell's intrinsic
 * newline-based height and lifecycle flags, and notifies its owning screen
 * engine when visible content changes or the cell is removed. The screen
 * engine supplies those callbacks when it creates the cell; the cell itself
 * does not locate terminal rows or write terminal output.
 *
 * ---------------------------------------------------------------------
 * 🔷 POSITION IN THE RENDERING PIPELINE
 * ---------------------------------------------------------------------
 *
 * ```text
 * ScreenCell state
 *      ↓ onUpdate / onRemove
 * TerminalObjectModel entry and line manager
 *      ↓ logical lines
 * Terminal viewport
 *      ↓ terminal I/O
 * Managed terminal rows
 * ```
 *
 * The cell is the canonical source of its rendered value. TOM maintains the
 * corresponding entry and wrapped lines; the viewport maps those lines to the
 * current terminal dimensions. Cell callbacks form the boundary between cell
 * state changes and that downstream rendering pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 DIRECT AND TEMPLATE UPDATES
 * ---------------------------------------------------------------------
 *
 * Direct updates replace only the current rendered value:
 *
 * ```ts
 * cell.update('Loading...');
 * ```
 *
 * They leave the assigned template and parameter map intact. Template updates
 * replace or patch the parameter map, then render the active template:
 *
 * ```ts
 * cell.template = 'Loading ${progress}%';
 * cell.updateParams({ progress: 42 });
 * ```
 *
 * Each matching `${key}` placeholder is replaced globally with
 * `String(parameterValue)`. Template changes clear the stored parameter map,
 * but do not immediately re-render the current value; the next parameter
 * update renders the newly assigned template.
 *
 * ---------------------------------------------------------------------
 * 🔷 CHANGE NOTIFICATIONS
 * ---------------------------------------------------------------------
 *
 * The cell calls `onUpdate` only after construction has completed and only
 * when the rendered string differs from the previous string. The callback
 * receives the complete new value. Calling `remove()` marks the cell removed
 * before dispatching `onRemove`; later update attempts then return without
 * changing rendered output or notifying the engine. Repeated removal is a
 * no-op.
 *
 * ---------------------------------------------------------------------
 * 🔷 HEIGHT MODEL
 * ---------------------------------------------------------------------
 *
 * `height` is the cell's intrinsic line count, calculated as
 * `value.split('\n').length` when a value is assigned. An empty string
 * therefore has height one, and a trailing newline adds an empty final line.
 * This value does not account for terminal-width wrapping; the entry layer
 * computes the wrapped height that TOM uses for viewport placement. A cell
 * constructed without options starts with `height === 0` until a value is
 * assigned.
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION AND REMOVAL
 * ---------------------------------------------------------------------
 *
 * A cell can be finalized through `final: true` during initialization or an
 * update, or by calling {@link finalize}. Finalization locks value and
 * template mutation but does not remove the cell. Removal detaches it from
 * screen rendering but does not destroy the object. These states are
 * independent: a cell can be finalized and then removed, or removed while
 * still mutable as an object.
 *
 * @internal This class is an implementation type behind the public terminal API.
 * @since 1.0.0
 */
export class ScreenCell {
    /**
     * Internal engine event handlers used to synchronize the cell's
     * lifecycle with the screen engine.
     *
     * The event handlers are validated and retained by reference from the
     * owning screen engine when the cell is created. They are required even
     * when the cell will only be removed or only receive direct updates.
     *
     * - `onUpdate` receives the complete newly rendered value when it changes.
     * - `onRemove` removes the cell from the terminal object model and triggers
     *   the required terminal reconciliation.
     *
     * These callbacks are not exposed as a supported consumer extension point;
     * they are the internal connection from cell state to the owning engine.
     *
     * The event handlers are an internal implementation detail and MUST
     * NOT be treated as part of the cell's public API.
     *
     * @since 1.0.0
     */
    readonly #_engineEvents: ScreenCellEngineEvents

    /**
     * Internal lifecycle and mutability flags.
     *
     * ---------------------------------------------------------------------
     * 🔷 FLAGS
     * ---------------------------------------------------------------------
     *
     * - `constructed` indicates whether constructor initialization has
     *   completed. It suppresses update notifications while the initial value
     *   is being installed.
     *
     * - `finalized` indicates whether value and template mutations are locked.
     * - `removed` indicates whether the cell has been detached from the screen;
     *   update methods and repeated removals then return without dispatch.
     *
     * @since 1.0.0
     */
    readonly #_flags = {
        constructed: false,
        finalized: false,
        removed: false
    }

    /**
     * Current rendered output string, or `undefined` before any value is set.
     *
     * This is the authoritative value exposed by {@link value}. An assigned
     * empty string is distinct internally from the unset state, although the
     * getter returns an empty string for both.
     *
     * @since 1.0.0
     */
    #_value?: string;

    /**
     * Optional rendering template used for projection updates.
     *
     * Template placeholders follow the form:
     *
     * ```txt
     * ${key}
     * ```
     *
     * The template is read only when object parameters are applied. Assigning
     * a new template clears stored params but leaves the current rendered value
     * unchanged until the next parameter update.
     *
     * @since 1.0.0
     */
    #_template?: string;

    /**
     * Current intrinsic line count of the rendered value.
     *
     * The value is `renderedValue.split('\n').length`; it counts newline
     * separated segments but does not include terminal-width wrapping. TOM's
     * entry layer computes the wrapped height used for row placement. This is
     * zero only before the first value is assigned.
     *
     * @since 1.0.0
     */
    #_height: number = 0;

    /**
     * Persistent template parameter storage.
     *
     * Parameters are stored in insertion order and survive updates until:
     *
     * - explicitly replaced
     * - cleared
     * - template changes
     *
     * A direct string update does not change this map. The public `params`
     * getter returns a shallow frozen snapshot rather than this map itself.
     *
     * @since 1.0.0
     */
    #_params: Map<string, any> = new Map();

    /**
     * Internal helper utilities used by the cell's state transition pipeline.
     *
     * These helpers centralize:
     *
     * - string escaping
     * - template rendering
     * - value synchronization
     * - height calculation
     *
     * ---------------------------------------------------------------------
     * ⚠️ INTERNAL API
     * ---------------------------------------------------------------------
     *
     * This object is implementation detail only and MUST NOT be treated
     * as public API surface.
     *
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Escapes a string for safe RegExp construction.
         *
         * This prevents template parameter names from altering the
         * generated regular expression behavior.
         *
         * @param s - Raw unescaped string
         * @returns Escaped RegExp-safe string
         *
         * @since 1.0.0
         */
        escapeRegExp: (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),

        /**
         * Synchronizes the internal rendered value.
         *
     * Responsibilities:
     *
     * - ignore updates after removal and skip values equal to current output
     * - store new output and recalculate intrinsic newline-based height
     * - emit the complete value through `onUpdate` after construction
         *
         * @param str - Newly rendered output string
         *
         * @since 1.0.0
         */
        updateValue: (str: string) => {
            if (
                this.#_flags.removed ||
                this.#_value === str
            ) {
                return;
            }

            this.#_value = str;
            this.#_height = str.split('\n').length;
            if (this.#_flags.constructed) {
                this.#_engineEvents.onUpdate(str);
            }
        },

        /**
         * Renders the current template using stored parameters in map order.
         *
         * Rendering behavior:
         *
         * - each parameter key is escaped before being used in a regular
         *   expression
         * - every matching `${key}` placeholder is replaced globally
         * - each replacement value is converted with `String()`
         * - later map entries are applied to the string produced by earlier
         *   entries
         * - the final string is passed through the normal value-update path
         *
         * Placeholders with no corresponding parameter are left unchanged.
         *
         * @throws Error if template is undefined during rendering
         *
         * @since 1.0.0
         */
        render: () => {
            let template = this.#_template;
            if (template === undefined) {
                throw new Error("Invariant violation: template is undefined during render");
            }

            for (const [key, value] of this.#_params) {
                const escapedKey = this.#_helpers.escapeRegExp(key);
                const regex = new RegExp(`\\$\\{${escapedKey}\\}`, 'g');
                template = template.replace(regex, String(value));
            }

            this.#_helpers.updateValue(template);
        }
    }

    /**
     * Applies a direct value or template-parameter update to internal state.
     *
     * This method is shared by constructor initialization and both public
     * update methods. It centralizes validation, template parameter patching,
     * rendered-value synchronization, and optional finalization.
     *
     * This method powers:
     *
     * - constructor initialization
     * - direct updates
     * - template updates
     * - finalization logic
     *
     * ---------------------------------------------------------------------
     * 🔷 UPDATE MODES
     * ---------------------------------------------------------------------
     *
     * ## Direct mode (`string`)
     *
     * Directly replaces the rendered value. The template and parameter map
     * remain unchanged.
     *
     * Does NOT modify:
     *
     * - template
     * - stored parameters
     *
     * ## Template mode (`object`)
     *
     * Applies own enumerable parameter properties to the active template and
     * re-renders output. A falsey or absent template is rejected.
     *
     * Depending on `patch`:
     *
     * - `true`  → merge into existing params
     * - `false` → replace all params
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * If `final: true` is provided:
     *
     * - update is applied first
     * - cell becomes immutable afterward
     *
     * ---------------------------------------------------------------------
     * 🔷 REMOVED CELLS
     * ---------------------------------------------------------------------
     *
     * Once a cell has been removed, subsequent updates are silently ignored
     * before finalized-state and argument validation are checked. Thus a
     * removed-and-finalized cell still treats an update as a no-op.
     *
     * Removal is terminal with respect to screen rendering: the cell object
     * may continue to exist and be referenced by application code, but it is
     * no longer connected to the terminal object model.
     *
     * @param value - Complete replacement string, or a record of template
     * parameters to apply.
     * @param options - Optional finalization and parameter-patching settings.
     *
     * @throws Error if the cell is finalized, the options object or its fields
     * are invalid, or template parameters are supplied without a truthy template.
     * @throws TypeError if `value` is neither a string nor a record.
     *
     * @internal
     * @since 1.0.0
     */
    #_update(value: string | Record<string, any>, options?: { final?: boolean; patch?: boolean }): void {
        if (this.#_flags.removed) { return; }

        if (this.#_flags.finalized) {
            throw new Error(`Unable to update a terminal cell that has already been finalized`);
        }

        const config = {
            final: false,
            patch: true,
            updateType: 'direct' as 'direct' | 'template',
        }

        if (options !== undefined) {
            if (!atomix.valueIs.record(options)) {
                throw new Error(`Terminal cell options (when provided) must be an object, instead got ${typeof options}`);
            }

            if (hasOwnProp(options, 'final')) {
                if (typeof options.final !== 'boolean') {
                    throw new Error(`Terminal cell options.final must be a boolean, instead got ${typeof options.final}`);
                }

                config.final = options.final;
            }

            if (hasOwnProp(options, 'patch')) {
                if (typeof options.patch !== 'boolean') {
                    throw new Error(`Terminal cell options.patch must be a boolean, instead got ${typeof options.patch}`);
                }

                config.patch = options.patch;
            }
        }

        if (typeof value === 'string') {
            // do nothing to params or template
        } else if (atomix.valueIs.record(value)) {
            if (!this.#_template) {
                throw new Error(`Terminal cell template is required when updating with an object`);
            }

            config.updateType = 'template';
            if (config.patch === false) { this.#_params.clear() }
            for (const key in value) {
                if (!hasOwnProp(value, key)) { continue; }
                this.#_params.set(key, value[key]);
            }
        } else {
            throw new TypeError(`Terminal cell value must be a string or an object, instead got ${typeof value}`);
        }

        if (config.updateType === 'direct') {
            this.#_helpers.updateValue(value as string);
        } else {
            this.#_helpers.render();
        }

        if (config.final) { this.#_flags.finalized = true; }
    }

    /**
     * Creates a cell and installs its initial value or template projection.
     *
     * A cell is the smallest independently mutable rendered unit managed by
     * the screen engine. The constructor retains the engine callbacks, then
     * initializes the cell through the same internal state-update path used by
     * later public updates.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION MODES
     * ---------------------------------------------------------------------
     *
     * Direct initialization stores a string as the current value. A template
     * may also be supplied, but the initial string is not interpolated through
     * it:
     *
     * ```ts
     * new ScreenCell(events, {
     *     value: 'Loading...',
     *     template: 'Progress: ${value}%'
     * });
     * ```
     *
     * Template initialization requires both `template` and `params`; it stores
     * the parameters and renders the template before construction completes:
     *
     * ```ts
     * new ScreenCell(events, {
     *     template: 'Progress: ${value}%',
     *     params: { value: 10 }
     * });
     * ```
     *
     * If `options` is omitted, the cell is created without a value: `value`
     * reads as `''` and `height` remains zero until an update assigns output.
     *
     * ---------------------------------------------------------------------
     * 🔷 CONSTRUCTION AND CALLBACKS
     * ---------------------------------------------------------------------
     *
     * The initial value is installed while the `constructed` flag is false, so
     * the initial `onUpdate` notification is suppressed. The flag is set in a
     * `finally` block after initialization, including when construction throws.
     * Later changes notify the engine only when the rendered string differs.
     *
     * ---------------------------------------------------------------------
     * 🔷 RUNTIME VALIDATION
     * ---------------------------------------------------------------------
     *
     * Both callbacks must be own properties of an object and must be
     * functions. When options are provided, they must be an object with either
     * a string `value`, or an object `params` accompanied by a string template.
     * The optional `final` value must be boolean. `template`, when present,
     * must be a string; the constructor does not apply the public setter's
     * non-empty validation. A direct-value cell can therefore retain an empty
     * template, but an empty template cannot be used for parameter rendering
     * because the update path requires a truthy template.
     *
     * @param events - Required internal callbacks for complete rendered-value
     * changes and removal from the screen model.
     * @param options - Optional initial direct value or template parameters.
     *
     * @throws Error if either callback is missing, or if the options shape,
     * required initial value, parameter template, or `final` value is invalid.
     * @throws TypeError if `events` is not a record or a present callback is
     * not a function.
     *
     * @internal
     * @since 1.0.0
     */
    constructor(
        events: ScreenCellEngineEvents,
        options?: TerminalCellOptions
    ) {
        try {
            if (atomix.valueIs.record(events)) {
                if (hasOwnProp(events, 'onUpdate')) {
                    if (typeof events.onUpdate !== 'function') {
                        throw new TypeError(`Expected \`events.onUpdate\` to be a function, received \`${typeof events.onUpdate}\``);
                    }
                } else {
                    throw new Error(`Expected \`events.onUpdate\` to be a function, received \`${typeof events.onUpdate}\``);
                }

                if (hasOwnProp(events, 'onRemove')) {
                    if (typeof events.onRemove !== 'function') {
                        throw new TypeError(`Expected \`events.onRemove\` to be a function, received \`${typeof events.onRemove}\``);
                    }
                } else {
                    throw new Error(`Expected \`events.onRemove\` to be a function, received \`${typeof events.onRemove}\``);
                }

                this.#_engineEvents = events;
            } else {
                throw new TypeError(`Expected \`events\` to be an object, received \`${typeof events}\``);
            }

            if (options === undefined) { return }
            const config = {
                isFinal: false,
                hasTemplate: false
            }

            if (!atomix.valueIs.record(options)) {
                throw new Error(`Terminal cell options (when provided) must be an object, instead got ${typeof options}`);
            }

            if (hasOwnProp(options, 'final')) {
                if (typeof options.final !== 'boolean') {
                    throw new Error(`Terminal cell options.final must be a boolean, instead got ${typeof options.final}`);
                }

                config.isFinal = options.final;
            }

            if (hasOwnProp(options, 'template')) {
                if (typeof options.template !== 'string') {
                    throw new Error(`Terminal cell options.template must be a string, instead got ${typeof options.template}`);
                }

                this.#_template = options.template;
                config.hasTemplate = true;
            }

            if (hasOwnProp(options, 'value')) {
                const value = (options as Record<string, unknown>).value as string;
                if (typeof value !== 'string') {
                    throw new Error(`Terminal cell options.value must be a string, instead got ${typeof value}`);
                }

                this.#_update(value, { final: config.isFinal })
            } else {
                if (hasOwnProp(options, 'params')) {
                    const params = (options as Record<string, unknown>).params as Record<string, unknown>;
                    if (!atomix.valueIs.record(params)) {
                        throw new Error(`Terminal cell options.params must be an object, instead got ${typeof params}`);
                    }

                    if (!config.hasTemplate) {
                        throw new Error(`Terminal cell template is required when creating with parameters object`);
                    }

                    this.#_update(params, { final: config.isFinal });
                } else {
                    throw new Error('Terminal cell requires either a string `value` or a `params` object to be provided but neither was found');
                }
            }
        } finally {
            this.#_flags.constructed = true;
        }
    }

    /**
     * Returns the current rendered output string, using `''` for unset state.
     *
     * ---------------------------------------------------------------------
     * 🔷 SOURCE OF TRUTH
     * ---------------------------------------------------------------------
     *
     * This property reflects the complete value currently represented by the
     * cell. It is not a copy of the text currently visible in the viewport:
     * the corresponding entry may wrap it, or the viewport may clip it while
     * off-screen.
     *
     * The value may originate from:
     *
     * - direct string updates
     * - template rendering
     *
     * ---------------------------------------------------------------------
     * 🔷 GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Always returns a string. The unset `undefined` state and an explicitly
     * assigned empty string both read as `''`, though the cell tracks them
     * separately internally.
     *
     * Empty state resolves to:
     *
     * ```txt
     * ''
     * ```
     *
     * @returns Current rendered output
     *
     * @since 1.0.0
     */
    get value(): string { return this.#_value ?? ''; }

    /**
     * Indicates whether the cell has been finalized.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZED CELLS
     * ---------------------------------------------------------------------
     *
     * Finalized cells become immutable:
     *
     * - updates are rejected
     * - template changes are rejected
     * - parameters cannot change
     *
     * Finalization is irreversible. It does not imply that the cell has been
     * removed from the screen.
     *
     * @returns `true` if immutable
     *
     * @since 1.0.0
     */
    get final(): boolean { return this.#_flags.finalized; }

    /**
     * Returns the cell's intrinsic newline-based height.
     *
     * Height is the number of segments returned by `value.split('\n')` when
     * the value is assigned. It includes empty segments from leading, adjacent,
     * and trailing newlines, but does not include additional width wrapping.
     *
     * @returns Number of newline-delimited segments in the current value.
     *
     * @since 1.0.0
     */
    get height(): number { return this.#_height; }

    /**
     * Returns a shallow frozen snapshot of stored template parameters.
     *
     * These parameters represent the latest rendering input state used by
     * template rendering mode.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * ---------------------------------------------------------------------
     *
     * The returned object is a new object whose top-level properties cannot be
     * added, removed, or reassigned. Parameter values are not deep-cloned or
     * frozen, so object values may still be mutated through the snapshot.
     *
     * @returns A new shallow-frozen object containing the current parameters.
     *
     * @since 1.0.0
     */
    get params(): Readonly<Record<string, any>> {
        const result = Object.fromEntries(this.#_params)
        return Object.freeze(result);
    }

    /**
     * Returns the currently assigned rendering template.
     *
     * Templates define projection-based rendering behavior using parameter
     * placeholders:
     *
     * ```txt
     * ${key}
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT
     * ---------------------------------------------------------------------
     *
     * Changing the template resets all stored parameters. The getter returns
     * the raw template string; it does not render it or report whether current
     * output matches it.
     *
     * @returns Active template string or `undefined`
     *
     * @since 1.0.0
     */
    get template(): string | undefined { return this.#_template; }

    /**
     * Assigns or clears the rendering template.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * ## Setting a template
     *
     * - assigns a template for the next parameter update
     * - clears all stored parameters
     * - leaves the current rendered value unchanged
     *
     * ## Clearing a template
     *
     * - disables projection mode
     * - clears all stored parameters
     * - leaves the current rendered value unchanged
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * - finalized cells reject template changes
     * - supplied strings must contain at least one non-whitespace character
     * - clearing is performed only with `null` or `undefined`; `''` is invalid
     * - the original string, including surrounding whitespace, is retained
     *
     * @param value - Template string to assign, or `null`/`undefined` to clear
     * the template.
     *
     * @throws Error if the cell is finalized
     * @throws Error if template is empty
     * @throws TypeError on invalid types
     *
     * @since 1.0.0
     */
    set template(value: string | undefined | null) {
        if (this.#_flags.finalized) {
            throw new Error(`Cannot modify template of a finalized entry`);
        }

        if (value === undefined || value === null) {
            this.#_template = undefined;
            this.#_params.clear();
            return;
        }

        if (typeof value !== 'string') {
            throw new TypeError(`Terminal cell template must be a string, instead got ${typeof value}`);
        }

        if (value.trim().length === 0) {
            throw new Error(`Terminal cell template must not be empty`);
        }

        this.#_template = value;
        this.#_params.clear();
    }

    /**
     * Updates the rendered value of the cell directly.
     *
     * The supplied string completely replaces the current rendered output.
     * Direct updates do not modify the cell's active template or stored template
     * parameters.
     *
     * ---------------------------------------------------------------------
     * 🔷 DIRECT UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * cell.update('Downloading...');
     * ```
     *
     * The supplied value becomes the cell's new visible output immediately.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the cell after the new value has been
     * applied.
     *
     * When `final` is `true`:
     *
     * - the value is updated
     * - the cell becomes immutable
     * - subsequent updates are rejected
     *
     * @param value - New rendered output value
     * @param options - Update configuration
     *
     * @throws Error if the cell has already been finalized, or if the update
     * options fail runtime validation.
     *
     * @since 1.0.0
     */
    update(value: string, options?: { final?: boolean }): void {
        this.#_update(value, options);
    }

    /**
     * Updates the template parameters used to render the cell.
     *
     * The cell must have a truthy template before template parameters can be
     * updated. Own enumerable properties from `params` are applied to the
     * active template and the complete result becomes the new cell value.
     *
     * ---------------------------------------------------------------------
     * 🔷 PARAMETER UPDATE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * cell.template = 'Progress: ${progress}%';
     * cell.updateParams({ progress: 50 });
     * ```
     *
     * Each supplied value is converted with `String()` during template
     * rendering. A missing key does not cause a placeholder to be removed.
     *
     * ---------------------------------------------------------------------
     * 🔷 TEMPLATE PATCHING
     * ---------------------------------------------------------------------
     *
     * By default, supplied parameters are merged with those already stored by
     * the cell (`patch` defaults to `true`):
     *
     * ```ts
     * cell.updateParams({ progress: 50 });
     * cell.updateParams({ status: 'Downloading' });
     * ```
     *
     * Setting `patch` to `false` clears all previously stored parameters before
     * applying the supplied values. An empty record with `patch: false` clears
     * the parameters and renders the template with every unmatched placeholder
     * left intact.
     *
     * ```ts
     * cell.updateParams(
     *     { progress: 100 },
     *     { patch: false }
     * );
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The update may optionally finalize the cell after the new parameters have
     * been applied and the template has been rendered.
     *
     * When `final` is `true`:
     *
     * - the parameters are updated
     * - the cell is re-rendered
     * - the cell becomes immutable
     * - subsequent updates are rejected
     *
     * @param params - Own enumerable template parameters to merge or replace.
     * @param options - Optional patching and finalization configuration.
     *
     * @throws Error if the cell is finalized, options are invalid, or no truthy
     * template is assigned to the cell.
     * @throws TypeError if `params` is not a record.
     *
     * @since 1.0.0
     */
    updateParams(
        params: Record<string, unknown>,
        options?: { final?: boolean; patch?: boolean }
    ): void {
        this.#_update(params, options);
    }

    /**
     * Removes the cell from the screen.
     *
     * Removal detaches the cell from the screen engine's managed layout and
     * dispatches its removal callback so TOM can reconcile the affected
     * terminal region. The cell is marked removed before that callback runs.
     *
     * ---------------------------------------------------------------------
     * 🔷 REMOVAL
     * ---------------------------------------------------------------------
     *
     * Once removed:
     *
     * - the cell is no longer rendered
     * - subsequent updates are ignored
     * - subsequent removal requests are ignored
     * - the cell object itself remains valid and may still be referenced
     * - finalization state is unchanged
     *
     * Removal is irreversible.
     *
     * ---------------------------------------------------------------------
     * 🔷 IDEMPOTENT
     * ---------------------------------------------------------------------
     *
     * Calling `remove()` multiple times is safe. Only the first invocation
     * marks the cell removed and dispatches the removal event to the screen
     * engine. Removing a finalized cell is allowed.
     *
     * @since 1.0.0
     */
    remove(): void {
        if (this.#_flags.removed) { return; }

        this.#_flags.removed = true;
        this.#_engineEvents.onRemove();
    }

    /**
     * Finalizes the cell and permanently locks value and template mutation.
     *
     * ---------------------------------------------------------------------
     * 🔷 AFTER FINALIZATION
     * ---------------------------------------------------------------------
     *
     * The following operations become invalid:
     *
     * - `update(...)`
     * - template reassignment
     * - parameter mutation
     *
     * ---------------------------------------------------------------------
     * 🔷 IDEMPOTENT
     * ---------------------------------------------------------------------
     *
     * Calling `finalize()` multiple times is safe and has no additional effect.
     * Finalization does not alter the current value, notify the engine, or
     * remove the cell. A finalized cell can still be removed from the screen.
     *
     * @since 1.0.0
     */
    finalize(): void {
        if (this.#_flags.finalized) { return; }
        this.#_flags.finalized = true;
    }
}

/**
 * Default import binding for {@link ScreenCell}.
 *
 * The default and named exports refer to the same class constructor.
 *
 * @internal
 *
 * @since 1.0.0
 */
export default ScreenCell;