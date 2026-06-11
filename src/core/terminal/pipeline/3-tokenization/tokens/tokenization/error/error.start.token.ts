import BaseToken from "../../assets/__base.token__";

/**
 * Marks the beginning of an error semantic scope.
 *
 * `ErrorStartToken` defines the opening boundary of a structured error
 * region within the semantic token stream.
 *
 * This token is used together with:
 *
 * - `ErrorDataToken`
 * - `ErrorCauseStartToken`
 * - `StackTraceToken`
 * - `ErrorEndToken`
 *
 * to represent errors as fully structured semantic scopes instead of
 * opaque payload tokens.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `ErrorStartToken` belongs to the semantic tokenization layer and marks
 * the start of a renderer-visible error structure.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * Error RepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * ErrorStartToken
 *        ↓
 * Error semantic content
 *        ↓
 * ErrorEndToken
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to:
 *
 * - define explicit error boundaries
 * - support structured renderer traversal
 * - allow nested error causes
 * - preserve flat token stream semantics
 * - eliminate recursive token payload embedding
 *
 * Errors are represented structurally rather than as a single opaque
 * token payload.
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR SCOPING MODEL
 * ---------------------------------------------------------------------
 *
 * Every error scope is assigned a unique internal symbol identifier.
 *
 * This identifier allows:
 *
 * - matching `ErrorStartToken` ↔ `ErrorEndToken`
 * - scope-aware renderer traversal
 * - nested error scope tracking
 * - structural balancing validation
 *
 * Each created token instance owns a unique symbol.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers may use this token to:
 *
 * - enter error rendering mode
 * - apply diagnostic styling
 * - initialize error layout state
 * - coordinate multiline formatting
 *
 * The token itself contributes no visual output.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `ErrorStartToken` contributes:
 *
 * - zero printable width
 * - zero visible content
 *
 * It exists purely for semantic scope orchestration.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Every `ErrorStartToken` should eventually be paired with a matching:
 *
 * - `ErrorEndToken`
 *
 * using the same internal scope identifier.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ErrorStartToken extends BaseToken<'error-start'> {
    /**
     * Unique internal identifier for this error scope.
     *
     * Used to associate:
     *
     * - `ErrorStartToken`
     * - `ErrorEndToken`
     *
     * during renderer traversal and structural scope tracking.
     *
     * Each token instance owns a unique symbol identifier.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol = Symbol('error');

    /**
     * Creates a new error scope start token.
     *
     * @since 1.0.0
     */
    constructor() {
        super('error-start');
    }

    /**
     * Returns the unique identifier of this error scope.
     *
     * This identifier is used for structural scope matching between:
     *
     * - `ErrorStartToken`
     * - `ErrorEndToken`
     *
     * @returns Unique error scope identifier
     *
     * @since 1.0.0
     */
    get id(): symbol {
        return this.#_id;
    }
}