import atomix from "@nasriya/atomix";
import { ANSI } from "./ansi";
import type { KnownColorNames, PredefinedStyle } from "./types";

const hasOwnProp = atomix.dataTypes.record.hasOwnProperty;

/**
 * TagsReplacer
 * ------------
 *
 * A deterministic, stateless transformer that converts semantic
 * console markup tags into ANSI escape sequences.
 *
 * This utility is used as the final formatting layer in the console
 * styling pipeline, translating human-readable inline tags into
 * terminal-safe ANSI codes.
 *
 * Example transformations:
 *
 *    <:color:red>        → ANSI red foreground
 *    <:style:bold>       → ANSI bold sequence
 *    <:reset>            → ANSI reset sequence
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Declarative Tag System**
 *    - Each tag type is defined as a matcher rule
 *    - No runtime parsing logic outside matcher dispatch
 *    - Easy extension by adding new matcher entries
 *
 * 2. **Deterministic Replacement Pipeline**
 *    - Matchers execute in a fixed order
 *    - Output is fully deterministic across environments
 *
 * 3. **Strict vs Non-Strict Mode**
 *    - strict = true
 *        → invalid tags are removed
 *
 *    - strict = false
 *        → invalid tags are preserved as-is
 *
 * 4. **Zero External State**
 *    - No mutation of input string outside replace pipeline
 *    - No global or instance state dependencies
 *    - Fully stateless and concurrency-safe
 *
 * 5. **Regex-Based Token Emulation**
 *    - Tags are parsed using regular expressions
 *    - Each matcher operates independently on the input string
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL MATCHER MODEL
 * ---------------------------------------------------------------------
 *
 * Each matcher entry may define either:
 *
 * 1. **Static replacement**
 *    - Direct string substitution (e.g. reset ANSI code)
 *
 * 2. **Dynamic resolution**
 *    - Function-based mapping of tag → ANSI code
 *    - Supports fallback logic when unknown values are encountered
 *
 * ---------------------------------------------------------------------
 * 🔷 MATCHER SEMANTICS
 * ---------------------------------------------------------------------
 *
 * - color
 *   Resolves standard foreground ANSI colors
 *
 * - color-bright
 *   Resolves bright foreground ANSI colors
 *
 * - color-bg
 *   Resolves standard background ANSI colors
 *
 * - color-bg-bright
 *   Resolves bright background ANSI colors
 *
 * - style
 *   Resolves text styling codes (bold, italic, underline, etc.)
 *
 * - reset
 *   Hard resets all ANSI styling
 *
 * ---------------------------------------------------------------------
 * 🔷 FALLBACK BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * If a tag value is not recognized:
 *
 * - strict = false
 *   → tag is preserved in original form
 *
 * - strict = true
 *   → tag is removed entirely from output
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION PIPELINE
 * ---------------------------------------------------------------------
 *
 * Input string is processed sequentially through all matchers:
 *
 * 1. reset
 * 2. color
 * 3. color-bright
 * 4. color-bg
 * 5. color-bg-bright
 * 6. style
 *
 * Each matcher performs a global regex replacement on the evolving string.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class TagsReplacer {
    /**
     * Ordered set of transformation rules used to convert
     * semantic tags into ANSI escape sequences.
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURE
     * ---------------------------------------------------------------------
     *
     * Each entry is either:
     *
     * 1. Static replacement rule:
     *    - name
     *    - regex
     *    - value
     *
     * 2. Dynamic matcher rule:
     *    - name
     *    - regex
     *    - matcher(value, strict)
     *
     * ---------------------------------------------------------------------
     * 🔷 ORDER GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Matchers are executed in declaration order.
     * Earlier matchers may consume or transform input that affects
     * later matchers.
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY NOTE
     * ---------------------------------------------------------------------
     *
     * This array is static and immutable. It is shared across all
     * invocations of `replace`.
     *
     * @internal
     * @since 1.0.0
     */
    static readonly #_matchers = [
        {
            /**
             * Foreground color resolver.
             *
             * Maps <:color:X> to ANSI foreground color codes.
             * Falls back to preserved or removed tag depending on strict mode.
             */
            name: 'color',
            regex: /<:color:([\w-]+)>/g,
            matcher: (c: string, strict: boolean) => {
                return hasOwnProp(ANSI.color.fg.normal, c)
                    ? ANSI.color.fg.normal[c as KnownColorNames]
                    : (strict ? '' : `<:color:${c}>`);
            }
        },
        {
            /**
             * Bright foreground color resolver.
             *
             * Maps <:color:bright-X> to bright ANSI foreground colors.
             */
            name: 'color-bright',
            regex: /<:color:bright-([\w-]+)>/g,
            matcher: (c: string, strict: boolean) => {
                return hasOwnProp(ANSI.color.fg.bright, c)
                    ? ANSI.color.fg.bright[c as KnownColorNames]
                    : (strict ? '' : `<:color:bright-${c}>`);
            }
        },
        {
            /**
             * Background color resolver.
             *
             * Maps <:color-bg:X> to ANSI background colors.
             */
            name: 'color-bg',
            regex: /<:color-bg:([\w-]+)>/g,
            matcher: (c: string, strict: boolean) => {
                return hasOwnProp(ANSI.color.bg.normal, c)
                    ? ANSI.color.bg.normal[c as KnownColorNames]
                    : (strict ? '' : `<:color-bg:${c}>`);
            }
        },
        {
            /**
             * Bright background color resolver.
             *
             * Maps <:color-bg:bright-X> to bright ANSI background colors.
             */
            name: 'color-bg-bright',
            regex: /<:color-bg:bright-([\w-]+)>/g,
            matcher: (c: string, strict: boolean) => {
                return hasOwnProp(ANSI.color.bg.bright, c)
                    ? ANSI.color.bg.bright[c as KnownColorNames]
                    : (strict ? '' : `<:color-bg:bright-${c}>`);
            }
        },
        {
            /**
             * Text style resolver.
             *
             * Maps <:style:X> to ANSI text style codes
             * such as bold, italic, underline, etc.
             */
            name: 'style',
            regex: /<:style:([\w-]+)>/g,
            matcher: (s: string, strict: boolean) => {
                return hasOwnProp(ANSI.style, s)
                    ? ANSI.style[s as PredefinedStyle]
                    : (strict ? '' : `<:style:${s}>`);
            }
        },
        {
            /**
             * ANSI reset sequence.
             *
             * Removes all active ANSI styling.
             * This matcher is a direct substitution rule.
             */
            name: 'reset',
            regex: /<:reset>/g,
            value: ANSI.reset
        }
    ] as const;

    /**
     * Executes the tag replacement pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * 1. Iterate through ordered matcher rules
     * 2. Apply regex replacement for each rule
     * 3. Resolve matches using either:
     *    - static value replacement
     *    - dynamic matcher function
     * 4. Return fully transformed string
     *
     * ---------------------------------------------------------------------
     * 🔷 PERFORMANCE NOTE
     * ---------------------------------------------------------------------
     *
     * Each matcher performs a full pass over the string.
     * Complexity is O(n × m), where:
     *   n = number of matchers
     *   m = string size
     *
     * Suitable for CLI rendering and logging pipelines.
     *
     * @param str
     * Input string containing semantic formatting tags.
     *
     * @param strict
     * If true, invalid tags are removed instead of preserved.
     *
     * @returns
     * ANSI-formatted string ready for terminal output.
     *
     * @since 1.0.0
     */
    static replace(str: string, strict: boolean = false): string {
        for (const r of this.#_matchers) {
            if ('value' in r) {
                str = str.replace(r.regex, r.value);
                continue;
            }

            str = str.replace(
                r.regex,
                (_, v) => r.matcher(v, strict)
            );
        }

        return str;
    }
}

export default TagsReplacer;