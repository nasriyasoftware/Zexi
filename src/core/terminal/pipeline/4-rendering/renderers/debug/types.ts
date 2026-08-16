import type { OutputLayout } from "../../types/types";
import type { CircularReferencePolicy } from "../../../1-graphing/types";

/**
 * Configuration for debug output rendering.
 *
 * Debug rendering is optimized for maximum structural visibility
 * and diagnostic clarity during development workflows.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Debug output is designed for:
 *
 * - deep runtime inspection
 * - structural diagnostics
 * - development-time analysis
 * - debugging complex object graphs
 * - tracing nested relationships
 *
 * Unlike JSON rendering, debug output prioritizes:
 *
 * - readability
 * - inspection clarity
 * - structural transparency
 *
 * over compactness or serialization strictness.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Debug rendering is intentionally verbose.
 *
 * The renderer may:
 *
 * - expand nested structures aggressively
 * - preserve structural boundaries
 * - expose cyclic relationships visually
 * - prioritize inspection clarity over density
 *
 * This configuration controls:
 *
 * - cyclic reference behavior
 * - indentation width
 * - structural layout formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME CONTRACT
 * ---------------------------------------------------------------------
 *
 * This is a fully resolved runtime configuration object.
 *
 * All properties are guaranteed to exist during rendering.
 * Missing values are injected during normalization.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface DebugConfig {

    /**
     * Circular reference handling strategy.
     *
     * Controls how cyclic object graphs are processed during rendering.
     *
     * Options:
     *
     * - `ignore` → omit cyclic references from output
     * - `mark` → render visible circular reference markers
     * - `throw` → abort rendering when cycles are encountered
     *
     * This option influences graph traversal behavior before rendering begins.
     *
     * @default 'mark'
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    cycles: CircularReferencePolicy;

    /**
     * Number of spaces used for indentation.
     *
     * Higher values improve readability of deeply nested structures.
     *
     * A value of:
     *
     * - `0` minimizes indentation
     * - values greater than `0` increase nesting clarity
     *
     * Debug rendering typically uses larger indentation values
     * to improve structural visibility during inspection.
     *
     * @default 4
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    spaces: number;

    /**
     * Layout behavior applied during debug rendering.
     *
     * Controls:
     *
     * - spacing normalization
     * - line break behavior
     * - indentation strategy
     *
     * Layout rules influence visual presentation only and do NOT alter:
     *
     * - graph structure
     * - semantic meaning
     * - traversal semantics
     *
     * @default Debug renderer preset
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    layout: OutputLayout;
}

/**
 * User-supplied configuration for debug rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Debug options allow callers to customize how values are rendered for
 * inspection and diagnostics.
 *
 * Unlike {@link DebugConfig}, every property in this type is optional.
 * Any omitted values are resolved during the renderer's normalization
 * phase before rendering begins.
 *
 * ---------------------------------------------------------------------
 * 🔷 NORMALIZATION
 * ---------------------------------------------------------------------
 *
 * These options are converted into a fully resolved {@link DebugConfig}
 * prior to rendering.
 *
 * During normalization:
 *
 * - missing values receive renderer defaults
 * - rendering mode is resolved
 * - ANSI support is determined
 *
 * The renderer itself never operates directly on this type.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING CUSTOMIZATION
 * ---------------------------------------------------------------------
 *
 * These options influence only presentation.
 *
 * They do not affect:
 *
 * - graph traversal
 * - tokenization
 * - data extraction
 * - semantic interpretation
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface DebugOptions  {
    /**
     * Circular reference handling strategy.
     *
     * Determines how cyclic object graphs are handled during rendering.
     *
     * Supported values:
     *
     * - `ignore` — omit cyclic references from the rendered output.
     * - `mark` — replace cyclic references with visible markers.
     * - `throw` — abort rendering when a cycle is encountered.
     *
     * When omitted, the renderer uses its default cycle policy.
     *
     * @default 'mark'
     * @since 1.0.0
     */
    cycles?: CircularReferencePolicy;

    /**
     * Number of spaces used for indentation in pretty mode.
     *
     * Larger values improve readability of deeply nested structures,
     * while smaller values produce more compact output.
     *
     * This option has no effect when compact mode is selected.
     *
     * @default 4
     * @since 1.0.0
     */
    spaces?: number;
    
    /**
     * Enables ANSI escape sequences in the rendered output.
     *
     * When enabled, the renderer emits terminal styling such as colors
     * and emphasis for supported terminals.
     *
     * When disabled, all output is emitted as plain text.
     *
     * This option affects visual presentation only.
     *
     * @default false
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    ansiEnabled?: boolean;

    /**
     * Rendering layout mode.
     *
     * Controls how aggressively the renderer attempts to keep values on
     * a single line before expanding them into multi-line block layouts.
     *
     * Options:
     *
     * - `compact` → favors minimal whitespace and dense output
     * - `pretty` → favors readability with adaptive indentation and
     *   multi-line formatting
     *
     * @default "pretty"
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    mode?: "pretty" | "compact";
};

/**
 * Internal renderer state flags used during debug token traversal.
 *
 * These flags allow the debug renderer to coordinate transient rendering
 * decisions across multiple tokens without mutating the token stream itself.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Renderer flags control transient rendering behavior such as:
 *
 * - group suppression
 * - ANSI styling
 * - block-layout promotion
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
export interface DebugPipelineFlags {
    /**
     * Indicates that the currently active group should be skipped during
     * rendering.
     *
     * Used when renderer-specific formatting rules determine that the
     * current group's tokens should not be emitted.
     *
     * @since 1.0.0
     */
    ignoreCurrentGroup: boolean;

    /**
     * Indicates whether ANSI styling should be applied during rendering.
     *
     * When enabled, the renderer applies ANSI colors and styles to
     * supported diagnostic values such as primitives, functions, regular
     * expressions, and error information.
     *
     * @since 1.0.0
     */
    ansiEnabled: boolean;

    /**
     * Forces the next encountered group to render using block layout.
     *
     * Used when the current rendering decision determines that the next
     * group cannot safely remain in inline layout.
     *
     * The flag is consumed when the next group begins.
     *
     * @since 1.0.0
     */
    forceNextGroupAsBlock: boolean;
}