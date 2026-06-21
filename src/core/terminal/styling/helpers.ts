import { ANSI } from "./ansi";
import type { AnsiFgColor, AnsiBgColor, AnsiColor, AnsiStyle, FormatTags } from "./types";

/**
 * ANSI styling utility helpers.
 *
 * This module provides the low-level infrastructure used by the console
 * styling system to:
 *
 * - validate ANSI escape sequences
 * - resolve named colors and styles
 * - normalize user-supplied formatting values
 * - generate semantic formatting tags
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED COLOR MODES
 * ---------------------------------------------------------------------
 *
 * The helpers recognize three categories of ANSI colors:
 *
 * ### Named ANSI colors
 *
 * Colors defined by the built-in ANSI palette:
 *
 * ```text
 * blue
 * cyan
 * bright-blue
 * bright-cyan
 * ```
 *
 * ### 256-color mode
 *
 * Terminal color cube values:
 *
 * ```text
 * \x1b[38;5;196m
 * \x1b[48;5;220m
 * ```
 *
 * ### Truecolor (24-bit RGB)
 *
 * Full RGB color sequences:
 *
 * ```text
 * \x1b[38;2;255;128;0m
 * \x1b[48;2;12;34;56m
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 RESOLUTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Resolution helpers follow a two-step process:
 *
 * 1. Attempt lookup in the predefined ANSI palette.
 * 2. If not found, validate the value as a raw ANSI escape sequence.
 *
 * This allows APIs to accept either semantic names or explicit ANSI codes.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * - deterministic resolution
 * - strict ANSI validation
 * - zero terminal state management
 * - reusable building blocks for higher-level styling APIs
 *
 * @since 1.0.0
 */

/**
 * Regular-expression fragment matching a single RGB channel value.
 *
 * Accepted range:
 *
 * ```text
 * 0-255
 * ```
 *
 * This fragment is embedded into the foreground and background truecolor
 * validators to ensure ANSI RGB escape sequences contain only valid channel
 * values.
 *
 * Examples:
 *
 * ```text
 * 0
 * 7
 * 128
 * 255
 * ```
 *
 * Invalid:
 *
 * ```text
 * -1
 * 256
 * 999
 * ```
 *
 * @internal
 * @since 1.0.0
 */
const rgbChannel = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;

/**
 * Precompiled ANSI color validation patterns.
 *
 * The registry is split by ANSI namespace:
 *
 * - `fg` → foreground colors (`38`)
 * - `bg` → background colors (`48`)
 *
 * Each namespace supports:
 *
 * - RGB truecolor validation
 * - 256-color validation
 *
 * These expressions are intentionally anchored (`^...$`) so they validate
 * complete ANSI escape sequences rather than partial matches.
 *
 * @internal
 * @since 1.0.0
 */
