import type { OutputLayout } from "../../types/types";

/**
 * Configuration for JSON output rendering.
 *
 * JSON rendering produces deterministic, machine-readable output
 * intended for:
 *
 * - serialization
 * - structured logging
 * - transport pipelines
 * - external integrations
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This configuration controls:
 *
 * - indentation size
 * - structural formatting density
 * - whitespace normalization behavior
 * - line break behavior
 *
 * JSON rendering prioritizes:
 *
 * - deterministic structure
 * - serialization safety
 * - predictable output formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Unlike terminal rendering, JSON output does NOT support:
 *
 * - ANSI styling
 * - visual formatting styles
 * - semantic highlighting
 *
 * JSON output is always emitted as plain serialized text.
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME CONTRACT
 * ---------------------------------------------------------------------
 *
 * This is a fully resolved runtime configuration object.
 *
 * All properties are guaranteed to exist during rendering.
 * Missing values are injected during configuration normalization.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface JSONConfig {

    /**
     * Number of spaces used for indentation.
     *
     * A value of:
     *
     * - `0` produces fully compact output
     * - values greater than `0` improve readability
     *
     * This value controls indentation depth during pretty rendering.
     *
     * @default 0
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    spaces: number;

    /**
     * Layout behavior applied during JSON rendering.
     *
     * Controls:
     *
     * - spacing normalization
     * - line break behavior
     * - indentation strategy
     *
     * Layout rules influence only visual formatting and do NOT alter:
     *
     * - serialized values
     * - structural semantics
     * - traversal behavior
     *
     * @default JSON renderer preset
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    layout: OutputLayout;
}

/**
 * JsonOptions
 * ----------
 *
 * Configuration contract for the JSONRenderer output system.
 *
 * This type defines two fundamentally different rendering modes:
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODES
 * ---------------------------------------------------------------------
 *
 * 1. **compact (transport mode)**
 *
 *    - Designed for HTTP transfer and serialization efficiency
 *    - Produces single-line JSON output
 *    - Disables all layout-related formatting
 *    - No indentation, no optional whitespace decisions
 *    - Optimized for bandwidth and deterministic encoding
 *
 *    This mode prioritizes:
 *    - minimal byte size
 *    - fast serialization
 *    - strict structural consistency
 *
 * ---------------------------------------------------------------------
 * 2. **pretty (diagnostic mode)**
 *
 *    - Designed for human-readable inspection
 *    - Enables structured indentation and line breaks
 *    - Activates layout-aware rendering rules
 *    - Supports width-based formatting decisions (e.g. inline vs block)
 *
 *    This mode prioritizes:
 *    - readability
 *    - structural clarity
 *    - debugging and inspection workflows
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN CONSTRAINTS
 * ---------------------------------------------------------------------
 *
 * - Compact mode is intentionally restricted:
 *   - no indentation configuration
 *   - no layout tuning options
 *
 * - Pretty mode unlocks layout controls:
 *   - indentation spaces
 *   - maximum line width heuristics
 *
 * - The renderer guarantees deterministic output in both modes.
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE INTENT
 * ---------------------------------------------------------------------
 *
 * This configuration is not a general-purpose formatter API.
 * It is a low-level contract for the Zexi token rendering pipeline.
 *
 * It is designed to ensure:
 *
 * - predictable serialization behavior
 * - separation between transport and diagnostic output
 * - safe integration with token-based rendering engine
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type JsonOptions = {
    /**
     * Enables or disables ANSI-aware rendering behavior.
     *
     * This value may be:
     *
     * - injected by the logging system based on the selected projection
     *   (`as`)
     * - explicitly provided by the caller
     *
     * When omitted, it defaults to `false` in standalone rendering contexts,
     * but is typically overridden by the logging pipeline.
     *
     * @since 1.0.0
     */
    ansiEnabled?: boolean;
} & (JsonCompactOptions | JsonPrettyOptions);

/**
 * Options that enable pretty JSON rendering.
 *
 * Pretty mode is intended for human-readable output and inspection
 * workflows.
 *
 * These options are validated and normalized into a {@link JSONConfig}
 * before rendering begins.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Pretty mode controls:
 *
 * - indentation depth
 * - maximum line width heuristics
 * - inline vs block layout decisions
 * - readability-oriented formatting
 *
 * It does NOT affect:
 *
 * - graph construction
 * - representation generation
 * - tokenization behavior
 * - serialized semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 DETERMINISM
 * ---------------------------------------------------------------------
 *
 * Pretty rendering remains deterministic.
 *
 * Formatting decisions may differ from compact mode, but identical
 * inputs and options always produce identical output.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
interface JsonPrettyOptions {
    /**
     * Pretty mode
     * -----------
     *
     * Human-readable diagnostic format.
     *
     * Enables structured indentation and layout-aware rendering.
     *
     * @since 1.0.0
     */
    mode: 'pretty';

    /**
     * Number of spaces used for indentation.
     *
     * @default 2
     * @since 1.0.0
     */
    spaces?: number;

    /**
     * Maximum line width before layout engine forces a break.
     *
     * Used for:
     * - inline vs block decisions
     * - array/object formatting strategy
     *
     * @default Infinity
     * @since 1.0.0
     */
    maxWidth?: number;
};

