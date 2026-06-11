import BaseToken from "../../assets/__base.token__";

/**
 * Semantic token representing a soft (collapsible) space in the output stream.
 *
 * `SoftSpaceToken` defines a spacing hint that may be rendered as:
 *
 * - a normal space `" "`
 * - no space (collapsed)
 * - or expanded into a line break depending on layout constraints
 *
 * It does NOT guarantee a visible space; instead it expresses a
 * *flexible spacing opportunity* for the renderer.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `SoftSpaceToken` belongs to the semantic tokenization layer and
 * represents optional spacing between tokens.
 *
 * Unlike `HardSpaceToken`, which enforces a fixed visible space,
 * soft spacing is fully renderer-dependent.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - mark optional spacing between semantic units
 * - enable compact vs pretty formatting modes
 * - allow width-aware layout decisions
 * - support line wrapping strategies
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for deciding how to interpret this token:
 *
 * - render as a single space in inline mode
 * - ignore in compact mode
 * - convert into line breaks when width constraints require it
 * - preserve or collapse spacing in structured layouts
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `SoftSpaceToken` contributes:
 *
 * - zero guaranteed width
 * - optional whitespace behavior controlled by renderer
 *
 * It is a layout hint rather than a strict character.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class SoftSpaceToken extends BaseToken<'soft-space'> {
    /**
     * Creates a new soft space token.
     *
     * @since 1.0.0
     */
    constructor() { super('soft-space'); }
}