import type { Token } from "../../../../3-tokenization/types";

/**
 * Internal token stream entry representation.
 *
 * `TokenEntry` augments a raw token with origin metadata describing how
 * the token entered the traversal stream and, for injected tokens, the
 * traversal position at which it was introduced.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This structure enables the controller to distinguish between:
 *
 * - tokens originating from the immutable source stream
 * - tokens injected dynamically during rendering
 *
 * It also records enough information to safely discard injected tokens
 * when rendering backtracks to an earlier traversal position.
 *
 * This metadata is fundamental to:
 *
 * - speculative rendering
 * - transactional rendering
 * - deterministic rollback
 * - temporary token synthesis
 *
 * ---------------------------------------------------------------------
 * 🔷 ORIGIN SEMANTICS
 * ---------------------------------------------------------------------
 *
 * - `"original"`
 *   Token belongs to the immutable source stream supplied when the
 *   controller was created.
 *
 * - `"injected"`
 *   Token was inserted dynamically during rendering via `inject()`.
 *
 * Only injected tokens are eligible for removal during rollback.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Injected tokens additionally record the traversal cursor at the moment
 * they were inserted.
 *
 * This cursor acts as a rollback boundary.
 *
 * When rendering aborts a speculative branch, the controller restores the
 * traversal cursor to the beginning of that branch and removes every
 * injected token whose recorded cursor is greater than or equal to the
 * restored cursor.
 *
 * This guarantees that:
 *
 * - injected tokens never leak across aborted branches
 * - original tokens remain untouched
 * - the token stream is restored to the exact state it had before the
 *   speculative rendering began
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type TokenEntry = {
    /**
     * Actual token instance referenced by this entry.
     *
     * @since 1.0.0
     */
    reference: Token;
} & ({
    /**
     * Source classification for the token.
     *
     * Determines whether the token was dynamically inserted during
     * rendering.
     *
     * @since 1.0.0
     */
    origin: "injected";

    /**
     * Traversal cursor at which this token was injected.
     *
     * Used during rollback to determine whether the token belongs to a
     * speculative rendering branch that must be discarded.
     *
     * @since 1.0.0
     */
    cursor: number;
} | {
    /**
     * Source classification for the token.
     *
     * Indicates that the token belongs to the immutable source stream.
     *
     * @since 1.0.0
     */
    origin: "original";
});