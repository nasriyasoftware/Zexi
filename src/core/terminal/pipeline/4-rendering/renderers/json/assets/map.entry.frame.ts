import TOKENS from "../../../../3-tokenization/tokens";
import type { Token } from "../../../../3-tokenization/types";

/**
 * MapEntryFrame
 * -------------
 *
 * A transient structural frame used during map token rendering
 * to correctly align key/value entry boundaries inside the token stream.
 *
 * This class is NOT a cache and does not persist beyond a single
 * rendering pass. It exists purely as a temporary staging structure
 * that bridges raw token parsing with envelope-aware injection.
 *
 * Each frame is responsible for:
 * - Tracking a single map entry (key + value pair)
 * - Holding a tokenized template with injection anchors
 * - Accumulating streamed tokens until a structural boundary is reached
 * - Injecting those tokens into the correct positions in the template
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Transient Lifecycle**
 *    - Instances are created per map entry during rendering
 *    - They are never reused or stored in global/shared state
 *    - They are discarded immediately after final token emission
 *
 * 2. **Anchor-Based Injection Model**
 *    - Uses explicit start/end anchors instead of positional indexing
 *    - Ensures deterministic insertion points for key/value segments
 *    - Decouples entry structure from tokenizer implementation details
 *
 * 3. **Token Template Binding**
 *    - A pre-generated token skeleton defines entry structure
 *    - Anchors replace placeholder primitives in that skeleton
 *    - Runtime tokens are injected into those anchor positions
 *
 * 4. **Two-Phase Application Model**
 *    - First application fills the "key" segment
 *    - Second application fills the "value" segment
 *    - Completion is defined only when both phases are applied
 *
 * 5. **Strict Invariants**
 *    - Cannot mutate after completion (`isComplete`)
 *    - Cannot apply empty token streams
 *    - Anchors must exist in template at all times
 *    - Property order is tokenizer-defined and NOT assumed
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STRUCTURE
 * ---------------------------------------------------------------------
 *
 * The frame maintains:
 *
 * - A frozen token template generated from a synthetic key/value object
 * - Two structural anchors:
 *   - `entry-key` → insertion point for map key tokens
 *   - `entry-value` → insertion point for map value tokens
 * - A transient accumulation buffer for streamed tokens
 *
 * These components together allow deterministic reconstruction of
 * a map entry in serialized form without relying on index-based logic.
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE OVERVIEW
 * ---------------------------------------------------------------------
 *
 * 1. Construct frame with tokenizer-generated template
 * 2. Replace synthetic property values with anchors
 * 3. Stream tokens via `add(...)`
 * 4. Apply first phase (key or pre-value segment)
 * 5. Apply second phase (remaining segment)
 * 6. Freeze final token structure
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT NOTES
 * ---------------------------------------------------------------------
 *
 * - This class does NOT validate semantic correctness of entries.
 * - It assumes upstream map parsing guarantees structural correctness.
 * - It does NOT perform deep cloning of tokens.
 * - It is safe to discard immediately after `getTokens()`.
 *
 * ---------------------------------------------------------------------
 * @internal
 * This is an internal renderer utility and should not be used outside
 * the map rendering pipeline.
 *
 * @since 1.0.0
 */
class MapEntryFrame {
    /**
     * Internal frozen template representing the structural token layout
     * of a single map entry.
     *
     * This array is derived from tokenizer output and then mutated once
     * during construction to replace placeholder primitives with anchors.
     *
     * @private
     * @since 1.0.0
     */
    readonly #_tokens: Token[] = [];

    /**
     * Temporary buffer used to accumulate streamed tokens for either:
     * - key phase
     * - value phase
     *
     * This buffer is flushed after every `apply()` call.
     *
     * @private
     * @since 1.0.0
     */
    readonly #_buffer: Token[] = [];

    /**
     * Anchor registry used to mark structural injection points
     * inside the template.
     *
     * - `start` → key insertion point (`entry-key`)
     * - `end`   → value insertion point (`entry-value`)
     *
     * These anchors are guaranteed to exist in the template after construction.
     *
     * @private
     * @since 1.0.0
     */
    readonly #_anchors = {
        /**
         * Marks the insertion point for key-side tokens.
         * @since 1.0.0
         */
        start: new TOKENS.Anchor('entry-key'),

