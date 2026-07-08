import type { Token } from "../../../../3-tokenization/types";
import TokensController from "./tokens.controller";

/**
 * Public renderer-facing token traversal runtime.
 *
 * `TokensRuntime` exposes a safe, restricted façade over the internal
 * `TokensController`, which owns the actual mutation + traversal engine.
 *
 * It is the primary interface used by renderers to consume and
 * opportunistically modify a token stream during rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This runtime exists as a strict abstraction boundary between:
 *
 * - low-level traversal mechanics (`TokensController`)
 * - renderer execution logic
 *
 * Renderers interact exclusively with this runtime and must never
 * access the controller directly.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * This runtime enforces a **forward-only traversal model** while still
 * allowing controlled structural mutation.
 *
 * It intentionally hides internal mechanics such as:
 *
 * - cursor mutation logic
 * - stream storage structure
 * - rollback / transactional history
 * - injection bookkeeping rules
 *
 * This ensures renderers remain deterministic and do not couple to
 * internal execution semantics.
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAVERSAL MODEL
 * ---------------------------------------------------------------------
 *
 * Tokens are consumed strictly in forward order via `next()`.
 *
 * Each call to `next()`:
 *
 * - advances the cursor
 * - updates `current`
 * - returns the next available token (including injected tokens)
 *
 * The runtime guarantees deterministic ordering of consumption, but
 * does not guarantee stability of absolute indices due to injection.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTATION MODEL (INJECTION ONLY)
 * ---------------------------------------------------------------------
 *
 * Renderers may inject tokens dynamically into the *future stream*.
 *
 * Injection is always:
 *
 * - forward-looking (never retroactive)
 * - non-destructive to already-consumed tokens
 * - integrated into the same traversal stream
 *
 * Injected tokens are treated as first-class stream elements and will
 * be consumed naturally via `next()`.
 *
 * ⚠️ Important:
 * Injection does NOT modify previously returned tokens and does NOT
 * retroactively alter traversal history.
 *
 * ---------------------------------------------------------------------
 * 🔷 FORBIDDEN OPERATIONS
 * ---------------------------------------------------------------------
 *
 * Renderers cannot:
 *
 * - rollback traversal state
 * - modify cursor position directly
 * - access raw token storage
 * - remove or rewrite already-consumed tokens
 *
 * These capabilities are reserved for higher-level orchestration layers
 * (e.g. normalization builder runtimes).
 *
 * ---------------------------------------------------------------------
 * 🔷 TRANSACTIONAL SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * This runtime is explicitly **non-transactional**.
 *
 * It provides:
 *
 * - forward-only consumption
 * - forward-only injection
 *
 * It does NOT provide:
 *
 * - rollback
 * - speculative execution
 * - buffered mutation
 * - structural rewinding
 *
 * Any transactional behavior is implemented in higher-level runtimes
 * such as `TokensRuntimeBuilder`.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The cursor represents the index of the most recently consumed token.
 *
 * Cursor values:
 *
 * - `-1` → traversal has not started
 * - `0`  → first token consumed
 * - `n`  → last consumed token index
 *
 * Injection defaults to:
 *
 * ```ts
 * inject(tokens)
 * // equivalent to:
 * inject(tokens, { at: cursor + 1 })
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 INJECTION MODEL
 * ---------------------------------------------------------------------
 *
 * Injection supports three modes:
 *
 * 1. Cursor-relative insertion
 *    - inserts immediately after current position
 *
 * 2. Absolute insertion
 *    - inserts at a specific stream index
 *
 * 3. Anchor-based insertion
 *    - resolves symbolic positions in the stream
 *
 * Injection is guaranteed to affect only **future traversal order**.
 *
 * It does NOT:
 *
 * - modify `current`
 * - modify already-consumed tokens
 * - alter past traversal results
 *
 * ---------------------------------------------------------------------
 * 🔷 OUT-OF-SCOPE CONCERNS
 * ---------------------------------------------------------------------
 *
 * This runtime does NOT define:
 *
 * - grouping semantics
 * - layout decisions
 * - rendering rules
 * - token interpretation
 *
 * It only provides traversal + controlled mutation primitives.
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
     * Internal token traversal controller.
     *
     * This controller is intentionally hidden from renderers to preserve:
     *
     * - abstraction boundaries
     * - deterministic traversal guarantees
     * - controlled mutation semantics
     *
     * @since 1.0.0
     */
    constructor(controller: TokensController) {
        this.#_controller = controller;
    }

    /**
     * Current traversal cursor position.
     *
     * The cursor represents the index of the most recently consumed token
     * in the active stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR SEMANTICS
     * ---------------------------------------------------------------------
     *
     * The cursor is strictly a **consumption pointer**, not a structural index.
     *
     * It tracks *what has been read*, not what exists in the underlying stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR STATES
     * ---------------------------------------------------------------------
     *
     * - `-1` → traversal has not started
     * - `0`  → first token has been consumed
     * - `n`  → token at index `n` was last returned by `next()`
     *
     * ---------------------------------------------------------------------
     * 🔷 RELATION TO STREAM MUTATION
     * ---------------------------------------------------------------------
     *
     * The stream may change due to injection, but:
     *
     * - cursor NEVER rewinds automatically
     * - cursor NEVER reindexes
     * - cursor ALWAYS refers to consumption history
     *
     * This is critical for deterministic traversal in mutable streams.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANT
     * ---------------------------------------------------------------------
     *
     * Cursor guarantees:
     *
     * > If token A was consumed before token B, cursor(A) < cursor(B)
     *
     * regardless of later injections.
     *
     * ---------------------------------------------------------------------
     * @returns Index of last consumed token
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
     * ---------------------------------------------------------------------
     * 🔷 CORE SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Injection mutates the **future unread portion** of the stream.
     *
     * Injected tokens become part of traversal order and will be returned
     * by `next()` in deterministic sequence.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Injection NEVER affects:
     *
     * - already consumed tokens
     * - current cursor state
     * - previously returned values
     *
     * It only affects **future traversal resolution**.
     *
     * ---------------------------------------------------------------------
     * 🔷 INJECTION MODES
     * ---------------------------------------------------------------------
     *
     * ### 1. Cursor-relative (default)
     *
     * ```ts
     * runtime.inject(tokens);
     * ```
     *
     * Inserts tokens immediately after the current cursor position.
     *
     * ---
     *
     * ### 2. Absolute index injection
     *
     * ```ts
     * runtime.inject(tokens, { at: 10 });
     * ```
     *
     * Inserts tokens at a fixed stream position (post-resolution).
     *
     * ---
     *
     * ### 3. Anchor-based injection
     *
     * ```ts
     * runtime.inject(tokens, { at: anchor });
     * ```
     *
     * Resolves a symbolic position inside the active stream and inserts
     * tokens immediately after it.
     *
     * ---------------------------------------------------------------------
     * 🔷 ORDERING GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Injection guarantees:
     *
     * - deterministic placement relative to controller rules
     * - stable ordering among multiple injections at same anchor
     * - no reordering of already-consumed tokens
     *
     * It does NOT guarantee:
     *
     * - stable absolute indices across mutations
     * - persistence of original source indices
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * runtime.next(); // "a"
     * runtime.inject(["X"]);
     * runtime.next(); // "X"
     * runtime.next(); // "b"
     * ```
     *
     * ---------------------------------------------------------------------
     * @param args
     * Forwarded directly to TokensController.inject
     */
    inject(...args: Parameters<TokensController['inject']>): void {
        this.#_controller.inject(...args);
    }

    /**
     * Peeks into the token stream relative to the current cursor position
     * without consuming tokens.
     *
     * ---------------------------------------------------------------------
     * 🔷 CORE BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * `peek()` provides a **relative window view** over the active stream.
     *
     * It does NOT mutate traversal state and does NOT advance the cursor.
     *
     * It can access:
     *
     * - future tokens (positive offsets)
     * - current token (0 offset)
     * - previously consumed tokens (negative offsets)
     *
     * ---------------------------------------------------------------------
     * 🔷 OFFSET SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Offsets are relative to the **current cursor position**:
     *
     * - `0`  → current token (last consumed)
     * - `1`  → next token in stream
     * - `2`  → token after next
     * - `-1` → previous token
     * - `-2` → two tokens before current
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLES
     * ---------------------------------------------------------------------
     *
     * ```ts
     * runtime.next(); // consumes "A"
     * runtime.next(); // consumes "B"
     *
     * runtime.peek(0);  // "B"
     * runtime.peek(-1); // "A"
     * runtime.peek(1);  // next unread token
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 INJECTION AWARENESS
     * ---------------------------------------------------------------------
     *
     * Peek operates on the **live stream**, meaning:
     *
     * - injected tokens are visible
     * - removed/ignored tokens may still exist structurally
     * - ordering reflects controller state, not original array indices
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * - never mutates cursor
     * - never consumes tokens
     * - never throws on out-of-bounds (returns `null`)
     *
     * ---------------------------------------------------------------------
     * @param offset
     * Relative offset from current cursor position.
     *
     * Defaults to `1` if omitted.
     *
     * @returns Token at relative position or `null`
     */
    peek(offset = 1): Token | null {
        return this.#_controller.peek(offset);
    }

    /**
     * Debug / introspection utility for token stream state.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Provides a non-runtime representation of the internal controller
     * state for debugging, testing, and diagnostics.
     *
     * ---------------------------------------------------------------------
     * 🔷 STABILITY WARNING
     * ---------------------------------------------------------------------
     *
     * This method is NOT part of the stable runtime contract.
     *
     * Output format may change without semantic versioning guarantees.
     *
     * ---------------------------------------------------------------------
     * 🔷 ORIGIN MARKERS
     * ---------------------------------------------------------------------
     *
     * When `as = 'with-origin'`, tokens include origin metadata:
     *
     * - `O` → original stream token
     * - `I` → injected token
     *
     * These markers are intended for debugging only and must not be used
     * for rendering decisions.
     *
     * ---------------------------------------------------------------------
     * @returns Token kind list or annotated debug representation
     *
     * @since 1.0.0
     */
    static inspect<
        T extends 'raw' | 'with-origin'
    >(
        ct: TokensRuntime,
        as?: T
    ): T extends 'with-origin' ? `${Token['kind']}:${'O' | 'I'}`[] : Token['kind'][] {
        return TokensController.inspect(ct.#_controller, as);
    }
}

export default TokensRuntime;