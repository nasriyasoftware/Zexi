import type { StackTraceLine } from "../types";

/**
 * Regular expression used to parse standard V8-style stack trace lines.
 *
 * It extracts:
 * - optional function name
 * - file path
 * - line number
 * - column number
 *
 * Expected format:
 * ```
 * at functionName (file:line:column)
 * at file:line:column
 * ```
 *
 * ---------------------------------------------------------------------
 * ⚠️ LIMITATION
 * ---------------------------------------------------------------------
 *
 * This regex is tailored for V8 stack traces and may not fully
 * support non-V8 runtimes without modification.
 *
 * @since 1.0.0
 */
const STACK_LINE_REGEX = /^\s*at\s+(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?$/;

/**
 * Parses a single raw stack trace line into a structured `StackTraceLine`.
 *
 * This function performs normalization of different stack trace formats:
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED FORMATS
 * ---------------------------------------------------------------------
 *
 * 1. Native calls
 *    - Detected via `(native)`
 *
 * 2. Eval calls
 *    - Detected via `eval` keyword presence
 *
 * 3. Standard file stack frames
 *    - Parsed using `STACK_LINE_REGEX`
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - Returns `null` if the line does not match known formats
 * - Normalizes numeric values into `number` types
 * - Extracts optional function names when available
 *
 * ---------------------------------------------------------------------
 * @param line - A raw stack trace line string
 * @returns A normalized `StackTraceLine` object or `null` if unrecognized
 *
 * @since 1.0.0
 */
function parseStackTraceLine(line: string): StackTraceLine | null {
    line = line.trim();

    // native
    if (line.includes('(native)')) {
        return {
            source: 'native',
            line: 0,
            column: 0,
            type: 'native'
        };
    }

    // eval
    if (line.includes('eval')) {
        return {
            source: line,
            line: 0,
            column: 0,
            type: 'eval'
        };
    }

    const match = line.match(STACK_LINE_REGEX);
    if (!match) return null;

    const [, functionName, source, lineNum, columnNum] = match;

    return {
        source,
        line: Number(lineNum),
        column: Number(columnNum),
        type: 'file',
        functionName: functionName || undefined
    };
}

/**
 * Builds a normalized stack trace representation from a raw stack string.
 *
 * This function filters, parses, and sanitizes JavaScript stack traces
 * into structured `StackTraceLine` objects suitable for rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * - Splits stack trace into individual lines
 * - Filters out internal framework frames
 * - Removes non-stack lines
 * - Parses each frame using `parseStackTraceLine`
 * - Produces a structured array of stack frames
 *
 * ---------------------------------------------------------------------
 * 🔷 FILTERING RULES
 * ---------------------------------------------------------------------
 *
 * The following frames are excluded:
 *
 * - lines not starting with `at`
 * - internal framework calls (e.g. `@nasriya/zexi`)
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT GUARANTEE
 * ---------------------------------------------------------------------
 *
 * - Always returns a valid array
 * - Never throws on malformed input
 * - Invalid frames are silently dropped
 *
 * ---------------------------------------------------------------------
 * @param stack - Raw stack trace string from an Error object (optional)
 * @returns Array of structured stack trace frames
 *
 * @since 1.0.0
 */
function buildStack(stack?: string): StackTraceLine[] {
    const INTERNAL_PATTERNS = ['@nasriya/zexi'];

    return (stack?.split('\n') ?? [])
        .map(l => l.trim())
        .filter(line => {
            return (
                line.startsWith('at') &&
                !INTERNAL_PATTERNS.some(p => line.includes(p))
            );
        })
        .map(parseStackTraceLine)
        .filter((v): v is StackTraceLine => v !== null);
}

export default buildStack;