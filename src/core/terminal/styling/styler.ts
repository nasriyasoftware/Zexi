import TagsReplacer from "./tags";
import { ANSI } from "./ansi";
import { buildTags, resolveAnsiColor, resolveAnsiStyle } from "./helpers";
import { hasOwnProp, isRecord } from "../../../utils/utils";
import type { AnsiColor, AnsiStyle, PredefinedColor, PredefinedStyle } from "./types";

/**
 * ANSI-based terminal styling and formatting engine.
 *
 * `ConsoleStyler` is a lightweight text transformation layer that converts
 * semantic formatting tags into ANSI escape sequences for terminal output.
 *
 * It also provides:
 *
 * - ANSI stripping utilities
 * - ANSI detection utilities
 * - template-tag rendering system
 * - safe fallback formatting behavior
 * - precomputed tag dictionary generation
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * `ConsoleStyler` sits at the boundary between:
 *
 * ```text
 * Semantic Formatting Layer
 *          ↓
 * ConsoleStyler (this class)
 *          ↓
 * ANSI Escape Output
 *          ↓
 * Terminal Renderer / Screen Engine
 * ```
 *
 * It is NOT responsible for layout, rendering, or positioning.
 *
 * It only translates *intent → ANSI codes*.
 *
 * ---------------------------------------------------------------------
 * 🔷 FORMATTING MODEL
 * ---------------------------------------------------------------------
 *
 * The system uses a custom inline markup syntax:
 *
 * ```text
 * <:type:value>
 * ```
 *
 * Example:
 *
 * ```text
 * <:color:red>
 * <:style:bold>
 * <:reset>
 * ```
 *
 * These tags are expanded into ANSI escape sequences.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRICT MODE BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Rendering supports two modes:
 *
 * ## Strict mode disabled (default)
 *
 * Invalid tags are preserved as-is:
 *
 * ```text
 * <:color:unknown> → "<:color:unknown>"
 * ```
 *
 * This is useful for debugging or preview systems.
 *
 * ## Strict mode enabled
 *
 * Invalid tags are removed entirely:
 *
 * ```text
 * <:color:unknown> → ""
 * ```
 *
 * This produces clean terminal output with no artifacts.
 *
 * ---------------------------------------------------------------------
 * 🔷 TAG RESOLUTION SYSTEM
 * ---------------------------------------------------------------------
 *
 * The renderer supports four categories of tags:
 *
 * ### 1. Foreground colors
 *
 * ```text
 * <:color:red>
 * <:color:bright-red>
 * ```
 *
 * ### 2. Background colors
 *
 * ```text
 * <:color-bg:blue>
 * <:color-bg:bright-blue>
 * ```
 *
 * ### 3. Styles
 *
 * ```text
 * <:style:bold>
 * <:style:underline>
 * ```
 *
 * ### 4. Reset
 *
 * ```text
 * <:reset>
 * ```
 *
 * Each tag is mapped to a predefined ANSI escape sequence.
 *
 * ---------------------------------------------------------------------
 * 🔷 ANSI DETECTION MODEL
 * ---------------------------------------------------------------------
 *
 * The engine provides lightweight detection utilities:
 *
 * - `strip()` removes all ANSI sequences
 * - `hasANSI()` detects presence of ANSI formatting
 *
 * These are useful for:
 *
 * - layout calculations
 * - terminal width correction
 * - snapshot diffing
 *
 * ---------------------------------------------------------------------
 * 🔷 TAG GENERATION SYSTEM
 * ---------------------------------------------------------------------
 *
 * `ConsoleStyler` exposes a precomputed tag registry:
 *
 * ```ts
 * consoleStyler.tags
 * ```
 *
 * This includes:
 *
 * - all foreground colors
 * - all background colors
 * - all styles
 * - reset tag
 *
 * Example:
 *
 * ```ts
 * tags.color.red        → "<:color:red>"
 * tags.colorBg.blue     → "<:color-bg:blue>"
 * tags.style.bold       → "<:style:bold>"
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLES
 * ---------------------------------------------------------------------
 *
 * - deterministic string transformation
 * - zero layout awareness
 * - stateless rendering pipeline
 * - strict separation of semantics vs ANSI encoding
 *
 * This ensures it can be safely used in:
 *
 * - CLI frameworks
 * - log formatters
 * - terminal UI engines
 * - debugging overlays
 *
 * @since 1.0.0
 */
