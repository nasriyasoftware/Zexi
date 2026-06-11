/**
 * ANSI escape code registry for terminal styling.
 *
 * This module is the foundational ANSI layer for the entire styling system.
 * Every higher-level abstraction (styler, renderer, tag system, console UI)
 * ultimately resolves down to these raw escape sequences.
 *
 * It provides:
 *
 * - reset control
 * - 16-color foreground palette (normal + bright)
 * - 16-color background palette (normal + bright)
 * - text styles (bold, italic, underline, etc.)
 * - 256-color helpers
 * - truecolor (RGB) helpers
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * `ANSI` is the lowest-level primitive in the rendering stack:
 *
 * ```text
 * ConsoleStyler / ScreenEngine / Renderers
 *              ↓
 *            ANSI
 *              ↓
 *     Terminal Escape Sequences
 *              ↓
 *        Terminal Emulator
 * ```
 *
 * It contains NO formatting logic, NO parsing, and NO rendering behavior.
 * It is purely a static lookup + helper generator.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN MODEL
 * ---------------------------------------------------------------------
 *
 * All ANSI values are represented as immutable strings:
 *
 * ```ts
 * "\x1b[31m" // red foreground
 * "\x1b[0m"  // reset
 * ```
 *
 * These values are safe to concatenate and emit directly to stdout.
 *
 * ---------------------------------------------------------------------
 * 🔷 COLOR SYSTEM
 * ---------------------------------------------------------------------
 *
 * The ANSI color system is split into:
 *
 * ## Foreground colors
 *
 * ```text
 * ANSI.color.fg.normal.black   → standard palette
 * ANSI.color.fg.bright.red     → high-intensity palette
 * ```
 *
 * ## Background colors
 *
 * ```text
 * ANSI.color.bg.normal.blue
 * ANSI.color.bg.bright.yellow
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 STYLE SYSTEM
 * ---------------------------------------------------------------------
 *
 * Styles are independent modifiers applied alongside colors:
 *
 * ```text
 * ANSI.style.bold
 * ANSI.style.underline
 * ANSI.style.inverse
 * ```
 *
 * These are reset using `ANSI.reset`.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXTENDED COLOR SUPPORT
 * ---------------------------------------------------------------------
 *
 * ANSI also supports extended color modes:
 *
 * ## 256-color mode
 *
 * ```ts
 * fg256(n) → \x1b[38;5;{n}m
 * bg256(n) → \x1b[48;5;{n}m
 * ```
 *
 * Range: 0–255
 *
 * ## Truecolor (RGB)
 *
 * ```ts
 * fgRGB(r, g, b) → \x1b[38;2;r;g;bm
 * bgRGB(r, g, b) → \x1b[48;2;r;g;bm
 * ```
 *
 * Range: 0–255 per channel
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE PATTERN
 * ---------------------------------------------------------------------
 *
 * Typical usage involves concatenation:
 *
 * ```ts
 * ANSI.style.bold +
 * ANSI.color.fg.red +
 * "Error" +
 * ANSI.reset
 * ```
 *
 * Higher-level systems wrap these into safer abstractions.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The entire object is marked `as const`, ensuring:
 *
 * - no runtime mutation
 * - literal type inference
 * - stable references across the system
 *
 * This is critical for consistent renderer behavior.
 *
 * @since 1.0.0
 */
export const ANSI = {
    /**
     * Resets all terminal formatting (color + style).
     *
     * This should always be appended after styled output to avoid
     * leaking formatting into subsequent terminal text.
     *
     * @since 1.0.0
     */
    reset: "\x1b[0m",

    /**
     * ANSI color palette (foreground and background).
     *
     * Contains both normal and bright variants for 16-color terminals.
     *
     * @since 1.0.0
     */
    color: {
        /**
         * Foreground color codes.
         *
         * Applied to text content.
         *
         * @since 1.0.0
         */
        fg: {
            /**
             * Standard 8-color foreground palette.
             * @since 1.0.0
             */
            normal: {
                black: "\x1b[30m",
                red: "\x1b[31m",
                green: "\x1b[32m",
                yellow: "\x1b[33m",
                blue: "\x1b[34m",
                magenta: "\x1b[35m",
                cyan: "\x1b[36m",
                white: "\x1b[37m"
            },

            /**
             * Bright foreground color palette.
             *
             * Higher intensity variants of the standard colors.
             *
             * @since 1.0.0
             */
            bright: {
                black: "\x1b[90m",
                red: "\x1b[91m",
                green: "\x1b[92m",
                yellow: "\x1b[93m",
                blue: "\x1b[94m",
                magenta: "\x1b[95m",
                cyan: "\x1b[96m",
                white: "\x1b[97m"
            }
        },

        /**
         * Background color codes.
         *
         * Applied behind text content.
         *
         * @since 1.0.0
         */
        bg: {
            /**
             * Standard 8-color background palette.
             * @since 1.0.0
             */
            normal: {
                black: "\x1b[40m",
                red: "\x1b[41m",
                green: "\x1b[42m",
                yellow: "\x1b[43m",
                blue: "\x1b[44m",
                magenta: "\x1b[45m",
                cyan: "\x1b[46m",
                white: "\x1b[47m"
            },

            /**
             * Bright background color palette.
             *
             * Higher intensity background variants.
             *
             * @since 1.0.0
             */
            bright: {
                black: "\x1b[100m",
                red: "\x1b[101m",
                green: "\x1b[102m",
                yellow: "\x1b[103m",
                blue: "\x1b[104m",
                magenta: "\x1b[105m",
                cyan: "\x1b[106m",
                white: "\x1b[107m"
            }
        }
    },

    /**
     * Text styling escape codes.
     *
     * These modify visual presentation of text independent of color.
     *
     * @since 1.0.0
     */
    style: {
        bold: "\x1b[1m",
        dim: "\x1b[2m",
        italic: "\x1b[3m",
        underline: "\x1b[4m",
        inverse: "\x1b[7m",
        strikethrough: "\x1b[9m"
    },

    /**
     * Generates a 256-color foreground ANSI escape sequence.
     *
     * @param n - Color index (0–255)
     * @returns ANSI foreground color code
     *
     * @since 1.0.0
     */
    fg256: (n: number) => `\x1b[38;5;${n}m`,

    /**
     * Generates a 256-color background ANSI escape sequence.
     *
     * @param n - Color index (0–255)
     * @returns ANSI background color code
     *
     * @since 1.0.0
     */
    bg256: (n: number) => `\x1b[48;5;${n}m`,

    /**
     * Generates a truecolor (RGB) foreground ANSI escape sequence.
     *
     * @param r - Red channel (0–255)
     * @param g - Green channel (0–255)
     * @param b - Blue channel (0–255)
     * @returns ANSI RGB foreground color code
     *
     * @since 1.0.0
     */
    fgRGB: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,

    /**
     * Generates a truecolor (RGB) background ANSI escape sequence.
     *
     * @param r - Red channel (0–255)
     * @param g - Green channel (0–255)
     * @param b - Blue channel (0–255)
     * @returns ANSI RGB background color code
     *
     * @since 1.0.0
     */
    bgRGB: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`
} as const;