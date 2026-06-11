import BaseToken from "../assets/__base.token__";

/**
 * Conditional wrapping opportunity token used during rendering layout.
 *
 * `SoftWrapToken` represents a non-semantic wrapping boundary where
 * a renderer MAY insert a line break if required by layout constraints
 * such as maximum width overflow.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `SoftWrapToken` belongs to the rendering/layout layer and is used
 * to expose safe wrapping opportunities without enforcing line breaks.
 *
 * Unlike `HardLineToken`, this token does NOT require a newline.
 *
 * Unlike `SoftLineToken`, this token does NOT represent semantic
 * structural separation.
 *
 * Instead, it represents:
 *
 * ```text
 * optional overflow-driven wrapping
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to allow renderers to:
 *
 * - preserve inline layouts when possible
 * - avoid hard overflow
 * - wrap long content gracefully
 * - maintain compact rendering behavior
 *
 * without introducing semantic formatting changes.
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMON USAGE SCENARIOS
 * ---------------------------------------------------------------------
 *
 * Typical usage includes:
 *
 * - long inline strings
 * - URLs
 * - deeply nested inline structures
 * - long function signatures
 * - compact layouts with overflow protection
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * When encountered during rendering:
 *
 * - the renderer MAY keep the content inline
 * - the renderer MAY insert a newline
 * - the decision depends on width constraints
 *
 * Example:
 *
 * ```text
 * Inline mode:
 * foo bar baz
 *
 * Wrapped mode:
 * foo
 * bar baz
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 SOFT WRAP VS SOFT LINE
 * ---------------------------------------------------------------------
 *
 * `SoftWrapToken`
 * - overflow-driven
 * - layout-oriented
 * - non-semantic
 * - optional emergency wrapping
 *
 * `SoftLineToken`
 * - semantic structural separation
 * - renderer may collapse or expand
 * - represents logical formatting intent
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKENIZATION RULE
 * ---------------------------------------------------------------------
 *
 * `SoftWrapToken` is generally introduced during rendering/layout
 * processing rather than semantic tokenization.
 *
 * This is because wrapping decisions depend on:
 *
 * - renderer width
 * - output mode
 * - terminal constraints
 * - layout strategy
 *
 * which are unavailable during tokenization.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `SoftWrapToken` contributes:
 *
 * - zero printable width
 * - one optional wrap opportunity
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class SoftWrapToken extends BaseToken<'soft-wrap'> {
    /**
     * Creates a new conditional wrapping token.
     *
     * @since 1.0.0
     */
    constructor() {
        super('soft-wrap');
    }
}