class ConsoleStyler {
    /**
     * Removes all ANSI escape sequences from a string.
     *
     * This is used to normalize terminal output into plain text.
     *
     * ---------------------------------------------------------------------
     * 🔷 USE CASES
     * ---------------------------------------------------------------------
     *
     * - calculating visible string width
     * - logging raw output
     * - diffing rendered snapshots
     * - serialization
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPLEMENTATION DETAILS
     * ---------------------------------------------------------------------
     *
     * Matches any ANSI SGR sequence:
     *
     * ```text
     * \x1b[ ... m
     * ```
     *
     * @param str - Input string potentially containing ANSI codes
     * @returns Clean string without ANSI escape sequences
     * 
     * @since 1.0.0
     */
    strip(str: string): string {
        return str.replace(/\x1b\[[0-9;]*m/g, "");
    }

    /**
     * Detects whether a string contains ANSI escape sequences.
     *
     * This is a lightweight heuristic check used for:
     *
     * - conditional rendering paths
     * - layout adjustment decisions
     * - optimization shortcuts in rendering engines
     *
     * ---------------------------------------------------------------------
     * 🔷 LIMITATION
     * ---------------------------------------------------------------------
     *
     * This does not validate correctness of ANSI sequences.
     * It only detects presence of SGR-like patterns.
     *
     * @param str - Input string
     * @returns `true` if ANSI escape sequences are detected
     * 
     * @since 1.0.0
     */
    hasANSI(str: string): boolean {
        return /\x1b\[[0-9;]*m/.test(str);
    }

    /**
     * Compiles semantic formatting tags into ANSI escape sequences.
     *
     * This method is the **tag compilation stage** of the styling system.
     * It transforms a custom inline markup language into terminal-ready ANSI output.
     *
     * ---------------------------------------------------------------------
     * 🔷 COMPILATION MODEL
     * ---------------------------------------------------------------------
     *
     * The input is treated as a declarative string containing formatting tags:
     *
     * ```text
     * <:color:red>     → ANSI foreground color (red)
     * <:style:bold>    → ANSI style sequence (bold)
     * <:reset>         → ANSI reset sequence
     * ```
     *
     * These tags are replaced with their corresponding ANSI escape codes in a
     * deterministic, single-pass transformation pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 PROCESSING PIPELINE
     * ---------------------------------------------------------------------
     *
     * Compilation applies a sequence of ordered replacements:
     *
     * 1. Reset tags
     * 2. Foreground colors
     * 3. Bright foreground colors
     * 4. Background colors
     * 5. Bright background colors
     * 6. Style tags
     *
     * Each stage substitutes recognized tags with their ANSI equivalents.
     *
     * ---------------------------------------------------------------------
     * 🔷 STRICT MODE BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * The `strict` option controls how unknown or invalid tags are handled:
     *
     * ## strict = false (default)
     *
     * Unknown tags are preserved in their original form:
     *
     * ```text
     * <:color:unknown>
     * ```
     *
     * This is useful for debugging, preview systems, or partial compilation.
     *
     * ## strict = true
     *
     * Unknown tags are removed from the output entirely:
     *
     * ```text
     * <:color:unknown> → ""
     * ```
     *
     * This produces clean terminal output without artifacts.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN GUARANTEES
     * ---------------------------------------------------------------------
     *
     * - Deterministic string transformation
     * - No state mutation
     * - No layout or width awareness
     * - Pure semantic-to-ANSI compilation
     *
     * ---------------------------------------------------------------------
     * 🔷 TYPICAL USE CASES
     * ---------------------------------------------------------------------
     *
     * - CLI formatting systems
     * - structured logging output
     * - terminal UI text styling
     * - debug visualization layers
     *
     * @param input
     * Raw string containing formatting tags.
     *
     * @param options
     * Compilation options.
     *
     * @param options.strict
     * If `true`, unknown tags are removed instead of preserved.
     *
     * @returns
     * ANSI-formatted string ready for terminal output.
     *
     * @since 1.0.0
     */
    compile(input: string, options?: { strict?: boolean }): string {
        const config = {
            strict: false
        }

        if (options !== undefined) {
            if (!isRecord(options)) {
                throw new TypeError(`Expected options (when provided) to be an object, got ${typeof options}`);
            }

            if (hasOwnProp(options, 'strict')) {
                if (typeof options.strict !== 'boolean') {
                    throw new TypeError(`Expected options.strict to be a boolean, got ${typeof options.strict}`);
                }

                config.strict = options.strict;
            }
        }

        return TagsReplacer.replace(input, config.strict);
    }

    /**
     * Applies ANSI formatting to a string using foreground color, background color,
     * and one or more styles.
     *
     * This is the primary formatting primitive of the ConsoleStyler system.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR MODEL
     * ---------------------------------------------------------------------
     *
     * - Resolves semantic inputs (names or ANSI codes) into ANSI escape sequences
     * - Applies foreground color (if provided)
     * - Applies background color (if provided)
     * - Applies one or more styles (if provided)
     * - Appends a single ANSI reset at the end of the output
     *
     * ---------------------------------------------------------------------
     * 🔷 INPUT NORMALIZATION
     * ---------------------------------------------------------------------
     *
     * - `style` may be:
     *   - a single style
     *   - an array of styles
     *
     * All styles are normalized into a Set to ensure:
     * - no duplicates
     * - deterministic output order (insertion order preserved)
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * The function is strict and will throw on invalid input:
     *
     * - `options` must be a non-null object
     * - `color`, `bgColor`, and `style` must be strings (or arrays of strings)
     * - unknown colors/styles result in runtime errors
     *
     * ---------------------------------------------------------------------
     * 🔷 EARLY EXIT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * If no formatting options are provided (no color, bgColor, or style),
     * the original text is returned unchanged.
     *
     * ---------------------------------------------------------------------
     * 🔷 ANSI OUTPUT CONTRACT
     * ---------------------------------------------------------------------
     *
     * Output structure:
     *
     * ```text
     * [foreground][background][styles]text[reset]
     * ```
     *
     * Reset is always appended regardless of input state to ensure terminal safety.
     *
     * @param text - Raw input string to format
     * @param options - Formatting configuration
     * @param options.color - Foreground color (named or ANSI escape code)
     * @param options.bgColor - Background color (named or ANSI escape code)
     * @param options.style - One or more text styles
     *
     * @returns ANSI-formatted string with applied styles and reset sequence
     *
     * @throws {TypeError} If options is missing or not a valid object
     * @throws {TypeError} If any provided property is not a string
     * @throws {Error} If a color or style cannot be resolved
     *
     * @since 1.0.0
     */
    format(
        text: string,
        options: {
            color?: PredefinedColor | AnsiColor;
            bgColor?: PredefinedColor | AnsiColor;
            style?: PredefinedStyle | AnsiStyle | (PredefinedStyle | AnsiStyle)[];
        }
    ): string {
        const formats = {
            color: null as AnsiColor | null,
            bgColor: null as AnsiColor | null,
            style: new Set<AnsiStyle>(),
        };

        if (options === undefined) {
            throw new TypeError(`Expected options to be an object, got none was provided`);
        }

        if (!isRecord(options)) {
            throw new TypeError(`Expected options (when provided) to be an object, got ${typeof options}`);
        }

        if (hasOwnProp(options, 'color') && options.color !== undefined) {
            if (typeof options.color !== 'string') {
                throw new TypeError(`Expected options.color to be a string, got ${typeof options.color}`);
            }

            const color = resolveAnsiColor(options.color, 'fg');
            if (!color) {
                throw new Error(`Unknown foreground color "${options.color}"`);
            }

            formats.color = color;
        }

        if (hasOwnProp(options, 'bgColor') && options.bgColor !== undefined) {
            if (typeof options.bgColor !== 'string') {
                throw new TypeError(`Expected options.bgColor to be a string, got ${typeof options.bgColor}`);
            }

            const color = resolveAnsiColor(options.bgColor, 'bg');
            if (!color) {
                throw new Error(`Unknown background color "${options.bgColor}"`);
            }

            formats.bgColor = color;
        }

        if (hasOwnProp(options, 'style') && options.style !== undefined) {
            const styles = Array.isArray(options.style) ? options.style : [options.style];

            for (const style of styles) {
                if (typeof style !== 'string') {
                    throw new TypeError(`Expected options.style to be a string, got ${typeof style}`);
                }

                const resovled = resolveAnsiStyle(style);
                if (!resovled) {
                    throw new Error(`Unknown style "${style}"`);
                }

                formats.style.add(resovled);
            }
        }

        if (
            formats.color === null &&
            formats.bgColor === null &&
            formats.style.size === 0
        ) {
            return text;
        }

        const c = formats.color ?? '';
        const b = formats.bgColor ?? '';
        const s = Array.from(formats.style).join('');

        return `${c}${b}${s}${text}${ANSI.reset}`;
    }

    /**
     * Applies a foreground ANSI color to a string.
     *
     * This is a convenience wrapper around `format()` that only affects
     * foreground color.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Resolves the color using the ANSI palette or direct ANSI code
     * - Applies only foreground coloring
     * - Leaves background and style unchanged
     * - Always appends a reset sequence via `format()`
     *
     * @param text - Input string to colorize
     * @param color - Foreground color (named or ANSI escape code)
     *
     * @returns ANSI-formatted string with foreground color applied
     *
     * @throws {TypeError} If the color is not a string internally
     * @throws {Error} If the color cannot be resolved
     *
     * @since 1.0.0
     */
    color(text: string, color: PredefinedColor | AnsiColor): string {
        return this.format(text, { color });
    }

    /**
     * Applies a background ANSI color to a string.
     *
     * This is a convenience wrapper around `format()` that only affects
     * background color.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Resolves the background color using the ANSI palette or escape code
     * - Applies only background coloring
     * - Leaves foreground and style unchanged
     * - Always appends a reset sequence via `format()`
     *
     * @param text - Input string to style
     * @param color - Background color (named or ANSI escape code)
     *
     * @returns ANSI-formatted string with background color applied
     *
     * @throws {TypeError} If the color is not a string internally
     * @throws {Error} If the color cannot be resolved
     *
     * @since 1.0.0
     */
    bgColor(text: string, color: PredefinedColor | AnsiColor): string {
        return this.format(text, { bgColor: color });
    }

    /**
     * Applies one or more ANSI text styles to a string.
     *
     * This is a convenience wrapper around `format()` that only affects styling
     * (bold, italic, underline, etc.).
     *
     * ---------------------------------------------------------------------
     * 🔷 INPUT MODEL
     * ---------------------------------------------------------------------
     *
     * The style parameter supports both:
     *
     * - a single style
     * - an array of styles
     *
     * All styles are normalized internally into a Set to ensure:
     * - deduplication
     * - deterministic ordering
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Resolves each style against the ANSI style registry
     * - Applies styles in insertion order
     * - Does not affect foreground or background colors
     * - Always appends a reset sequence via `format()`
     *
     * @param text - Input string to style
     * @param style - One or more ANSI styles (named or raw escape codes)
     *
     * @returns ANSI-formatted string with styles applied
     *
     * @throws {TypeError} If any style is not a string
     * @throws {Error} If any style cannot be resolved
     *
     * @since 1.0.0
     */
    style(
        text: string,
        style: PredefinedStyle | AnsiStyle | (PredefinedStyle | AnsiStyle)[]
    ): string {
        return this.format(text, { style });
    }

    /**
     * Direct reference to the ANSI escape sequence library.
     *
     * Exposes low-level ANSI primitives including:
     *
     * - colors
     * - styles
     * - reset codes
     *
     * This is provided for advanced usage where manual ANSI control
     * is required outside the tag system.
     *
     * @readonly
     * @since 1.0.0
     */
    readonly ansi = ANSI;

    /**
     * Precomputed lookup table of formatting tags.
     *
     * This object provides a structured mapping from semantic style
     * identifiers to inline markup tags.
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * tags.reset
     * tags.color.red
     * tags.colorBg.blue
     * tags.style.bold
     * ```
     *
     * Each entry produces a string in the format:
     *
     * ```text
     * <:type:value>
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * - avoids manual tag construction
     * - ensures consistency in formatting syntax
     * - enables autocomplete-friendly styling API
     *
     * @readonly
     * @since 1.0.0
     */
    readonly tags = buildTags();
}

const consoleStyler = new ConsoleStyler();
export default consoleStyler;