import type { Token } from "../types";

/**
 * Mutable aggregation buffer for token streams produced during
 * the tokenization phase of the rendering pipeline.
 *
 * `TokensBuffer` is a foundational utility used by the tokenizer
 * to incrementally construct a linear sequence of `Token` objects
 * from a recursive `RepresentationNode` tree.
 *
 * It provides a controlled mutation model that supports:
 *
 * - incremental token emission
 * - hierarchical token composition
 * - safe merging of sub-token streams
 * - strict lifecycle enforcement (mutable → finalized)
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `TokensBuffer` exists strictly within the **tokenization layer**.
 *
 * It bridges recursive node traversal and flat token emission:
 *
 * ```text
 * RepresentationNode tree
 *         ↓
 *     Tokenizer (recursive traversal)
 *         ↓
 *   TokensBuffer (composition layer)
 *         ↓
 *      Token[]
 *         ↓
 *     Renderer pipeline
 * ```
 *
 * It is NOT part of rendering, layout, or styling.
 * It is purely a structural accumulation utility.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTATION LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * The buffer operates in two strict states:
 *
 * 1. **Mutable state**
 *    - Tokens can be appended via `add()`
 *    - Buffers can be merged via `consume()`
 *
 * 2. **Finalized state**
 *    - Buffer is locked
 *    - Any mutation throws an error
 *    - Intended to guarantee deterministic output
 *
 * Once `finalize()` is called, the buffer becomes immutable by contract.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This class exists to solve a specific problem:
 *
 * > Safe composition of token streams during recursive traversal
 *
 * Without a buffer abstraction, tokenizer implementations would require:
 * - manual array concatenation
 * - fragile recursion merging logic
 * - error-prone state tracking
 *
 * `TokensBuffer` encapsulates all of this complexity.
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * The buffer enforces strict invariants:
 *
 * - No mutation after finalization
 * - No merging into finalized buffers
 * - No merging from finalized buffers
 *
 * These guarantees ensure:
 * - predictable token ordering
 * - safe recursive composition
 * - elimination of accidental post-processing mutation
 *
 * ---------------------------------------------------------------------
 * 🔷 MEMORY MODEL
 * ---------------------------------------------------------------------
 *
 * The underlying token array is returned directly from `finalize()`
 * without cloning for performance reasons.
 *
 * This means:
 * - ownership is transferred to the caller
 * - mutation after finalization is discouraged by contract
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE CONTEXT
 * ---------------------------------------------------------------------
 *
 * This class is used exclusively inside tokenizers such as:
 *
 * - `Tokenizer`
 * - node-specific token emitters (e.g. `PrimitiveToken.from`)
 *
 * It should NOT be used in:
 * - renderers
 * - layout engines
 * - post-processing stages
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class TokensBuffer {
    /**
     * Internal mutable token storage used during incremental tokenization.
     *
     * This array is appended to during traversal and is only exposed
     * once the buffer is finalized.
     *
     * @since 1.0.0
     */
    readonly #_tokens: Token[] = [];

    /**
     * Indicates whether the buffer has been finalized.
     *
     * Once set to `true`, the buffer becomes immutable and any
     * mutation attempts will throw an error.
     *
     * @since 1.0.0
     */
    #_finalized = false;

    /**
     * Adds tokens to the buffer.
     *
     * This is the primary mutation method used during token construction.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Accepts single tokens or arrays of tokens
     * - Appends them to internal storage
     * - Maintains insertion order
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY RULE
     * ---------------------------------------------------------------------
     *
     * Cannot be called after `finalize()`.
     *
     * Once finalized, the buffer becomes immutable.
     *
     * @param tokens - Single token or array of tokens
     * @returns This buffer for chaining
     *
     * @throws Error if buffer is finalized
     *
     * @since 1.0.0
     */
    add(tokens: Token | Token[]) {
        if (this.#_finalized) {
            throw new Error('Unable to add tokens to finalized buffers');
        }

        if (!Array.isArray(tokens)) { tokens = [tokens] }
        this.#_tokens.push(...tokens);
        return this;
    }

    /**
     * Consumes another `TokensBuffer` into this buffer.
     *
     * This is a structural merge operation used during token construction.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Appends tokens from the source buffer into this buffer
     * - Prevents mutation of finalized buffers
     * - Finalizes the source buffer after consumption
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY RULES
     * ---------------------------------------------------------------------
     *
     * This operation is only valid if:
     *
     * - `this` buffer is NOT finalized
     * - `buffer` is NOT finalized
     *
     * Otherwise, an error is thrown.
     *
     * ---------------------------------------------------------------------
     * 🔷 SIDE EFFECT
     * ---------------------------------------------------------------------
     *
     * The source buffer is automatically finalized after consumption,
     * preventing further mutation or reuse.
     *
     * @param buffer - Source buffer to consume
     * @returns This buffer for chaining
     *
     * @throws Error if either buffer is finalized
     *
     * @since 1.0.0
     */
    consume(buffer: TokensBuffer) {
        if (this.#_finalized) {
            throw new Error('Finalized buffers cannot comsume other buffers')
        }

        if (buffer.#_finalized) {
            throw new Error('Finalized buffers cannot be comsumed by other buffers')
        }

        this.#_tokens.push(...buffer.#_tokens);
        buffer.finalize();
        return this;
    }

    /**
     * Finalizes the buffer and transitions it into an immutable state.
     *
     * Once finalized, the buffer becomes read-only and cannot be modified
     * or consumed further.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY CONTRACT
     * ---------------------------------------------------------------------
     *
     * After calling `finalize()`:
     *
     * - `add()` is disabled
     * - `consume()` is disabled
     * - internal mutation is forbidden
     *
     * The buffer is now considered a **stable token snapshot**.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN INTENT
     * ---------------------------------------------------------------------
     *
     * Finalization is a **state transition operation**, not a data export.
     *
     * It separates:
     *
     * - construction phase (mutable)
     * - consumption phase (read-only)
     *
     * @since 1.0.0
     */
    finalize(): void {
        this.#_finalized = true;
    }

    /**
     * Creates a new `TokensBuffer` by cloning the token stream
     * of an existing buffer.
     *
     * This method performs a **structural copy** of the internal
     * token array, ensuring the new buffer is independent of the source.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Copies all tokens from the source buffer
     * - Does NOT preserve reference identity
     * - Produces a fully independent buffer instance
     *
     * ---------------------------------------------------------------------
     * 🔷 USE CASES
     * ---------------------------------------------------------------------
     *
     * - renderer reuse of finalized buffers
     * - branching output pipelines
     * - safe duplication for concurrent rendering
     *
     * @param buffer - Source buffer to clone
     * @returns A new independent `TokensBuffer` instance
     *
     * @since 1.0.0
     */
    static from(buffer: TokensBuffer) {
        return new TokensBuffer().add(buffer.#_tokens);
    }

    /**
     * Returns a read-only snapshot of the buffer's token stream.
     *
     * This method is intended for renderer consumption only.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Returns a frozen view of the internal token array
     * - Does NOT clone tokens
     * - Does NOT detach from internal storage
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY MODEL
     * ---------------------------------------------------------------------
     *
     * The returned array is structurally immutable:
     *
     * - array shape cannot be modified
     * - token ordering is preserved
     * - underlying token objects remain shared references
     *
     * ⚠️ This is a shallow immutability guarantee only.
     *
     * ---------------------------------------------------------------------
     * 🔷 USE CASE
     * ---------------------------------------------------------------------
     *
     * This method is designed for:
     *
     * - renderers
     * - debug inspectors
     * - serialization layers
     *
     * and should NOT be used for mutation or token construction.
     *
     * @param buffer - Source buffer
     * @returns Read-only frozen token array snapshot
     */
    static toArray(buffer: TokensBuffer): readonly Token[] {
        return Object.freeze(buffer.#_tokens);
    }
}

export default TokensBuffer;