/**
 * Options that enable compact JSON rendering.
 *
 * Compact mode produces transport-oriented JSON output with minimal
 * formatting overhead.
 *
 * These options are validated and normalized into a {@link JSONConfig}
 * before rendering begins.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Compact mode enforces:
 *
 * - single-line output
 * - zero indentation
 * - minimal whitespace
 * - deterministic formatting
 *
 * Layout customization is intentionally unavailable in this mode.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * Compact mode represents the canonical transport-oriented rendering
 * strategy of the JSON renderer.
 *
 * It is intended for:
 *
 * - network transmission
 * - structured logging
 * - storage pipelines
 * - machine-to-machine communication
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
interface JsonCompactOptions {
    /**
     * Compact mode
     * ------------
     *
     * A transport-optimized JSON output format.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN GOALS
     * ---------------------------------------------------------------------
     *
     * - Single-line output
     * - No indentation
     * - No optional whitespace
     * - Deterministic key ordering
     * - Minimal byte footprint for HTTP transfer
     *
     * This mode prioritizes:
     * - bandwidth efficiency
     * - parsing speed
     * - strict structural consistency
     *
     * @since 1.0.0
     */
    mode?: 'compact';
    spaces?: never;
    maxWidth?: never;
}

/**
 * Projection request for pretty JSON output.
 *
 * This type represents the subset of pretty-rendering options that may
 * be embedded in projection-based APIs such as logging pipelines.
 *
 * Unlike {@link JsonPrettyOptions}, projection requests expose only the
 * information required to identify the desired rendering mode and its
 * indentation behavior.
 *
 * @internal
 * @since 1.0.0
 */
type JsonPrettyProjection = Pick<JsonPrettyOptions, 'mode' | 'spaces'>;

/**
 * Projection request for compact JSON output.
 *
 * This type represents the minimal information required to request
 * compact JSON serialization from projection-based APIs.
 *
 * Compact projections intentionally expose no formatting controls
 * beyond mode selection.
 *
 * @internal
 * @since 1.0.0
 */
type JsonCompactProjection = Pick<JsonCompactOptions, 'mode'>;

/**
 * JSON output projection.
 *
 * A JSON projection describes the JSON representation that should be
 * generated when JSON output is requested from the logging pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Projections allow the logging system to generate JSON output in a
 * format appropriate for the intended use case.
 *
 * Supported rendering modes include:
 *
 * - `compact` for transport-oriented output
 * - `pretty` for human-readable output
 *
 * ---------------------------------------------------------------------
 * 🔷 PRETTY MODE
 * ---------------------------------------------------------------------
 *
 * Pretty projections support indentation customization through the
 * `spaces` property.
 *
 * Example:
 *
 * ```ts
 * logger.log(value, {
 *     as: 'json',
 *     customize: {
 *         json: {
 *             mode: 'pretty',
 *             spaces: 4
 *         }
 *     }
 * });
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPACT MODE
 * ---------------------------------------------------------------------
 *
 * Compact projections produce a condensed JSON representation with
 * minimal whitespace.
 *
 * Example:
 *
 * ```ts
 * logger.log(value, {
 *     as: 'json',
 *     customize: {
 *         json: {
 *             mode: 'compact'
 *         }
 *     }
 * });
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTES
 * ---------------------------------------------------------------------
 *
 * A projection describes only how JSON output should be formatted.
 *
 * It does not control:
 *
 * - output routing
 * - event emission
 * - terminal output behavior
 * - logging namespaces
 *
 * These concerns are configured separately by the logging system.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type JsonProjection = JsonPrettyProjection | JsonCompactProjection;

/**
 * Internal renderer state flags used during token traversal.
 *
 * These flags allow the renderer to coordinate formatting decisions
 * across multiple tokens without mutating the token stream itself.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Renderer flags control transient rendering behavior such as:
 *
 * - separator suppression
 * - line-break suppression
 * - group expansion decisions
 * - contextual formatting overrides
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFETIME
 * ---------------------------------------------------------------------
 *
 * Flags exist only for the duration of a single render operation.
 *
 * They are mutable internal state and must not be exposed outside the
 * renderer implementation.
 *
 * ---------------------------------------------------------------------
 * @internal
 * @since 1.0.0
 */
export interface JSONPipelineFlags {
    /**
     * Indicates that the currently active group should be skipped during
     * rendering.
     *
     * Used by renderer-specific formatting rules that need to suppress
     * a previously scheduled group emission.
     * 
     * @since 1.0.0
     */
    ignoreCurrentGroup: boolean;

    /**
     * Indicates that the next separator token should not be emitted.
     *
     * Typically used when structural transformations would otherwise
     * produce redundant separators.
     * 
     * @since 1.0.0
     */
    skipNextSeparator: boolean;

    /**
     * Indicates that the next soft line token should be ignored.
     *
     * Allows layout rules to collapse optional line breaks when an
     * inline representation is preferred.
     * 
     * @since 1.0.0
     */
    skipNextSoftLine: boolean;

    /**
     * Forces the next encountered group to render in block mode.
     *
     * Used when width constraints or formatting rules determine that
     * inline rendering is no longer appropriate.
     * 
     * @since 1.0.0
     */
    forceNextGroupAsBlock: boolean;

    /**
     * Indicates whether ANSI tokens should be preserved during rendering.
     *
     * This value is fully resolved during normalization and is never
     * undefined at runtime.
     *
     * It is derived from upstream projection policy (e.g. `as` selection).
     *
     * @since 1.0.0
     */
    ansiEnabled: boolean;
}