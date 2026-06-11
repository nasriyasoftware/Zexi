import TokensBuffer from "../../container/tokens.buffer";
import type { TokenizationCacheEntry } from "../../types";
import type { RepRefNode } from "../../../2-representation/types";

/**
 * TokenizationCache
 *
 * Identity-aware caching layer used during the tokenization phase to ensure
 * stable handling of repeated `RepresentationNode` references.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * The tokenizer operates on a semantic graph where nodes may be referenced
 * multiple times (especially in cases of:
 *
 * - circular references
 * - shared subtrees
 * - repeated objects/functions/errors
 *
 * Without caching, repeated visits would:
 *
 * - duplicate token output
 * - break reference semantics
 * - explode recursion for cycles
 *
 * This cache ensures that:
 *
 * - each `RepRefNode` is tokenized exactly once (first encounter)
 * - subsequent encounters emit lightweight reference tokens
 * - structural identity is preserved across traversal
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Cache keys are **object identity-based**, not structural:
 *
 * ```ts
 * Map<RepRefNode, TokenizationCacheEntry>
 * ```
 *
 * This means:
 *
 * - same node instance → same cache entry
 * - equivalent but different instances → different entries
 *
 * This is critical for:
 *
 * - cycle safety
 * - deterministic reference numbering
 * - stable rehydration of repeated structures
 *
 * ---------------------------------------------------------------------
 * 🔷 ENTRY LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * On first encounter:
 *
 * - a new `TokensBuffer` is created
 * - entry is stored in cache with count = 1
 * - `firstSeen = true` is returned
 *
 * On subsequent encounters:
 *
 * - cached buffer is reused (cloned via `TokensBuffer.from`)
 * - reference counter is incremented
 * - `firstSeen = false` is returned
 *
 * ---------------------------------------------------------------------
 * 🔷 REFERENCE COUNTING
 * ---------------------------------------------------------------------
 *
 * The `count` field tracks how many times a node has been encountered.
 *
 * This enables:
 *
 * - reference labels (e.g. `#1`, `#2`)
 * - stable pointer rendering
 * - debug diagnostics for repeated structures
 *
 * ---------------------------------------------------------------------
 * 🔷 BUFFER SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The stored `TokensBuffer` represents the **fully tokenized first pass**
 * of a node.
 *
 * Important properties:
 *
 * - it is the canonical token representation
 * - reused for all subsequent references
 * - cloned before reuse to avoid mutation leaks
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * The cache guarantees:
 *
 * - no infinite recursion on cyclic graphs
 * - deterministic token ordering
 * - stable reuse semantics
 *
 * ---------------------------------------------------------------------
 * @internal
 * @since 1.0.0
 */
class TokenizationCache {
    /**
     * Internal identity cache mapping representation nodes to token entries.
     *
     * Each entry stores:
     *
     * - the original node reference
     * - the first generated token buffer
     * - the number of times the node was encountered
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_cache = new Map<RepRefNode, TokenizationCacheEntry>;

    /**
     * Checks the cache for a representation node and returns its state.
     *
     * This method performs two roles:
     *
     * 1. Determines whether the node is being seen for the first time
     * 2. Either initializes or reuses its cached token buffer
     *
     * ---------------------------------------------------------------------
     * 🔷 FIRST VISIT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * If the node has never been seen:
     *
     * - a new `TokensBuffer` is created
     * - cache entry is initialized
     * - `firstSeen: true` is returned
     *
     * ---------------------------------------------------------------------
     * 🔷 REVISIT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * If the node has been seen before:
     *
     * - reference counter is incremented
     * - a cloned buffer is returned (`TokensBuffer.from`)
     * - `firstSeen: false` is returned
     *
     * ---------------------------------------------------------------------
     * @param node - Representation node used as identity key
     *
     * @returns Cache evaluation result containing:
     *
     * - `firstSeen`: whether this is the first encounter
     * - `count`: current reference count
     * - `buffer`: token buffer (fresh or cloned)
     *
     * @since 1.0.0
     */
    check(node: RepRefNode) {
        const entry = this.#_cache.get(node);

        if (entry) {
            return {
                firstSeen: false,
                count: ++entry.count,
                buffer: TokensBuffer.from(entry.buffer)
            }
        } else {
            const buffer = new TokensBuffer;
            this.#_cache.set(node, { node, buffer, count: 1 });

            return {
                firstSeen: true,
                count: 1,
                buffer
            }
        }
    }
}

export default TokenizationCache;