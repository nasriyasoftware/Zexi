import { ANSI } from "./ansi";
import type { AnsiFgColor, AnsiBgColor, AnsiColor, AnsiStyle, FormatTags } from "./types";

/** Regex fragment representing a valid RGB channel (0–255). */
const rgbChannel = String.raw`(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)`;

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
 * Utility collection for validating ANSI escape sequences.
 *
 * These helpers provide type-guards for:
 *
 * - foreground colors
 * - background colors
 * - combined colors
 * - text styles
 *
 * They support:
 * - named ANSI colors (from ANSI table)
 * - 256-color mode
 * - RGB truecolor mode
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
        for (code in ANSI.style) {
            if (code === ANSI.style[code as keyof typeof ANSI.style]) {
                return true;
            }
        }

        return false;
    }
}

/**
 * List of all defined ANSI color names (foreground normal palette).
 *
 * Useful for:
 * - autocomplete
 * - validation
 * - CLI color pickers
 *
 * @example
 * ["black", "red", "green", ...]
 */
export const definedColors = Object.keys(ANSI.color.fg.normal);

/**
 * Resolves a named color into its ANSI escape code.
 *
 * Supports both:
 * - normal colors (e.g. `"red"`)
 * - bright colors (e.g. `"bright-red"`)
 *
 * @param color - Color name string
 * @param namespace - Whether to resolve foreground or background color
 * @returns ANSI escape code or `null` if not found
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
 * Attempts to resolve an ANSI color from either:
 *
 * - named ANSI palette (preferred)
 * - direct ANSI escape code validation
 *
 * If the input is already a valid ANSI color code, it is returned as-is.
 *
 * @param color - Color name or ANSI escape sequence
 * @param namespace - Foreground or background namespace
 * @returns Valid ANSI color code or `null`
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
 * Builds a complete registry of formatting tags from the ANSI palette.
 *
 * This function dynamically generates all supported:
 *
 * - foreground colors
 * - background colors
 * - bright variants
 * - style tags
 * - reset tag
 *
 * ---------------------------------------------------------------------
 * 🔷 GENERATION MODEL
 * ---------------------------------------------------------------------
 *
 * Tags are derived from the ANSI color/style definitions:
 *
 * ```text
 * ANSI.color.fg.normal
 * ANSI.color.fg.bright
 * ANSI.color.bg.normal
 * ANSI.style
 * ```
 *
 * Each key is mapped into a structured tag string:
 *
 * ```text
 * <:color:red>
 * <:color:bright-red>
 * <:style:bold>
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The returned object is fully frozen by convention (treated as immutable),
 * and is safe for global reuse.
 *
 * @returns Fully populated formatting tag registry
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