import type { JsonOptions } from "./4-rendering/renderers/json/types";
import type { CircularReferencePolicy } from "./1-graphing/types";

/**
 * Output targets supported by the logging pipeline.
 *
 * Each output target represents an independent rendering backend that
 * consumes the same token stream and produces a final formatted output.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * Output targets are the final stage entry points of the pipeline:
 *
 * ```text
 * JavaScript Value
 *        ↓
 * Graphing Layer (cycle policy applied here)
 *        ↓
 * Representation Layer
 *        ↓
 * Tokenization Layer
 *        ↓
 * Rendering Layer (per OutputTarget)
 *        ↓
 * Final Output String
 * ```
 *
 * Each target operates independently, but may share upstream pipeline
 * artifacts when compatible.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLE
 * ---------------------------------------------------------------------
 *
 * Output targets define *where output is produced*, not how data is
 * constructed or interpreted.
 *
 * They do NOT affect:
 *
 * - graph construction strategy
 * - representation structure
 * - tokenization rules
 *
 * They ONLY determine:
 *
 * - which rendering pipelines are executed
 * - which renderer implementation is used
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type OutputTarget =
    | 'terminal'
    | 'json'
    | 'debug';

/**
 * Configuration options for terminal output rendering.
 *
 * Terminal output is designed for interactive developer environments such
 * as CLI tools, debugging sessions, and runtime inspection workflows.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Terminal options control:
 *
 * - visual formatting (colors, styles)
 * - indentation structure
 * - verbosity mode
 *
 * ---------------------------------------------------------------------
 * 🔷 NOT RESPONSIBLE FOR
 * ---------------------------------------------------------------------
 *
 * Terminal options DO NOT control:
 *
 * - graph construction behavior
 * - representation structure
 * - tokenization logic
 *
 * ---------------------------------------------------------------------
 * 🔷 CIRCULAR REFERENCES
 * ---------------------------------------------------------------------
 *
 * Circular reference handling is applied during GRAPH CONSTRUCTION,
 * not rendering.
 *
 * This field exists ONLY to allow the terminal renderer to select an
 * appropriate graphing strategy when requesting a pipeline execution.
 *
 * It is forwarded into the graphing layer and affects graph shape.
 *
 * ---------------------------------------------------------------------
 * @internal
 * This type is internal pipeline configuration and not part of the
 * public API contract.
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type TerminalOptions = {
    /**
     * Number of spaces used for indentation in terminal output.
     *
     * Controls readability of nested structures.
     *
     * @default 2
     * @since 1.0.0
     */
    spaces?: number;

    /**
     * Visual formatting mode applied in terminal output.
     *
     * Options:
     *
     * - `colors` → ANSI color output only
     * - `styles` → text styling only
     * - `both` → colors and styles enabled
     * - `none` → no formatting applied
     *
     * @default 'both'
     * @since 1.0.0
     */
    formats?: 'colors' | 'styles' | 'none' | 'both';

    /**
     * Output verbosity mode for terminal rendering.
     *
     * Options:
     *
     * - `pretty` → multi-line structured output
     * - `compact` → minimal inline output
     *
     * @default 'pretty'
     * @since 1.0.0
     */
    mode?: 'pretty' | 'compact';

    /**
     * Circular reference handling strategy used during GRAPH CONSTRUCTION.
     *
     * This option directly influences how the input value is converted into
     * a graph structure before representation and tokenization.
     *
     * ---------------------------------------------------------------------
     * 🔷 GRAPHING BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - `ignore` → skip cyclic references during traversal
     * - `mark` → preserve cycles using reference nodes
     * - `throw` → throw error on cycle detection
     *
     * ---------------------------------------------------------------------
     * 🔷 PIPELINE IMPACT
     * ---------------------------------------------------------------------
     *
     * This option affects:
     *
     * - graph node structure
     * - traversal completeness
     * - reference node creation
     *
     * It does NOT affect:
     *
     * - tokenization
     * - serialization formatting
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    cycles?: CircularReferencePolicy;

    /**
     * Maximum line width used when rendering terminal output.
     *
     * The renderer may use this value to:
     *
     * - wrap long lines
     * - reflow indentation
     * - determine when compact layouts should expand
     *
     * The width is measured in visible character columns.
     *
     * A value of `undefined` causes the renderer to use the
     * current terminal width when available.
     *
     * @default terminal width
     * @since 1.0.0
     */
    maxWidth?: number;
}