const colorRegex = {
    fg: {
        /**
         * Matches ANSI truecolor (RGB) foreground escape sequences.
         *
         * Format:
         * `\x1b[38;2;r;g;bm`
         *
         * Used to validate 24-bit foreground color escape codes.
         */
        rgb: new RegExp(String.raw`^\x1b\[38;2;${rgbChannel};${rgbChannel};${rgbChannel}m$`),

        /**
         * Matches ANSI 256-color foreground escape sequences.
         *
         * Format:
         * `\x1b[38;5;<0-255>m`
         *
         * Used to validate extended foreground color codes in terminal output.
         */
        x256: /^\x1b\[38;5;(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)m$/
    },

    bg: {
        /**
         * Matches ANSI truecolor (RGB) background escape sequences.
         *
         * Format:
         * `\x1b[48;2;r;g;bm`
         *
         * Used to validate 24-bit background color escape codes.
         */
        rgb: new RegExp(String.raw`^\x1b\[48;2;${rgbChannel};${rgbChannel};${rgbChannel}m$`),
        /**
         * Matches ANSI 256-color background escape sequences.
         *
         * Format:
         * `\x1b[48;5;<0-255>m`
         *
         * Used to validate extended background color codes in terminal output.
         */
        x256: /^\x1b\[48;5;(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)m$/,
    }
}

/**
 * ANSI escape-sequence type guards.
 *
 * This collection provides runtime validation utilities that narrow unknown
 * strings into strongly-typed ANSI primitives.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE NARROWING
 * ---------------------------------------------------------------------
 *
 * Successful validation refines the TypeScript type:
 *
 * ```ts
 * if (ansiIs.fgColor(value)) {
 *     // value is AnsiFgColor
 * }
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 VALIDATION SCOPE
 * ---------------------------------------------------------------------
 *
 * These helpers validate:
 *
 * - predefined ANSI palette values
 * - bright palette variants
 * - ANSI 256-color sequences
 * - ANSI truecolor sequences
 * - ANSI style codes
 *
 * They do not attempt to verify terminal compatibility or rendering support.
 *
 * @since 1.0.0
 */
export const ansiIs = {
    /**
     * Checks whether a string is a valid ANSI foreground color code.
     *
     * Supports:
     * - standard named colors
     * - bright named colors
     * - 256-color mode (`38;5;`)
     * - RGB truecolor mode (`38;2;`)
     *
     * @param code - ANSI escape sequence
     * @returns `true` if the code is a valid foreground color
     */
    fgColor(code: string): code is AnsiFgColor {
        for (const color in ANSI.color.fg.normal) {
            if (code === ANSI.color.fg.normal[color as keyof typeof ANSI.color.fg.normal]) {
                return true;
            }
        }

        for (const color in ANSI.color.fg.bright) {
            if (code === ANSI.color.fg.bright[color as keyof typeof ANSI.color.fg.bright]) {
                return true;
            }
        }

        if (colorRegex.fg.x256.test(code)) {
            return true;
        }

        if (colorRegex.fg.rgb.test(code)) {
            return true;
        }

        return false;
    },

    /**
     * Checks whether a string is a valid ANSI background color code.
     *
     * Supports:
     * - standard named colors
     * - bright named colors
     * - 256-color mode (`48;5;`)
     * - RGB truecolor mode (`48;2;`)
     *
     * @param code - ANSI escape sequence
     * @returns `true` if the code is a valid background color
     */
    bgColor(code: string): code is AnsiBgColor {
        for (const color in ANSI.color.bg.normal) {
            if (code === ANSI.color.bg.normal[color as keyof typeof ANSI.color.bg.normal]) {
                return true;
            }
        }

        for (const color in ANSI.color.bg.bright) {
            if (code === ANSI.color.bg.bright[color as keyof typeof ANSI.color.bg.bright]) {
                return true;
            }
        }

        if (colorRegex.bg.x256.test(code)) {
            return true;
        }

        if (colorRegex.bg.rgb.test(code)) {
            return true;
        }

        return false;
    },

    /**
     * Checks whether a string is any valid ANSI color (foreground or background).
     *
     * @param code - ANSI escape sequence
     * @returns `true` if the code is a valid ANSI color
     */
    color(code: string): code is AnsiColor {
        return this.fgColor(code) || this.bgColor(code);
    },

    /**
     * Checks whether a string is a valid ANSI style code.
     *
     * Examples:
     * - bold
     * - italic
     * - underline
     * - reset
     *
     * @param code - ANSI escape sequence
     * @returns `true` if the code is a valid style
     */
    style(code: string): code is AnsiStyle {
        for (const key in ANSI.style) {
            if (code === ANSI.style[key as keyof typeof ANSI.style]) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Resolves a predefined color name into its ANSI escape sequence.
 *
 * This resolver only understands semantic palette names and does not validate
 * raw ANSI escape sequences.
 *
 * Supported forms:
 *
 * ```text
 * blue
 * cyan
 * bright-blue
 * bright-cyan
 * ```
 *
 * The lookup is performed against either the foreground or background palette,
 * depending on the selected namespace.
 *
 * @param color
 * Semantic color identifier.
 *
 * @param namespace
 * ANSI namespace to resolve against.
 *
 * - `fg` → foreground colors
 * - `bg` → background colors
 *
 * @returns
 * Matching ANSI escape sequence or `null` if the color is unknown.
 *
 * @since 1.0.0
 */
export function resolveColorCode(
    color: string,
    namespace: 'fg' | 'bg'
): AnsiColor | null {
    const isBright = color.startsWith('bright-');
    const name = isBright ? color.slice(7) : color;

    const code = (ANSI.color[namespace][isBright ? 'bright' : 'normal'] as Record<string, AnsiColor>)[name];

    if (code) {
        return code;
    }

    return null;
}

/**
 * Normalizes a user-supplied color value into a valid ANSI color sequence.
 *
 * Unlike {@link resolveColorCode}, this helper accepts either:
 *
 * - predefined color names
 * - raw ANSI color escape sequences
 *
 * Resolution order:
 *
 * 1. Resolve as a predefined palette color.
 * 2. Validate as a raw ANSI color sequence.
 *
 * If neither succeeds, `null` is returned.
 *
 * This function is intended as the primary entry point for public styling APIs.
 *
 * @since 1.0.0
 */
export function resolveAnsiColor(
    color: string,
    namespace: 'fg' | 'bg'
): AnsiColor | null {
    const namedCode = resolveColorCode(color, namespace);
    if (namedCode) {
        return namedCode;
    }

    const code = ansiIs[`${namespace}Color`](color);
    if (code) {
        return color;
    }

    return null;
}

/**
 * Resolves a predefined style name into its ANSI escape sequence.
 *
 * Supported examples include:
 *
 * ```text
 * bold
 * dim
 * italic
 * underline
 * ```
 *
 * This resolver only performs predefined style lookup and does not validate
 * raw ANSI style codes.
 *
 * @param style
 * Semantic style identifier.
 *
 * @returns
 * Matching ANSI style sequence or `null` if the style is unknown.
 *
 * @since 1.0.0
 */
export function resolveStyleCode(style: string): AnsiStyle | null {
    return (ANSI.style as Record<string, AnsiStyle>)[style] ?? null;
}

/**
 * Normalizes a user-supplied style value into a valid ANSI style sequence.
 *
 * Accepted inputs:
 *
 * - predefined style names
 * - raw ANSI style escape sequences
 *
 * Resolution order:
 *
 * 1. Resolve predefined style identifier.
 * 2. Validate raw ANSI style sequence.
 *
 * @param style
 * Style identifier or ANSI sequence.
 *
 * @returns
 * Valid ANSI style sequence or `null`.
 *
 * @since 1.0.0
 */
export function resolveAnsiStyle(style: string): AnsiStyle | null {
    const named = resolveStyleCode(style);

    if (named) {
        return named;
    }

    if (ansiIs.style(style)) {
        return style;
    }

    return null;
}

/**
 * Builds the semantic formatting tag registry used by ConsoleStyler.
 *
 * ---------------------------------------------------------------------
 * 🔷 GENERATED TAGS
 * ---------------------------------------------------------------------
 *
 * The registry includes:
 *
 * - foreground colors
 * - bright foreground colors
 * - background colors
 * - bright background colors
 * - styles
 * - reset tag
 *
 * Every generated tag corresponds to a formatting construct understood by
 * {@link TagsReplacer}.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONSISTENCY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The registry is derived directly from the ANSI definition tables.
 *
 * This ensures:
 *
 * - every generated tag is renderable
 * - no supported ANSI entry is omitted
 * - tag definitions remain synchronized with the ANSI palette
 *
 * @returns
 * Complete semantic tag registry.
 *
 * @since 1.0.0
 */
export function buildTags(): FormatTags {
    const tags = {
        reset: '<:reset>',
        color: {} as Record<string, string>,
        colorBg: {} as Record<string, string>,
        style: {} as Record<string, string>
    }

    // Fill colors
    const definedColors = Object.keys(ANSI.color.fg.normal) as (keyof typeof ANSI.color.fg.normal)[];
    for (const colorName of definedColors) {
        // Foreground
        tags.color[colorName] = `<:color:${colorName}>`;
        tags.color[`bright-${colorName}`] = `<:color:bright-${colorName}>`;

        // Background
        tags.colorBg[colorName] = `<:color-bg:${colorName}>`;
        tags.colorBg[`bright-${colorName}`] = `<:color-bg:bright-${colorName}>`;
    }

    for (const style in ANSI.style) {
        tags.style[style] = `<:style:${style}>`;
    }

    return tags as FormatTags;
}