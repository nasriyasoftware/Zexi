import BaseToken from "../../assets/__base.token__";

/**
 * Semantic token representing a hard (non-collapsible) space in the output stream.
 *
 * `HardSpaceToken` enforces a guaranteed visible spacing unit between tokens,
 * regardless of layout mode, wrapping strategy, or rendering constraints.
 *
 * Unlike `SoftSpaceToken`, this token MUST NOT be collapsed or removed
 * by renderers.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `HardSpaceToken` belongs to the semantic tokenization layer and
 * represents explicit spacing that must be preserved during rendering.
 *
 * It is typically used in contexts where spacing carries syntactic or
 * structural meaning rather than being purely aesthetic.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - enforce visible spacing between semantic units
 * - prevent collapsing in compact rendering modes
 * - ensure structural clarity in key-value or expression contexts
 * - preserve readability in tightly packed structures
 *
 * ---------------------------------------------------------------------
 * 🔷 SOFT VS HARD SPACING
 * ---------------------------------------------------------------------
 *
 * Hard space behavior differs from `SoftSpaceToken`:
 *
 * - Hard space → always rendered
 * - Soft space → renderer may collapse or convert
 *
 * This distinction allows fine-grained control over layout stability.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers MUST:
 *
 * - preserve the space during serialization
 * - treat it as a mandatory layout character
 *
 * Renderers MUST NOT:
 *
 * - collapse it in compact mode
 * - replace it with line breaks
 * - remove it during optimization passes
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `HardSpaceToken` contributes:
 *
 * - exactly one visible whitespace unit in most renderers
 * - fixed layout spacing independent of wrapping rules
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class HardSpaceToken extends BaseToken<'hard-space'> {
    /**
     * Creates a new hard space token.
     *
     * @since 1.0.0
     */
    constructor() { super('hard-space'); }
}