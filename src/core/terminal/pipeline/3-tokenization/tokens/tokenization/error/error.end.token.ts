import BaseToken from "../../assets/__base.token__";
import type { ErrorStartToken } from "./error.start.token";

/**
 * Marks the end of an error semantic scope.
 *
 * `ErrorEndToken` defines the closing boundary of a structured error
 * region within the semantic token stream.
 *
 * It is always paired with an `ErrorStartToken` to form a complete
 * error scope.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `ErrorEndToken` belongs to the semantic tokenization layer and signals
 * the termination of an error structure in the flat token stream.
 *
 * Rendering pipeline placement:
 *
 * ```text
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
 * - explicitly close error scopes
 * - ensure balanced structural token streams
 * - support deterministic renderer traversal
 * - enable scoped error formatting logic
 *
 * Unlike loosely-coupled structural tokens that may reference arbitrary
 * identifiers directly, `ErrorEndToken` derives its ownership identity
 * explicitly from an `ErrorStartToken`.
 *
 * This prevents accidental scope mismatches caused by unrelated symbols
 * and guarantees that the end token originates from a valid error scope.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE IDENTIFICATION MODEL
 * ---------------------------------------------------------------------
 *
 * Each `ErrorEndToken` stores the identifier extracted from the
 * corresponding `ErrorStartToken`.
 *
 * This allows renderers and validators to:
 *
 * - match start/end boundaries safely
 * - detect mismatched error scopes
 * - support nested error structures
 * - maintain structural integrity during streaming
 *
 * ---------------------------------------------------------------------
 * 🔷 EXPLICIT OWNERSHIP MODEL
 * ---------------------------------------------------------------------
 *
 * The constructor intentionally accepts:
 *
 * - `ErrorStartToken`
 *
 * instead of a raw `symbol`.
 *
 * This design guarantees:
 *
 * - ownership correctness
 * - stronger structural coupling
 * - reduced renderer misuse risk
 * - safer token construction semantics
 *
 * Example:
 *
 * ```ts
 * const start = new ErrorStartToken(error);
 *
 * tokens.push(
 *   start,
 *   new ErrorDataToken(...),
 *   new ErrorEndToken(start)
 * );
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Upon encountering this token, renderers may:
 *
 * - exit error rendering mode
 * - finalize error formatting state
 * - restore parent layout context
 * - flush buffered diagnostic output
 *
 * The token itself produces no visible output.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `ErrorEndToken` contributes:
 *
 * - zero printable width
 * - zero visual representation
 *
 * It is purely a structural boundary marker.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Every `ErrorEndToken` is guaranteed to reference a valid
 * `ErrorStartToken` identity.
 *
 * Mismatched ownership relationships therefore indicate a pipeline
 * construction bug rather than invalid external input.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ErrorEndToken extends BaseToken<'error-end'> {
    /**
     * Identifier of the associated `ErrorStartToken`.
     *
     * This symbol is used to ensure that error scope boundaries are
     * correctly matched during rendering and validation.
     *
     * @since 1.0.0
     */
    readonly #_errorId: symbol;

    /**
     * Creates a new error scope end token.
     *
     * The provided `ErrorStartToken` acts as the ownership source
     * for this closing boundary token.
     *
     * @param errorToken
     * The originating error scope token.
     *
     * @since 1.0.0
     */
    constructor(errorToken: ErrorStartToken) {
        super('error-end');
        this.#_errorId = errorToken.id;
    }

    /**
     * Returns the associated error scope identifier.
     *
     * This value must match the `id` of an `ErrorStartToken`.
     *
     * @returns Error scope identifier
     *
     * @since 1.0.0
     */
    get errorId() {
        return this.#_errorId;
    }
}