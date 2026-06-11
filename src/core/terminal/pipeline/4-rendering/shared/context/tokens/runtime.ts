import type { Token } from "../../../../3-tokenization/types";
import TokensController from "./tokens.controller";

/**
 * Public renderer-facing token traversal runtime.
 *
 * `TokensRuntime` exposes a safe, restricted interface over the
 * internal `TokensController`.
 *
 * It provides renderers with controlled access to:
 *
 * - sequential token traversal
 * - lookahead inspection
 * - runtime token injection
 * - current token inspection
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This runtime exists as a protective abstraction boundary between:
 *
 * - low-level traversal mechanics (`TokensController`)
 * - renderer execution logic
 *
 * Renderers should interact only with this runtime rather than the
 * underlying controller directly.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * `TokensRuntime` intentionally hides internal traversal mechanics such as:
 *
 * - cursor management
 * - rollback behavior
 * - token storage structure
 * - injected token bookkeeping
 *
 * This prevents renderers from coupling themselves to internal
 * transactional semantics.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTATION MODEL
 * ---------------------------------------------------------------------
 *
 * Renderers may:
 *
 * - consume tokens via `next()`
 * - inspect future tokens via `peek()`
 * - inject tokens dynamically via `inject()`
 *
 * Renderers may NOT:
 *
 * - rollback traversal
 * - modify cursor state
 * - access raw token storage
 *
 * Rollback semantics are coordinated exclusively by higher-level
 * runtime orchestration systems.
 *
 * ---------------------------------------------------------------------
 * 🔷 TRANSACTIONAL SAFETY
 * ---------------------------------------------------------------------
 *
 * Token rollback and speculative traversal are managed internally by:
 *
 * - `ScopesRuntime`
 * - rendering context orchestration
 *
 * This runtime intentionally exposes no rollback primitives.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class TokensRuntime {
    /**
     * Internal token traversal controller.
     *
     * Owns the actual traversal state and mutation mechanics.
     *
     * This controller is intentionally hidden from renderers to preserve
     * abstraction boundaries and transactional guarantees.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_controller: TokensController;

    /**
     * Creates a new renderer-facing token runtime.
     *
     * @param controller
     * Internal token traversal controller to expose safely.
     *
     * @since 1.0.0
     */
    constructor(controller: TokensController) {
        this.#_controller = controller;
    }

    _debug() {
        this.#_controller._debug();
    }

    /**
     * Current traversal cursor position.
     *
     * The cursor represents the index of the most recently consumed token
     * in the active stream.
     *
     * It is exposed to allow renderers to make deterministic decisions
     * about relative stream mutation (such as injection positioning).
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR SEMANTICS
     * ---------------------------------------------------------------------
     *
     * - `-1` → traversal has not started
     * - `0`  → first token has been consumed
     * - `n`  → token at index `n` was most recently returned by `next()`
     *
     * The cursor always refers to a *consumed token position*.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE IN INJECTION
     * ---------------------------------------------------------------------
     *
     * The cursor is used as the default reference point for relative injection:
     *
     * ```ts
     * inject(tokens)
     * ```
     *
     * is equivalent to:
     *
     * ```ts
     * inject(tokens, { at: cursor + 1 })
     * ```
     *
     * This makes cursor a stable anchor for forward-only stream mutation.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT INVARIANT
     * ---------------------------------------------------------------------
     *
     * The cursor defines *position in the consumed stream*, not the insertion
     * logic itself.
     *
     * Injection rules (anchor resolution, bounds checking, etc.) are still
     * enforced by `TokensController`.
     *
     * @returns Current cursor index in the token stream
     *
     * @since 1.0.0
     */
    get cursor(): number {
        return this.#_controller.cursor;
    }

    /**
     * Current token in the traversal stream.
     *
     * Returns the most recently consumed token.
     *
     * Before traversal begins, this value is `null`.
     *
     * This getter does not mutate traversal state.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURRENT TOKEN SEMANTICS
     * ---------------------------------------------------------------------
     *
     * The current token is defined as:
     *
     * > the token most recently returned by `next()`
     *
     * Example:
     *
     * ```ts
     * runtime.next();
     * runtime.current;
     * ```
     *
     * ---------------------------------------------------------------------
     * @returns Current token or `null` before traversal starts
     *
     * @since 1.0.0
     */
    get current(): Token | null {
        return this.#_controller.current;
    }

    /**
     * Determines whether additional unread tokens remain.
     *
     * This checks whether calling `next()` would successfully advance
     * traversal.
     *
     * This method does not mutate traversal state.
     *
     * @returns `true` if another token can be consumed
     *
     * @since 1.0.0
     */
    hasNext(): boolean {
        return this.#_controller.hasNext();
    }

    /**
     * Advances traversal and returns the next token.
     *
     * Behavior:
     *
     * - advances the internal traversal cursor
     * - updates `current`
     * - returns the consumed token
     *
     * If traversal has reached end-of-stream, `null` is returned.
     *
     * ---------------------------------------------------------------------
     * 🔷 STREAM SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Tokens are consumed sequentially in deterministic order.
     *
     * Injected tokens are treated as part of the active stream and are
     * consumed naturally during traversal.
     *
     * ---------------------------------------------------------------------
     * @returns Next token or `null` at end-of-stream
     *
     * @since 1.0.0
     */
    next(): Token | null {
        return this.#_controller.next();
    }

    /**
     * Injects tokens into the active traversal stream.
     *
     * This is a direct pass-through to the underlying `TokensController`
     * injection mechanism and preserves all injection semantics.
     *
     * ---------------------------------------------------------------------
     * 🔷 INJECTION MODEL
     * ---------------------------------------------------------------------
     *
     * Injection mutates the underlying token stream without affecting:
     *
     * - current token
     * - cursor position
     * - traversal progress
     *
     * Injected tokens become part of the *future unread stream* and will
     * be consumed naturally during traversal.
     *
     * ---------------------------------------------------------------------
     * 🔷 SUPPORTED FORMS
     * ---------------------------------------------------------------------
     *
     * This method supports all controller injection modes:
     *
     * ### 1. Cursor-relative injection (default)
     *
     * ```ts
     * inject(tokens)
     * ```
     *
     * Inserts tokens immediately after the current cursor position.
     *
     * ---
     *
     * ### 2. Position-based injection
     *
     * ```ts
     * inject(tokens, { at: number })
     * ```
     *
     * Inserts tokens at an absolute stream index greater than the cursor.
     *
     * ---
     *
     * ### 3. Anchor-based injection
     *
     * ```ts
     * inject(tokens, { at: AnchorToken | symbol })
     * ```
     *
     * Resolves an anchor in the active (unconsumed) stream and inserts
     * tokens immediately after it.
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEES
     * ---------------------------------------------------------------------
     *
     * - Cursor is never modified
     * - Current token is never modified
     * - Injection affects only future traversal
     *
     * ---------------------------------------------------------------------
     * 🔷 EMPTY INPUT
     * ---------------------------------------------------------------------
     *
     * Empty arrays are ignored and no mutation occurs.
     *
     * ---------------------------------------------------------------------
     * @param args
     * Forwarded arguments to `TokensController.inject`.
     *
     * @since 1.0.0
     */
    inject(...args: Parameters<TokensController['inject']>): void {
        this.#_controller.inject(...args);
    }

    /**
     * Peeks ahead in the traversal stream without consuming tokens.
     *
     * This method provides non-mutating lookahead relative to the
     * current traversal position.
     *
     * ---------------------------------------------------------------------
     * 🔷 OFFSET SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Offset values are relative to the current token:
     *
     * - `1`
     *   Next unread token
     *
     * - `2`
     *   Token after next
     *
     * - `0`
     *   Current token
     *
     * ---------------------------------------------------------------------
     * 🔷 OUT-OF-BOUNDS BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * Returns `null` if the computed lookup position falls outside the
     * active traversal stream.
     *
     * This method never throws.
     *
     * ---------------------------------------------------------------------
     * @param offset
     * Relative token offset from the current traversal position.
     * Defaults to `1`.
     *
     * @returns Token at the requested relative position or `null`
     *
     * @since 1.0.0
     */
    peek(offset = 1): Token | null {
        return this.#_controller.peek(offset);
    }
}

export default TokensRuntime;