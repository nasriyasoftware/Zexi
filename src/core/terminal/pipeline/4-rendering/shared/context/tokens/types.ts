import type { Token } from "../../../../3-tokenization/types";

/**
 * Internal token stream entry representation.
 *
 * `TokenEntry` augments a raw token with origin metadata that
 * describes how the token entered the traversal stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This structure enables the controller to distinguish between:
 *
 * - tokens originating from the original immutable source stream
 * - tokens injected dynamically during traversal
 *
 * This distinction is required for:
 *
 * - speculative rendering
 * - transactional parsing
 * - rollback semantics
 * - temporary token synthesis
 *
 * ---------------------------------------------------------------------
 * 🔷 ORIGIN SEMANTICS
 * ---------------------------------------------------------------------
 *
 * - `"original"`
 *   Token came from constructor input.
 *
 * - `"injected"`
 *   Token was inserted dynamically via `inject()`.
 *
 * Only injected tokens are eligible for removal during rollback.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type TokenEntry = {
    /**
     * Source classification for the token.
     *
     * Determines whether the token belongs to the immutable source
     * stream or was dynamically inserted during traversal.
     *
     * @since 1.0.0
     */
    origin: 'original' | 'injected';

    /**
     * Actual token instance referenced by this entry.
     *
     * @since 1.0.0
     */
    reference: Token;
}