        /**
         * Marks the insertion point for value-side tokens.
         * @since 1.0.0
         */
        end: new TOKENS.Anchor('entry-value')
    }

    /**
     * Internal state flags controlling the two-phase application lifecycle.
     *
     * - `startApplied` → key phase has been injected
     * - `endApplied`   → value phase has been injected
     *
     * Completion is defined as:
     * `startApplied && endApplied === true`
     *
     * @private
     * @since 1.0.0
     */
    readonly #_flags = {
        startApplied: false,
        endApplied: false
    }

    /**
     * Constructs a MapEntryFrame from a synthetic tokenizer input.
     *
     * The tokenizer is executed using a placeholder `{ key: '', value: '' }`
     * object in order to generate a deterministic template.
     *
     * After generation:
     * - property tokens are located
     * - placeholder primitive values are replaced with anchors
     *
     * @param tokenizer
     * A function that produces a token stream for a map entry shape.
     *
     * This tokenizer MUST:
     * - return a stable structural representation for `{ key, value }`
     * - include exactly two property primitives representing key/value slots
     *
     * @throws If template does not contain expected property tokens
     * @throws If tokenizer output structure is invalid
     *
     * @since 1.0.0
     */
    constructor(tokenizer: (value: unknown) => readonly Token[]) {
        const generated = tokenizer({
            key: '',
            value: ''
        });

        this.#_tokens = [...generated];

        const kinds = generated.map(t => t.kind);
        for (let i = 1; i <= 2; i++) {
            const propIndex = kinds[i === 1 ? 'indexOf' : 'lastIndexOf']('property');
            const prop = this.#_tokens[propIndex];

            if (!(prop instanceof TOKENS.Property)) {
                throw new Error(`Invariant violation: Expected property at index ${propIndex}, but instead got "${prop.kind}"`)
            }

            this.#_tokens.splice(propIndex + 3, 1, prop.value === 'key' ? this.#_anchors.start : this.#_anchors.end);
        }
    }

    /**
     * Adds tokens to the current active accumulation buffer.
     *
     * These tokens are staged until `apply()` is called, at which point
     * they are injected into either the key or value region depending on
     * lifecycle state.
     *
     * @param token
     * A single token or array of tokens to buffer.
     *
     * @throws If called after the frame has completed both phases.
     *
     * @since 1.0.0
     */
    add(token: Token | Token[]) {
        if (this.isComplete) {
            throw new Error('Invariant violation: Cannot add tokens after end.');
        }

        if (!Array.isArray(token)) {
            token = [token];
        }

        this.#_buffer.push(...token);
    }

    /**
     * Applies the currently buffered tokens into the frame template.
     *
     * This method is called twice during the lifecycle:
     *
     * - First call → injects into `entry-key`
     * - Second call → injects into `entry-value`
     *
     * Each call consumes the internal buffer.
     *
     * @throws If called after completion
     * @throws If buffer is empty
     *
     * @since 1.0.0
     */
    apply() {
        if (this.isComplete) {
            throw new Error('Invariant violation: Cannot apply tokens after its completion.');
        }

        if (this.#_buffer.length === 0) {
            throw new Error('Invariant violation: Cannot apply empty tokens.');
        }

        if (!this.#_flags.startApplied) {
            const startIndex = this.#_tokens.indexOf(this.#_anchors.start);
            this.#_tokens.splice(startIndex + 1, 0, ...this.#_buffer);

            this.#_buffer.length = 0;
            this.#_flags.startApplied = true;

            return;
        }

        if (!this.#_flags.endApplied) {
            const endIndex = this.#_tokens.indexOf(this.#_anchors.end);
            this.#_tokens.splice(endIndex + 1, 0, ...this.#_buffer);

            this.#_buffer.length = 0;
            this.#_flags.endApplied = true;
        }
    }

    /**
     * Returns a frozen snapshot of the final token structure.
     *
     * This is a defensive copy:
     * - original internal array is not exposed
     * - returned array is frozen to prevent mutation
     *
     * @returns Immutable array of finalized tokens
     *
     * @since 1.0.0
     */
    getTokens() {
        return Object.freeze([...this.#_tokens]);
    }

    /**
     * Indicates whether the frame has fully completed both injection phases.
     *
     * Completion requires:
     * - key phase applied (`startApplied`)
     * - value phase applied (`endApplied`)
     *
     * @returns true if frame is fully finalized, otherwise false
     *
     * @since 1.0.0
     */
    get isComplete() {
        return this.#_flags.startApplied && this.#_flags.endApplied;
    }
}

export default MapEntryFrame;