import type { CircularReferencePolicy, OutputLayout } from "../../types/types";

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