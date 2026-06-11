import BaseToken from "../../../assets/__base.token__";
import type { ErrorStartToken } from "../error.start.token";

/**
 * Marks the beginning of an error cause scope.
 *
 * `ErrorCauseStartToken` defines the start boundary of a nested "cause"
 * chain inside an error structure.
 *
 * It is used when an error contains an underlying root cause (via
 * `cause` in JavaScript Error objects), allowing the renderer to
 * represent causal chains as structured, hierarchical token streams.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and is emitted
 * only when an error contains a nested cause value.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * ErrorDataToken
 *      ↓
 * ErrorCauseStartToken   ← THIS TOKEN
 *      ↓
 * Cause tokens (recursive structure)
 *      ↓
 * ErrorCauseEndToken
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to:
 *
 * - isolate error cause subtrees
 * - enable recursive error inspection
 * - preserve structured causal relationships
 * - support nested error diagnostics
 * - bind cause scopes to a parent error scope
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE OWNERSHIP MODEL
 * ---------------------------------------------------------------------
 *
 * Each `ErrorCauseStartToken` is explicitly bound to an
 * `ErrorStartToken`.
 *
 * This ensures:
 *
 * - cause scopes cannot exist outside a valid error scope
 * - nested diagnostics remain tied to their originating error
 * - renderer can safely associate cause chains with error identity
 *
 * The error identity is derived from the provided `ErrorStartToken`,
 * not passed manually as a raw symbol.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Each instance carries:
 *
 * - a unique cause scope identifier (`id`)
 * - a parent error scope identifier (`errorId`)
 *
 * The cause `id` is used to match:
 *
 * - ErrorCauseStartToken ↔ ErrorCauseEndToken
 *
 * The errorId is used to match:
 *
 * - entire cause subtree ↔ originating ErrorStartToken
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers use this token to:
 *
 * - enter "cause rendering mode"
 * - apply nested indentation rules
 * - group cause-related tokens
 * - associate downstream tokens with the correct error scope
 *
 * The token itself produces no output.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * This token has no visual representation and contributes:
 *
 * - zero width
 * - zero printable output
 *
 * It exists purely for structural grouping.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ErrorCauseStartToken extends BaseToken<'error-cause-start'> {
    /**
     * Unique identifier for this error cause scope.
     *
     * This symbol is used internally to match with the corresponding
     * `ErrorCauseEndToken`.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol = Symbol('error-cause');

    /**
     * Identifier of the parent error scope.
     *
     * This value is derived from the provided `ErrorStartToken`
     * and ensures this cause scope is tied to a valid error.
     *
     * @since 1.0.0
     */
    readonly #_errorId: symbol;

    /**
     * Creates a new error cause start token.
     *
     * @param errorToken
     * The originating error scope token that owns this cause chain.
     *
     * @since 1.0.0
     */
    constructor(errorToken: ErrorStartToken) {
        super('error-cause-start');
        this.#_errorId = errorToken.id;
    }

    /**
     * Returns the unique identifier for this error cause scope.
     *
     * This value is used internally to correlate start/end tokens
     * within the same causal chain.
     *
     * @returns Error cause scope identifier
     *
     * @since 1.0.0
     */
    get id(): symbol {
        return this.#_id;
    }

    /**
     * Returns the parent error scope identifier.
     *
     * This always matches the originating `ErrorStartToken` id.
     *
     * @returns Error scope identifier
     *
     * @since 1.0.0
     */
    get errorId(): symbol {
        return this.#_errorId;
    }
}