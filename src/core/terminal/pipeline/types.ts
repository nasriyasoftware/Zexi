import type { CircularReferencePolicy } from "./4-rendering/types/types";

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
export interface TerminalOptions {
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
export type JsonOptions =
    | {
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

        /**
         * Optional hard cap for line width enforcement.
         *
         * NOTE:
         * In compact mode this is NOT used for formatting decisions,
         * only for validation or future transport constraints.
         *
         * @since 1.0.0
         */
        maxWidth?: never;

        /**
         * Indentation is disabled in compact mode.
         *
         * @since 1.0.0
         */
        spaces?: never;
    }
    | {
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