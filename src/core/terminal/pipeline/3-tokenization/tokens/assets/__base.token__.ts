/**
 * Base class for all token types in the rendering tokenization system.
 *
 * `BaseToken` provides a minimal shared identity layer for all tokens
 * produced during the tokenization phase of the rendering pipeline.
 *
 * It does NOT define behavior, layout rules, or rendering semantics.
 * Its only responsibility is to provide a stable, strongly-typed token identity.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * All concrete token types in the system extend `BaseToken` to inherit
 * a consistent naming and identification model.
 *
 * This enables:
 *
 * - runtime type discrimination via `kind`
 * - consistent debugging output
 * - structural token categorization
 * - renderer-level pattern matching
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this abstraction is to ensure that:
 *
 * - every token has a stable runtime identity
 * - token classification does not rely solely on `instanceof`
 * - renderer logic can operate on token metadata when needed
 *
 * This is especially useful in systems where tokens may be:
 * - transformed
 * - proxied
 * - serialized
 * - passed between layers
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * The generic parameter `N` represents the literal token kind type.
 *
 * This ensures:
 *
 * - compile-time discrimination of token types
 * - stronger inference in renderer switch logic
 * - prevention of invalid token kind assignment
 *
 * Example:
 *
 * ```ts
 * class StringToken extends BaseToken<'StringToken'> {}
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The token kind is immutable after construction.
 *
 * This ensures that token identity remains stable throughout:
 *
 * - tokenization
 * - transformation
 * - rendering
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
abstract class BaseToken<N extends string> {
    /**
     * Internal immutable token identifier.
     *
     * This value uniquely identifies the token type at runtime
     * and is used for classification and debugging purposes.
     *
     * @since 1.0.0
     */
    readonly #_kind: N;

    /**
     * Creates a new token instance with a stable identity kind.
     *
     * @param kind - Literal token type kind used for identification
     *
     * @since 1.0.0
     */
    constructor(kind: N) {
        this.#_kind = kind;
    }

    /**
     * Returns the immutable token kind.
     *
     * This value is used by renderers and tooling to identify
     * the token type at runtime.
     *
     * @returns The literal token kind
     *
     * @since 1.0.0
     */
    get kind(): N {
        return this.#_kind;
    }
}

export default BaseToken;