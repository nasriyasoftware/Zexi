import { ANSI } from "./ansi";

export type KnownColorNames = keyof typeof ANSI.color.fg.normal
export type PredefinedColor = KnownColorNames | `bright-${KnownColorNames}`;
export type PredefinedStyle = keyof typeof ANSI.style;

export type AnsiBaseForegroundColor =
    | typeof ANSI.color.fg.normal[keyof typeof ANSI.color.fg.normal]
    | typeof ANSI.color.fg.bright[keyof typeof ANSI.color.fg.bright];

export type AnsiBaseBackgroundColor =
    | typeof ANSI.color.bg.normal[keyof typeof ANSI.color.bg.normal]
    | typeof ANSI.color.bg.bright[keyof typeof ANSI.color.bg.bright];

export type AnsiBaseColor = AnsiBaseForegroundColor | AnsiBaseBackgroundColor;

export type Ansi256ForegroundColor = `\x1b[38;5;${number}m`;
export type Ansi256BackgroundColor = `\x1b[48;5;${number}m`;
export type Ansi256Color = Ansi256ForegroundColor | Ansi256BackgroundColor;

export type AnsiRGBForegroundColor = `\x1b[38;2;${number};${number};${number}m`;
export type AnsiRGBBackgroundColor = `\x1b[48;2;${number};${number};${number}m`;
export type AnsiRGBColor = AnsiRGBForegroundColor | AnsiRGBBackgroundColor;

export type AnsiFgColor = AnsiBaseForegroundColor | Ansi256ForegroundColor | AnsiRGBForegroundColor;
export type AnsiBgColor = AnsiBaseBackgroundColor | Ansi256BackgroundColor | AnsiRGBBackgroundColor;

export type AnsiStyle = typeof ANSI.style[keyof typeof ANSI.style];
export type AnsiColor =
    | Ansi256ForegroundColor
    | Ansi256BackgroundColor
    | AnsiRGBForegroundColor
    | AnsiRGBBackgroundColor
    | AnsiBaseColor;

export type AnsiCode =
    | AnsiColor
    | typeof ANSI.style[keyof typeof ANSI.style]
    | typeof ANSI.reset;

export type ANSIKind = 'color' | 'style' | 'reset';

export type ColorTag = `<:color:${PredefinedColor}>` | `<:color-bg:${PredefinedColor}>`;
export type StyleTag = `<:style:${PredefinedStyle}>`;
export type FormatTag = ColorTag | StyleTag | '<:reset>';

export type FormatTags = {
    reset: '<:reset>';
    color: {
        [K in PredefinedColor]: `<:color:${K}>`;
    },
    colorBg: {
        [K in PredefinedColor]: `<:color-bg:${K}>`;
    },
    style: {
        [K in PredefinedStyle]: `<:style:${K}>`;
    }
}