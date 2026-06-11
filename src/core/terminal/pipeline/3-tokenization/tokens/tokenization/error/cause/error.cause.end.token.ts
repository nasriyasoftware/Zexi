import BaseToken from "../../../assets/__base.token__";
import type { ErrorStartToken } from "../error.start.token";
import type { ErrorCauseStartToken } from "./error.cause.start.token";

/**
 * Marks the end of a structured error cause block.
 *
 * `ErrorCauseEndToken` terminates a logically grouped error cause section
 * that was previously opened by `ErrorCauseStartToken`.
 *
 * This token is part of the structured error rendering pipeline and is used
 * to ensure that nested error causes are properly delimited and can be
 * rendered independently from the parent error context.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * Error causes are treated as nested error contexts inside a primary error.
 *
 * This token signals the end of such a nested causal scope.
 *
 * Rendering pipeline example:
 *
 * ```text
 * ErrorStartToken
 *   ErrorDataToken
 *   ErrorCauseStartToken
 *     ...nested error tokens
 *   ErrorCauseEndToken   ← THIS TOKEN
 * ErrorEndToken
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to:
 *
 * - delimit nested error causality scopes
 * - allow renderers to isolate cause rendering
 * - preserve structural integrity of error trees
 * - support recursive error inspection
 * - bind cause termination to a known error scope
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE OWNERSHIP MODEL
 * ---------------------------------------------------------------------
 *
 * Each `ErrorCauseEndToken` is explicitly bound to:
 *
 * - an `ErrorStartToken` (error ownership)
 * - an `ErrorCauseStartToken` (cause scope)
 *
 * This ensures:
 *
 * - cause scopes cannot exist outside a valid error context
 * - end tokens are always constructed from trusted tokens
 * - renderer can safely associate closure with error identity
 *
 * The identifiers are derived directly from tokens, not raw symbols.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Each `ErrorCauseEndToken` carries:
 *
 * - `causeId`: derived from `ErrorCauseStartToken`
 * - `errorId`: derived from `ErrorStartToken`
 *
 * This allows:
 *
 * - correct pairing with its matching start token
 * - safe handling of nested or concurrent error causes
 * - prevention of cross-boundary rendering mismatches
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Upon encountering this token, renderers should:
 *
 * - close the current error cause scope
 * - finalize nested cause rendering buffers
 * - restore parent error context
 *
 * The token itself produces no output.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - `causeId` must match a previously opened `ErrorCauseStartToken`
 * - `errorId` must match the originating `ErrorStartToken`
 * - cause scopes must be properly nested and balanced
 *
 * Violations indicate a broken tokenization pipeline.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */export class ErrorCauseEndToken extends BaseToken<'error-cause-end'> {
    /**
     * Identifier of the matching `ErrorCauseStartToken`.
     *
     * This symbol links the end of a cause scope to its corresponding
     * opening token, ensuring structural correctness in the token stream.
     *
     * @since 1.0.0
     */
    readonly #_causeId: symbol;

    /**
     * Identifier of the owning error scope.
     *
     * This value is derived from the provided `ErrorStartToken`
     * and ensures this cause end token is bound to a valid error context.
     *
     * @since 1.0.0
     */
    readonly #_errorId: symbol;

    /**
     * Creates a new error cause end token.
     *
     * @param errorToken
     * The originating error scope token that owns this cause chain.
     *
     * @param causeToken
     * The corresponding `ErrorCauseStartToken` that opened this scope.
     *
     * @since 1.0.0
     */
    constructor(
        errorToken: ErrorStartToken,
        causeToken: ErrorCauseStartToken
    ) {
        super('error-cause-end');

        this.#_errorId = errorToken.id;
        this.#_causeId = causeToken.id;
    }

    /**
     * Returns the identifier of the owning error scope.
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

    /**
     * Returns the identifier of the associated error cause scope.
     *
     * This value must match the `id` of an `ErrorCauseStartToken`.
     *
     * @returns Cause scope identifier
     *
     * @since 1.0.0
     */
    get causeId(): symbol {
        return this.#_causeId;
    }
}