import { ANSI } from "./ansi";
import { buildTags } from "./helpers";
import { hasOwnProp, isRecord } from "../../../utils/utils";
import type { KnownColorNames, PredefinedStyle } from "./types";
import TagsReplacer from "./tags";

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
     * Renders semantic formatting tags into ANSI escape sequences.
     *
     * This is the core transformation pipeline of the styling system.
     *
     * It converts custom inline markup into terminal-safe ANSI output:
     *
     * ```text
     * <:color:red>   → ANSI red foreground
     * <:style:bold>  → ANSI bold sequence
     * <:reset>       → ANSI reset sequence
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 RENDERING PIPELINE
     * ---------------------------------------------------------------------
     *
     * Input string is processed through sequential transformations:
     *
     * 1. Reset tags
     * 2. Foreground colors
     * 3. Bright foreground colors
     * 4. Background colors
     * 5. Bright background colors
     * 6. Style tags
     *
     * Each step replaces semantic tags with ANSI codes.
     *
     * ---------------------------------------------------------------------
     * 🔷 FALLBACK BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * If a tag is not recognized:
     *
     * ## Non-strict mode
     *
     * The tag is preserved:
     *
     * ```text
     * <:color:unknown>
     * ```
     *
     * ## Strict mode
     *
     * The tag is removed entirely.
     *
     * ---------------------------------------------------------------------
     * 🔷 USE CASES
     * ---------------------------------------------------------------------
     *
     * - CLI UI rendering
     * - debug console formatting
     * - log beautification
     * - terminal component styling
     *
     * @param input - Raw string containing formatting tags
     * @param options - Rendering configuration
     * @param options.strict - If true, invalid tags are removed instead of preserved
     * @returns ANSI-formatted terminal string
     * 
     * @since 1.0.0
     */
    render(input: string, options?: { strict?: boolean }): string {
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