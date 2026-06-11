import BaseToken from "../../assets/__base.token__";
import type { ErrorStartToken } from "./error.start.token";

/**
 * Semantic token representing the core metadata of an error.
 *
 * `ErrorDataToken` isolates the *identity* of an error from its structural
 * representation in the token stream.
 *
 * It contains only:
 *
 * - error name (type)
 * - optional error message (detail)
 * - originating error scope identity (via `ErrorStartToken`)
 *
 * and excludes:
 *
 * - stack traces
 * - causes
 * - structural grouping
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and represents
 * the immutable identity of an error within a scoped error region.
 *
 * It is always emitted inside an error scope:
 *
 * ```text
 * ErrorStartToken
 *      ↓
 * ErrorDataToken   ← THIS TOKEN
 *      ↓
 * (optional cause / stack tokens)
 *      ↓
 * ErrorEndToken
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to:
 *
 * - separate error identity from error structure
 * - provide machine-readable error metadata
 * - enable renderer-agnostic error formatting
 * - avoid embedding raw Error objects
 * - explicitly bind error metadata to a known error scope
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR SCOPE OWNERSHIP
 * ---------------------------------------------------------------------
 *
 * Each `ErrorDataToken` is explicitly bound to an `ErrorStartToken`.
 *
 * This ensures:
 *
 * - error metadata cannot exist outside a valid scope
 * - renderer can correlate error header + body safely
 * - nested error structures remain traceable
 *
 * The scope identity is derived directly from the provided
 * `ErrorStartToken`, not passed independently.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Error data is immutable after construction.
 *
 * This ensures:
 *
 * - deterministic rendering
 * - stable token identity
 * - safe reuse in cached token streams
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The `name` field represents the *type* of error:
 *
 * - `Error`
 * - `TypeError`
 * - `RangeError`
 * - custom domain errors
 *
 * The `message` field represents the *human-readable description*,
 * which may be omitted when empty or undefined.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Renderers may use this token to:
 *
 * - display error headers
 * - annotate structured logs
 * - group diagnostic output
 *
 * It does NOT include stack or cause information.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * This token has no intrinsic visual width on its own.
 * It is interpreted entirely by renderers.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ErrorDataToken extends BaseToken<'error-data'> {

    /**
     * Identifier of the associated error scope.
     *
     * This value is derived from the provided `ErrorStartToken`
     * and ensures this token is bound to a valid error region.
     *
     * @since 1.0.0
     */
    readonly #_errorId: symbol;

    /**
     * Runtime error name.
     *
     * Represents the *type identity* of the error rather than its message
     * or structural representation.
     *
     * Common values include:
     *
     * - `Error`
     * - `TypeError`
     * - `RangeError`
     * - custom domain-specific error names
     *
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Optional runtime error message.
     *
     * This value provides additional context about the error but may be
     * undefined when the original error has no message.
     *
     * @since 1.0.0
     */
    readonly #_message?: string;

    /**
     * Creates a new error data token.
     *
     * @param errorToken
     * The originating error scope token used to bind this metadata
     * to a valid error context.
     *
     * @param name
     * The runtime error name (type identifier).
     *
     * @param message
     * Optional error message describing the failure.
     *
     * @since 1.0.0
     */
    constructor(
        errorToken: ErrorStartToken,
        name: string,
        message?: string
    ) {
        super('error-data');

        this.#_errorId = errorToken.id;
        this.#_name = name;
        this.#_message = message;
    }

    /**
     * Returns the error scope identifier this token belongs to.
     *
     * This always matches the `id` of the originating `ErrorStartToken`.
     *
     * @returns Error scope identifier
     *
     * @since 1.0.0
     */
    get errorId(): symbol {
        return this.#_errorId;
    }

    /**
     * Returns the runtime error name.
     *
     * This is the semantic error identifier (not the token kind).
     *
     * @returns Error name
     *
     * @example
     * ```ts
     * token.name; // "TypeError"
     * ```
     *
     * @since 1.0.0
     */
    get name(): string {
        return this.#_name;
    }

    /**
     * Returns the optional error message.
     *
     * @returns Error message or undefined if not present
     *
     * @since 1.0.0
     */
    get message(): string | undefined {
        return this.#_message;
    }
}