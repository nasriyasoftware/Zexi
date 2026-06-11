import type { CircularReferencePolicy, OutputLayout } from "../../types/types";

/**
 * Configuration for terminal (console) output rendering.
 *
 * Terminal rendering is optimized for:
 *
 * - interactive CLI environments
 * - human-readable inspection
 * - developer debugging workflows
 * - structured console logging
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Terminal rendering prioritizes:
 *
 * - readability
 * - visual hierarchy
 * - interactive inspection clarity
 * - ANSI-enhanced presentation
 *
 * Unlike JSON rendering, terminal rendering may apply:
 *
 * - ANSI colors
 * - text styles
 * - semantic formatting
 * - adaptive visual layout
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Terminal output is renderer-driven.
 *
 * Structural appearance is determined by:
 *
 * - renderer behavior
 * - layout configuration
 * - formatting capabilities
 *
 * This configuration controls:
 *
 * - cyclic reference behavior
 * - indentation width
 * - ANSI formatting capabilities
 * - layout formatting rules
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
export interface TerminalConfig {
    
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
     * - values greater than `0` increase visual nesting clarity
     *
     * @default 2
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    spaces: number;

    /**
     * ANSI formatting capabilities enabled during terminal rendering.
     *
     * Options:
     *
     * - `colors` → enable ANSI colors only
     * - `styles` → enable text styles only
     * - `both` → enable colors and styles
     * - `none` → disable all ANSI formatting
     *
     * This affects visual presentation only and does NOT alter:
     *
     * - structure
     * - traversal behavior
     * - semantic tokenization
     *
     * @default 'both'
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    formats: 'colors' | 'styles' | 'both' | 'none';

    /**
     * Layout behavior applied during terminal rendering.
     *
     * Controls:
     *
     * - spacing normalization
     * - line break behavior
     * - indentation strategy
     *
     * Layout rules influence visual presentation only.
     *
     * @default Terminal renderer preset
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    layout: OutputLayout;
}