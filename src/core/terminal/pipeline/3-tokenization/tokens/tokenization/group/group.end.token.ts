import BaseToken from "../../assets/__base.token__";

/**
 * Marks the end of a logical rendering group.
 *
 * `GroupEndToken` terminates a grouping scope previously opened by
 * `GroupStartToken`.
 *
 * Together, these tokens define a **paired structural boundary**
 * used by renderers to coordinate layout decisions across a token stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `GroupEndToken` closes an active rendering group and signals that
 * all layout decisions for that group scope can be finalized.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * GroupStartToken
 *        ↓
 * Nested semantic tokens
 *        ↓
 * GroupEndToken (matched by group id)
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to:
 *
 * - terminate layout scopes
 * - finalize inline vs block rendering decisions
 * - restore parent rendering state
 * - support nested structural composition
 *
 * ---------------------------------------------------------------------
 * 🔷 GROUP BALANCING MODEL
 * ---------------------------------------------------------------------
 *
 * Each `GroupEndToken` MUST correspond to a specific
 * `GroupStartToken`.
 *
 * Matching is performed via a shared internal identifier:
 *
 * - `GroupStartToken.#_id`
 * - `GroupEndToken.groupId`
 *
 * This enables:
 *
 * - safe nesting of groups
 * - correct pairing in complex streams
 * - deterministic renderer state restoration
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Upon encountering this token, renderers may:
 *
 * - pop active group state
 * - finalize layout decisions
 * - restore parent indentation context
 * - flush buffered structural state
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `GroupEndToken` contributes:
 *
 * - zero printable width
 * - zero visual representation
 *
 * It is purely a structural control token.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class GroupEndToken extends BaseToken<'group-end'> {

    /**
     * Internal identifier of the group being closed.
     *
     * This MUST match the `id` of a corresponding `GroupStartToken`.
     *
     * Used for:
     *
     * - pairing validation
     * - nested scope tracking
     * - structural correctness in rendering
     *
     * @internal
     */
    readonly #_groupId: symbol;

    /**
     * Creates a new logical group end token.
     *
     * @param groupId - The identifier of the matching `GroupStartToken`
     *
     * @since 1.0.0
     */
    constructor(groupId: symbol) {
        super('group-end');
        this.#_groupId = groupId;
    }

    /**
     * Returns the group identifier this token closes.
     *
     * This value corresponds to a `GroupStartToken.id` and is used
     * by renderers to resolve group boundaries.
     *
     * @returns Group identity symbol
     *
     * @since 1.0.0
     */
    get groupId(): symbol {
        return this.#_groupId;
    }
}