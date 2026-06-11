import BaseToken from "../../assets/__base.token__";

/**
 * Semantic token representing a soft line break opportunity in the output stream.
 *
 * `SoftLineToken` defines a conditional line break that may be rendered as:
 *
 * - a newline (`\n`)
 * - a space
 * - or completely collapsed
 *
 * depending on layout constraints, width limits, and rendering mode.
 *
 * It does NOT guarantee a visible line break; instead it marks a
 * *flexible breaking opportunity* for the renderer.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `SoftLineToken` belongs to the semantic tokenization layer and
 * represents optional line-breaking behavior between semantic units.
 *
 * It is primarily used to support:
 *
 * - pretty printing
 * - width-aware wrapping
 * - compact vs expanded layout modes
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - indicate safe breakpoints in structured output
 * - allow renderer-controlled wrapping
 * - improve readability in constrained widths
 * - enable adaptive formatting strategies
 *
 * ---------------------------------------------------------------------
 * 🔷 SOFT VS HARD BREAKS
 * ---------------------------------------------------------------------
 *
 * Soft line behavior differs from hard line tokens:
 *
 * - Soft line → renderer may ignore or convert to newline
 * - Hard line → must always be rendered as a newline
 *
 * This distinction allows controlled formatting flexibility.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for deciding:
 *
 * - whether to break the line at this token
 * - whether to replace it with spacing
 * - whether to collapse it entirely in compact mode
 * - how it interacts with indentation and grouping
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `SoftLineToken` contributes:
 *
 * - zero guaranteed width
 * - optional newline behavior controlled by renderer
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class SoftLineToken extends BaseToken<'soft-line'> {
    /**
     * Creates a new soft line break token.
     *
     * @since 1.0.0
     */
    constructor() { super('soft-line'); }
}