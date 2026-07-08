import ZexiRenderingContext from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import LayoutResolver from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver";
import type contracts from "./contracts";
import type { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";

type Contract = typeof contracts[number][1];

/**
 * Test-only helper for validating layout resolution behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This class is a **test infrastructure utility** used to validate the
 * behavior of `LayoutResolver` against contract-defined token streams.
 *
 * It does not belong to production code and exists solely under the
 * `tests/` boundary.
 *
 * Its responsibility is to:
 *
 * - construct a rendering context from pre-tokenized inputs
 * - align traversal state with production execution assumptions
 * - execute layout resolution in a controlled environment
 * - assert deterministic layout outcomes (`inline` vs `block`)
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAVERSAL ALIGNMENT
 * ---------------------------------------------------------------------
 *
 * In the production renderer, layout resolution is always executed
 * **after traversal has entered a `group-start` token**.
 *
 * This means:
 *
 * - `ctx.tokens.cursor !== -1`
 * - `ctx.tokens.current` is a `GroupStartToken`
 *
 * ---------------------------------------------------------------------
 * 🔷 WHY `ctx.tokens.next()` IS CALLED IN THE CONSTRUCTOR
 * ---------------------------------------------------------------------
 *
 * The constructor explicitly advances the token cursor once:
 *
 * ```
 * this.#_ctx.tokens.next();
 * ```
 *
 * This is intentional and required to mirror production behavior.
 *
 * It ensures that:
 *
 * - traversal state is already initialized before resolution
 * - `current` token resolves to the first `group-start`
 * - layout resolution runs under the same assumptions as the renderer
 *
 * Without this step, tests would execute in an invalid traversal state
 * (`cursor === -1`), which does not represent real runtime behavior.
 *
 * This is not a workaround — it is a deliberate alignment with the
 * renderer’s execution contract.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE OF RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * This helper does NOT:
 *
 * - validate tokenizer correctness
 * - verify token structure integrity
 * - modify layout resolution logic
 *
 * Those responsibilities belong to:
 *
 * - tokenizer tests (structure correctness)
 * - resolver tests (behavior correctness)
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * The goal of this helper is to eliminate boilerplate while preserving
 * strict equivalence with production traversal semantics.
 * 
 * @internal
 * Test-only utility used for layout resolver contract verification.
 * 
 * @since 1.0.0
 */
class ContractTester {
    readonly #_contract: Contract;
    readonly #_ctx: ZexiRenderingContext;
    readonly #_tokens: readonly Token[];
    readonly #_renderer: 'json' | 'debug';

    constructor(
        contract: Contract,
        policy: "json" | "ignoredCycles" | "markedCycles",
        tokens: readonly Token[],
        maxWidth?: number
    ) {
        this.#_contract = contract;
        this.#_renderer = policy === 'json' ? 'json' : 'debug';

        this.#_tokens = tokens;
        this.#_ctx = new ZexiRenderingContext(tokens, {
            spaces: 2,
            maxWidth
        });

        // explicit precondition setup
        this.#_ctx.tokens.next(); // move to GroupStart
    }

    expectLayout(expected: 'inline' | 'block') {

        const resovled = LayoutResolver.resolve({
            context: this.#_ctx,
            inlineSafe: this.#_contract.inlineSafe,
            renderer: this.#_renderer
        });

        expect(resovled).toBe(expected);
    }
}

export default ContractTester;