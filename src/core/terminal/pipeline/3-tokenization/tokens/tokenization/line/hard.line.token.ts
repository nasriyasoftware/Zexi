import BaseToken from "../../assets/__base.token__";

/**
 * Non-collapsible line break token used during the rendering phase.
 *
 * `HardLineToken` represents a mandatory line break that MUST always
 * produce a newline during rendering regardless of:
 *
 * - layout mode
 * - width constraints
 * - compact rendering
 * - grouping behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `HardLineToken` belongs to the rendering layer and represents
 * a renderer-enforced structural break in the output stream.
 *
 * Unlike soft layout tokens such as `SoftLineToken`,
 * hard lines are NOT conditional.
 *
 * They always terminate the current rendered line.
 *
 * ---------------------------------------------------------------------
 * 🔷 HARD VS SOFT LINE BREAKS
 * ---------------------------------------------------------------------
 *
 * `HardLineToken`
 * - always becomes a newline
 * - cannot collapse into whitespace
 * - ignores compact layout decisions
 *
 * `SoftLineToken`
 * - may become whitespace
 * - may become a newline
 * - depends on renderer layout policy
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMON USAGE SCENARIOS
 * ---------------------------------------------------------------------
 *
 * Typical uses include:
 *
 * - stack trace rendering
 * - forced multiline error formatting
 * - multiline string preservation
 * - table row separation
 * - renderer-controlled expanded layouts
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * When encountered during rendering:
 *
 * - the current line is terminated
 * - indentation state may be reapplied
 * - width tracking resets for the next line
 *
 * Renderers should treat this token as:
 *
 * ```text
 * unconditional line termination
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKENIZATION RULE
 * ---------------------------------------------------------------------
 *
 * `HardLineToken` is generally NOT emitted during semantic tokenization.
 *
 * It is typically introduced during rendering when a renderer decides
 * that a structure must be expanded into a multiline representation.
 *
 * This preserves separation between:
 *
 * - semantic structure
 * - presentation/layout policy
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `HardLineToken` contributes:
 *
 * - zero printable width
 * - one structural line termination event
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class HardLineToken extends BaseToken<'hard-line'> {
    /**
     * Creates a new unconditional line break token.
     *
     * @since 1.0.0
     */
    constructor() {
        super('hard-line');
    }
}