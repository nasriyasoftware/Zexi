import { hasOwnProp, isRecord } from "../../../utils/utils";
import type { TerminalCellOptions } from "./types";

/**
 * Stateful reactive terminal screen cell.
 *
 * `ScreenCell` is the fundamental mutable rendering unit of the
 * screen engine.
 *
 * A cell encapsulates:
 *
 * - current rendered output
 * - optional template projection logic
 * - persistent rendering parameters
 * - terminal line height metadata
 * - reactive update propagation
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * `ScreenCell` belongs to the screen rendering subsystem:
 *
 * ```text
 * ScreenCell
 *      ↓
 * ScreenSnapshot
 *      ↓
 * ScreenEngine
 *      ↓
 * Terminal Output
 * ```
 *
 * The cell acts as the atomic state container used by the screen engine.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * A cell maintains a single canonical output state:
 *
 * ```ts
 * cell.value
 * ```
 *
 * This value may be produced using one of two update modes:
 *
 * ## Direct mode
 *
 * Direct updates fully replace the rendered value:
 *
 * ```ts
 * cell.update('Loading...')
 * ```
 *
 * Characteristics:
 * - replaces current output
 * - preserves template state
 * - preserves params state
 *
 * ## Template mode
 *
 * Template updates project params into a persistent template:
 *
 * ```ts
 * cell.template = 'Loading ${progress}%'
 * cell.update({ progress: 42 })
 * ```
 *
 * Characteristics:
 * - updates rendering parameters
 * - recomputes rendered output
 * - preserves template unless replaced
 *
 * ---------------------------------------------------------------------
 * 🔷 TEMPLATE SYSTEM
 * ---------------------------------------------------------------------
 *
 * Templates act as lightweight projection functions:
 *
 * ```text
 * value = render(template, params)
 * ```
 *
 * Template placeholders follow:
 *
 * ```text
 * ${key}
 * ```
 *
 * Example:
 *
 * ```ts
 * template = 'User: ${name}'
 * params = { name: 'Ahmad' }
 *
 * value === 'User: Ahmad'
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 REACTIVE UPDATE MODEL
 * ---------------------------------------------------------------------
 *
 * Each cell is connected to the screen engine using an internal
 * update callback.
 *
 * Whenever the rendered value changes:
 *
 * - visual height is recalculated
 * - the screen engine is notified
 * - the renderer reconciliation pipeline executes
 *
 * ---------------------------------------------------------------------
 * 🔷 HEIGHT MODEL
 * ---------------------------------------------------------------------
 *
 * Cell height represents the number of occupied terminal rows.
 *
 * Height is calculated using newline segmentation:
 *
 * ```ts
 * value.split('\n').length
 * ```
 *
 * Trailing newlines are considered meaningful and therefore increase
 * height.
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION MODEL
 * ---------------------------------------------------------------------
 *
 * Cells may become immutable using:
 *
 * - `final: true`
 * - `cell.finalize()`
 *
 * Finalized cells:
 * - reject further updates
 * - reject template changes
 * - preserve stable rendered output
 *
 * ---------------------------------------------------------------------
 * 🔷 STATEFUL DESIGN
 * ---------------------------------------------------------------------
 *
 * `ScreenCell` is intentionally stateful.
 *
 * Internal mutable state includes:
 *
 * - rendered output
 * - template
 * - rendering params
 * - height metadata
 * - lifecycle flags
 *
 * This design enables efficient incremental terminal rendering
 * without reconstructing entire output trees.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ScreenCell {
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
    readonly #_onUpdate: (cell: ScreenCell) => void;

    /**
     * Internal lifecycle and mutability flags.
     *
     * ---------------------------------------------------------------------
     * 🔷 FLAGS
     * ---------------------------------------------------------------------
     *
     * - `constructed`
     *   Indicates whether constructor initialization has completed.
     *   Used to suppress update notifications during construction.
     *
     * - `finalized`
     *   Indicates whether the cell has become immutable.
     *
     * @since 1.0.0
     */
    readonly #_flags = { constructed: false, finalized: false }

    /**
     * Current rendered output string.
     *
     * This represents the authoritative visible content of the cell.
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
     * @since 1.0.0
     */
    #_template?: string;

    /**
     * Current rendered visual height of the cell.
     *
     * Height is measured in terminal rows.
     *
     * @since 1.0.0
     */
    #_height: number = 0;

    /**
     * Persistent template parameter storage.
     *
     * Parameters survive updates until:
     *
     * - explicitly replaced
     * - cleared
     * - template changes
     *
     * @since 1.0.0
     */
    #_params: Map<string, any> = new Map();

    /**
     * Internal helper utilities used by the rendering pipeline.
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
         * - updates visible content
         * - recalculates visual height
         * - emits update notifications after construction
         *
         * @param str - Newly rendered output string
         *
         * @since 1.0.0
         */
        updateValue: (str: string) => {
            this.#_value = str;
            this.#_helpers.calcHeight();

            if (this.#_flags.constructed) {
                this.#_onUpdate(this);
            }
        },

        /**
         * Recalculates the rendered terminal height.
         *
         * Height equals the number of newline-separated visual rows.
         *
         * ---------------------------------------------------------------------
         * 🔷 IMPORTANT
         * ---------------------------------------------------------------------
         *
         * Trailing newline characters are treated as meaningful output and
         * therefore increase height.
         *
         * @since 1.0.0
         */
        calcHeight: () => {
            this.#_height = this.value.split('\n').length;
        },

        /**
         * Re-renders the current template using stored parameters.
         *
         * Rendering behavior:
         *
         * - every `${key}` placeholder is replaced
         * - replacements are stringified
         * - the resulting string becomes the new visible value
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
     * Internal state update pipeline.
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
     * Directly replaces the rendered value.
     *
     * Does NOT modify:
     *
     * - template
     * - stored parameters
     *
     * ## Template mode (`object`)
     *
     * Applies parameters to the active template and re-renders output.
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
     * @param value - Direct string output or template parameters
     * @param options - Update configuration
     *
     * @throws Error if the cell is finalized
     * @throws Error if template updates occur without a template
     * @throws TypeError on invalid input types
     *
     * @since 1.0.0
     */
    #_update(value: string | Record<string, any>, options?: { final?: boolean; patch?: boolean }): void {
        if (this.#_flags.finalized) {
            throw new Error(`Unable to update a terminal entry that has already been finalized`);
        }

        const config = {
            final: false,
            patch: true,
            updateType: 'direct' as 'direct' | 'template',
        }

        if (options !== undefined) {
            if (!isRecord(options)) {
                throw new Error(`Terminal entry options (when provided) must be an object, instead got ${typeof options}`);
            }

            if (hasOwnProp(options, 'final')) {
                if (typeof options.final !== 'boolean') {
                    throw new Error(`Terminal entry options.final must be a boolean, instead got ${typeof options.final}`);
                }

                config.final = options.final;
            }

            if (hasOwnProp(options, 'patch')) {
                if (typeof options.patch !== 'boolean') {
                    throw new Error(`Terminal entry options.patch must be a boolean, instead got ${typeof options.patch}`);
                }

                config.patch = options.patch;
            }
        }

        if (typeof value === 'string') {
            // do nothing to params or template
        } else if (isRecord(value)) {
            if (!this.#_template) {
                throw new Error(`Terminal entry template is required when updating with an object`);
            }

            config.updateType = 'template';
            if (config.patch === false) { this.#_params.clear() }
            for (const key in value) {
                if (!hasOwnProp(value, key)) { continue; }
                this.#_params.set(key, value[key]);
            }
        } else {
            throw new TypeError(`Terminal entry value must be a string or an object, instead got ${typeof value}`);
        }

        if (config.updateType === 'direct') {
            this.#_helpers.updateValue(value as string);
        } else {
            this.#_helpers.render();
        }

        if (config.final) { this.#_flags.finalized = true; }
    }

    /**
     * Creates a new ScreenCell instance.
     *
     * A screen cell is the smallest independently updatable rendering unit
     * managed by the screen engine.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION MODES
     * ---------------------------------------------------------------------
     *
     * A cell can be initialized using either a direct string value or a set
     * of template parameters.
     *
     * ## Direct initialization
     *
     * A cell can be initialized with a string value:
     *
     * ```ts
     * new ScreenCell(onUpdate, {
     *     value: 'Loading...'
     * });
     * ```
     *
     * The value is rendered directly. A template may optionally be provided
     * alongside the value for subsequent parameter-based updates.
     *
     * ## Template initialization
     *
     * A cell can be initialized with template parameters:
     *
     * ```ts
     * new ScreenCell(onUpdate, {
     *     template: 'Progress: ${value}%',
     *     params: { value: 10 }
     * });
     * ```
     *
     * Template initialization requires both `params` and `template`. The
     * parameters are rendered using the supplied template.
     *
     * ---------------------------------------------------------------------
     * 🔷 CONSTRUCTION BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * During construction:
     *
     * - update notifications are temporarily suppressed
     * - the initial value is rendered internally
     * - the cell becomes reactive only after initialization completes
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * - `onUpdate` MUST be a function
     * - `options`, when provided, MUST be an object
     * - either `value` or `params` MUST be provided
     * - `value` MUST be a string
     * - `params` MUST be an object
     * - `params` MUST be accompanied by a `template`
     * - `template`, when provided, MUST be a string
     * - `final`, when provided, MUST be a boolean
     *
     * @param onUpdate - Callback triggered after visible state changes
     * @param options - Initial cell configuration
     *
     * @throws Error on invalid configuration
     * @throws TypeError on invalid argument types
     *
     * @since 1.0.0
     */
    constructor(
        onUpdate: (cell: ScreenCell) => void,
        options?: TerminalCellOptions
    ) {
        try {
            if (typeof onUpdate !== 'function') {
                throw new Error(`Terminal entry onUpdate must be a function, instead got ${typeof onUpdate}`);
            }

            this.#_onUpdate = onUpdate;

            if (options === undefined) { return }
            const config = {
                isFinal: false,
                hasTemplate: false
            }

            if (!isRecord(options)) {
                throw new Error(`Terminal entry options (when provided) must be an object, instead got ${typeof options}`);
            }

            if (hasOwnProp(options, 'final')) {
                if (typeof options.final !== 'boolean') {
                    throw new Error(`Terminal entry options.final must be a boolean, instead got ${typeof options.final}`);
                }

                config.isFinal = options.final;
            }

            if (hasOwnProp(options, 'template')) {
                if (typeof options.template !== 'string') {
                    throw new Error(`Terminal entry options.template must be a string, instead got ${typeof options.template}`);
                }

                this.#_template = options.template;
                config.hasTemplate = true;
            }

            if (hasOwnProp(options, 'value')) {
                const value = (options as Record<string, unknown>).value as string;
                if (typeof value !== 'string') {
                    throw new Error(`Terminal entry options.value must be a string, instead got ${typeof value}`);
                }

                this.#_update(value, { final: config.isFinal })
            } else {
                if (hasOwnProp(options, 'params')) {
                    const params = (options as Record<string, unknown>).params as Record<string, unknown>;
                    if (!isRecord(params)) {
                        throw new Error(`Terminal entry options.params must be an object, instead got ${typeof params}`);
                    }

                    if (!config.hasTemplate) {
                        throw new Error(`Terminal entry template is required when creating with parameters object`);
                    }

                    this.#_update(params, { final: config.isFinal });
                } else {
                    throw new Error('Terminal entry requires either a string `value` or a `params` object to be provided but neither was found');
                }
            }
        } finally {
            this.#_flags.constructed = true;
        }
    }

    /**
     * Returns the current rendered output string.
     *
     * ---------------------------------------------------------------------
     * 🔷 SOURCE OF TRUTH
     * ---------------------------------------------------------------------
     *
     * This property always reflects the currently visible terminal output
     * represented by the cell.
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
     * Always returns a string.
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
     * Finalization is irreversible.
     *
     * @returns `true` if immutable
     *
     * @since 1.0.0
     */
    get final(): boolean { return this.#_flags.finalized; }

    /**
     * Returns the rendered terminal height of the cell.
     *
     * Height is measured as the number of visible terminal rows occupied
     * by the rendered output.
     *
     * @returns Rendered terminal row count
     *
     * @since 1.0.0
     */
    get height(): number { return this.#_height; }

    /**
     * Returns an immutable snapshot of stored template parameters.
     *
     * These parameters represent the latest rendering input state used by
     * template rendering mode.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * ---------------------------------------------------------------------
     *
     * The returned object is frozen to prevent accidental external mutation.
     *
     * @returns Frozen parameter snapshot
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
     * Changing the template resets all stored parameters.
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
     * - activates projection mode
     * - clears all stored parameters
     *
     * ## Clearing a template
     *
     * - disables projection mode
     * - clears all stored parameters
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * - finalized cells reject template changes
     * - templates must be non-empty strings
     *
     * @param value - Template string or empty value to clear it
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
            throw new TypeError(`Terminal entry template must be a string, instead got ${typeof value}`);
        }

        if (value.trim().length === 0) {
            throw new Error(`Terminal entry template must not be empty`);
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
     * @throws Error if the cell has already been finalized
     *
     * @since 1.0.0
     */
    update(value: string, options?: { final?: boolean }): void {
        this.#_update(value, options);
    }

    /**
     * Updates the template parameters used to render the cell.
     *
     * The cell must have an active template before template parameters can be
     * updated. The supplied parameters are applied to the existing template and
     * the cell is re-rendered.
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
     * The supplied parameters are converted to their string representations
     * during template rendering.
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
     * Setting `patch` to `false` replaces all previously stored parameters before
     * applying the supplied values.
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
     * @param value - Template parameters to apply
     * @param options - Parameter update configuration
     *
     * @throws Error if the cell has already been finalized
     * @throws Error if no template is assigned to the cell
     *
     * @since 1.0.0
     */
    updateParams(
        value: Record<string, unknown>,
        options?: { final?: boolean; patch?: boolean }
    ): void {
        this.#_update(value, options);
    }

    /**
     * Finalizes the cell and permanently locks its state.
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
     *
     * @since 1.0.0
     */
    finalize(): void {
        if (this.#_flags.finalized) { return; }
        this.#_flags.finalized = true;
    }
}

/**Default export of ScreenCell. */
export default ScreenCell;