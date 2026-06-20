import { INLINE_SAFE_TOKENS as JSON_INLINE_SAFE_TOKENS } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/configs";
import _rendering from "../../helpers/helpers";

/**
 * ---------------------------------------------------------------------
 * 🔷 CONTRACT TESTING SYSTEM (LAYOUT RESOLUTION)
 * ---------------------------------------------------------------------
 *
 * This module defines **tokenization contracts** used to validate the
 * behavior of the LayoutResolver across multiple tokenizer implementations.
 *
 * Instead of testing a single renderer configuration in isolation, the
 * system defines reusable “contracts” that describe:
 *
 * - how values are tokenized
 * - which tokens are considered inline-safe
 * - how layout rules should behave for that tokenizer
 *
 * ---------------------------------------------------------------------
 * 🔷 WHY THIS EXISTS
 * ---------------------------------------------------------------------
 *
 * Layout behavior is NOT purely renderer-specific.
 *
 * It depends on:
 * - token structure (Graph → Representation → Token stream)
 * - envelope semantics (Set, Map, Error, etc.)
 * - inline-safe token policy
 *
 * This abstraction allows:
 *
 * - shared layout correctness tests across multiple pipelines
 * - regression safety when tokenizers diverge
 * - validation of renderer-agnostic layout logic
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTRACT MODEL
 * ---------------------------------------------------------------------
 *
 * Each contract defines:
 *
 * - `tokenize(value)`
 *   A tokenizer function that converts runtime values into a token stream.
 *
 * - `inlineSafe`
 *   A Set of token kinds that are considered safe for inline rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * All contracts currently share `JSON_INLINE_SAFE_TOKENS`.
 *
 * This is intentional:
 *
 * - Only JSON renderer has a fully specified inline-safe model today
 * - Other tokenizers reuse JSON semantics as a temporary baseline
 *
 * ⚠️ This is a known coupling point and should be revisited once
 * non-JSON renderers define their own layout rules.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTRACTS INCLUDED
 * ---------------------------------------------------------------------
 *
 * ### 1. json
 *
 * Primary reference implementation.
 *
 * - Fully defined inline-safe token set
 * - Strict structural rules
 * - Baseline for all layout decisions
 *
 * ### 2. ignoredCycles
 *
 * Cycle-safe tokenizer variant.
 *
 * - Similar structural rules to JSON
 * - Cycles are ignored instead of throwing or marking
 * - Used to validate layout stability under missing subtrees
 *
 * ### 3. markedCycles
 *
 * Cycle-marking tokenizer variant.
 *
 * - Cycles are explicitly represented in token stream
 * - Introduces additional structural markers
 * - Useful for testing layout resilience under metadata-heavy trees
 *
 * ---------------------------------------------------------------------
 * 🔷 TESTING STRATEGY
 * ---------------------------------------------------------------------
 *
 * These contracts are consumed by LayoutResolver tests to ensure:
 *
 * - inline layouts remain stable across tokenizer variants
 * - block forcing rules behave consistently
 * - envelope and structural tokens are handled uniformly
 *
 * Each contract is treated as an independent semantic universe.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */

/**
 * Internal contract registry.
 *
 * Each entry defines a full tokenizer + inline-safe policy pair.
 *
 * @internal
 */
const data = {
    /**
     * Reference JSON tokenizer contract.
     *
     * - Defines canonical inline-safe behavior
     * - Serves as baseline for all layout decisions
     * - Strict structural semantics
     */
    json: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'json')![1]
    },

    /**
     * Cycle-ignored tokenizer contract.
     *
     * - Cycles are removed from output stream
     * - Layout behaves as if cycles do not exist
     * - Used to test structural stability under pruning
     */
    ignoredCycles: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'ignoredCycles')![1]
    },

    /**
     * Cycle-marked tokenizer contract.
     *
     * - Cycles are explicitly represented in token stream
     * - Introduces additional structural markers
     * - Useful for verifying layout resilience under expanded graphs
     */
    markedCycles: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'markedCycles')![1]
    }
} as const;

/**
 * Array of all layout test contracts.
 *
 * Each tuple contains:
 * - contract name (for test labeling)
 * - contract definition (tokenizer + inline-safe rules)
 *
 * This structure is used by `describe.each(...)` in LayoutResolver tests
 * to generate parameterized test suites.
 */
const contracts = [
    ['json', data.json],
    ['ignoredCycles', data.ignoredCycles],
    ['markedCycles', data.markedCycles]
] as const;

export default contracts;