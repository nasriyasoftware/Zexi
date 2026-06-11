import BaseToken from "../assets/__base.token__";

/**
 * Callback execution token used for injecting controlled side-effects
 * into a token stream.
 *
 * `CallbackToken` represents a **non-rendering executable instruction**
 * that is triggered during traversal of the token stream.
 *
 * It does not contribute to visual output and has zero structural meaning
 * in the rendering model.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the **control layer of the token stream**, not
 * the semantic or structural rendering layers.
 *
 * It is used when the renderer needs to perform an imperative action
 * during streaming without breaking the token pipeline.
 *
 * Typical usage:
 *
 * - deferred scope finalization
 * - writer commits
 * - renderer state transitions
 * - side-effect synchronization points
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The purpose of this token is to:
 *
 * - encapsulate executable behavior inside a token
 * - preserve stream purity (no out-of-band execution)
 * - avoid branching logic in renderer loops
 * - unify control flow within token iteration
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION MODEL
 * ---------------------------------------------------------------------
 *
 * The token holds a private handler function that is executed explicitly
 * via `run()`.
 *
 * The renderer is responsible for calling `run()` when encountered in
 * the token stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * - No arguments are passed into execution
 * - No return value is consumed
 * - Execution is synchronous
 * - Side effects are intentional and localized
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The handler is defined at construction time and cannot be modified.
 *
 * This ensures deterministic execution behavior across rendering passes.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class CallbackToken extends BaseToken<'callback'> {
    /**
     * Internal executable callback.
     *
     * This function represents a deferred side-effect that will be
     * executed when `run()` is invoked by the renderer.
     *
     * @since 1.0.0
     */
    readonly #_handler: () => void;

    /**
     * Creates a new callback token.
     *
     * @param handler - The callback function to be executed.
     *
     * @since 1.0.0
     */
    constructor(handler: () => void) {
        super('callback');
        this.#_handler = handler;
    }

    /**
     * Executes the encapsulated callback.
     *
     * This method is called by the renderer when the token is reached
     * in the token stream.
     *
     * It performs no rendering and produces no output.
     *
     * @since 1.0.0
     */
    run(): void {
        this.#_handler();
    }
}