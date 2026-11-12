/**
 * Immutable dimensions of the terminal viewport.
 *
 * Represents the terminal's width and height in character cells, as reported
 * by terminal-size detection.
 *
 * @property width - Number of character columns in the terminal viewport.
 * @property height - Number of character rows in the terminal viewport.
 *
 * @since 1.0.0
 */
export type TerminalSize = Readonly<{
    width: number;
    height: number;
}>;

/**
 * Immutable terminal cursor-position data.
 *
 * Represents the row and column reported by the terminal in response to an
 * ANSI cursor-position query.
 *
 * Both coordinates follow the ANSI terminal convention:
 *
 * - `row` is one-based
 * - `column` is one-based
 *
 * The value is immutable so that a captured terminal position cannot be
 * modified after it has been established.
 *
 * @since 1.0.0
 */
export type CursorPosition = Readonly<{
    /**
     * One-based terminal row reported by the cursor-position query.
     *
     * @since 1.0.0
     */
    row: number;

    /**
     * One-based terminal column reported by the cursor-position query.
     *
     * @since 1.0.0
     */
    column: number;
}>;