/**
 * Configuration options for debug output rendering.
 *
 * Debug output is designed for maximum visibility, inspection, and
 * structural clarity during development.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Debug options control:
 *
 * - indentation depth
 * - structural readability
 * - verbosity of output formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * Debug output prioritizes completeness over compactness.
 *
 * It is intended for developers inspecting internal structures.
 *
 * ---------------------------------------------------------------------
 * @internal
 * Internal pipeline configuration only.
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface DebugOptions {
    /**
     * Number of spaces used for indentation in debug output.
     *
     * Higher values improve readability of deeply nested structures.
     *
     * @default 4
     * @since 1.0.0
     */
    spaces?: number;

    /**
     * Circular reference handling strategy used during GRAPH CONSTRUCTION.
     *
     * This affects how cycles are represented in the underlying graph
     * before being transformed into representation and tokens.
     *
     * Options:
     *
     * - `ignore` → skip cyclic references
     * - `mark` → annotate cycles in graph
     * - `throw` → throw on detection
     *
     * ---------------------------------------------------------------------
     * 🔷 PIPELINE IMPACT
     * ---------------------------------------------------------------------
     *
     * This option affects:
     *
     * - graph structure
     * - reference node creation
     *
     * It does NOT affect:
     *
     * - tokenization
     * - rendering logic
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    cycles?: CircularReferencePolicy;
}

/**
 * Defines how a value should be logged and rendered.
 *
 * An `OutputPlan` describes:
 *
 * 1. Which outputs should be produced
 * 2. How each output should be formatted
 *
 * This allows a single log call to produce multiple representations
 * of the same value (for example terminal + JSON + debug output).
 *
 * ---------------------------------------------------------------------
 * 🔷 BEHAVIOR MODEL
 * ---------------------------------------------------------------------
 *
 * Each output target is rendered independently using its own options.
 *
 * This means you can:
 *
 * - render the same value in multiple formats at once
 * - customize each output separately
 * - keep formatting concerns isolated per target
 *
 * ---------------------------------------------------------------------
 * 🔷 DEFAULT BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * If no outputs are specified, the value is rendered to:
 *
 * - `terminal`
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * const plan: OutputPlan = {
 *   outputs: ['terminal', 'json'],
 *   customize: {
 *     terminal: {
 *       spaces: 2,
 *       formats: 'both',
 *       mode: 'pretty',
 *       cycles: 'mark'
 *     },
 *     json: {
 *       spaces: 0,
 *       mode: 'compact'
 *     }
 *   }
 * };
 * ```
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface OutputPlan {
    /**
     * Output targets to render the value into.
     *
     * You may specify:
     * - a single output target
     * - multiple output targets
     *
     * If omitted, defaults to:
     * - `terminal`
     *
     * @default 'terminal'
     */
    outputs?: OutputTarget | OutputTarget[];

    /**
     * Optional configuration for each output target.
     *
     * Each target can be customized independently without affecting others.
     *
     * Only the options relevant to that target are applied.
     */
    customize?: {
        /**
         * Terminal (console) output configuration.
         *
         * Controls how values appear in the terminal, including:
         * - indentation
         * - visual formatting
         * - verbosity
         * - circular reference behavior
         */
        terminal?: TerminalOptions;

        /**
         * JSON output configuration.
         *
         * Controls how values are serialized into JSON format,
         * primarily focusing on readability vs compactness.
         */
        json?: JsonOptions;

        /**
         * Debug output configuration.
         *
         * Used for highly detailed inspection of values.
         * Prioritizes clarity over compactness.
         */
        debug?: DebugOptions;
    };
}