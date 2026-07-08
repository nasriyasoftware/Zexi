import { AnchorToken } from "../../../../3-tokenization/tokens/rendering/anchor.token";
import { Token } from "../../../../3-tokenization/types";
import type { TokenEntry } from "./types";

class TokensController {
    /**
     * Internal mutable traversal stream.
     *
     * Each token is wrapped in a `TokenEntry` describing:
     *
     * - origin semantics
     * - rollback eligibility
     * - traversal ownership
     *
     * The array itself is mutable to support:
     *
     * - token injection
     * - rollback cleanup
     * - speculative expansion
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT
     * ---------------------------------------------------------------------
     *
     * This array MUST preserve ordering invariants.
     *
     * Rollback correctness depends on deterministic token order.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_tokens: TokenEntry[];

    /**
     * Internal traversal cursor.
     *
     * The cursor points to the most recently consumed token.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR STATES
     * ---------------------------------------------------------------------
     *
     * `-1`
     *   Traversal has not started yet.
     *
     * `0`
     *   First token has been consumed.
     *
     * `n`
     *   Token at index `n` is the current token.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT SEMANTIC RULE
     * ---------------------------------------------------------------------
     *
     * The cursor represents:
     *
     * > "current token position"
     *
     * NOT:
     *
     * > "next unread token"
     *
     * This distinction is critical for rollback correctness.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLLBACK IMPLICATION
     * ---------------------------------------------------------------------
     *
     * To re-read token at index `0`,
     * rollback must restore:
     *
     * ```txt
     * cursor = -1
     * ```
     *
     * because `next()` increments before reading.
     *
     * ---------------------------------------------------------------------
     * @default -1
     * @since 1.0.0
     */
    #_cursor = -1

    /**
     * Creates a new token traversal controller.
     *
     * The provided token stream is transformed into internal
     * `TokenEntry` records with:
     *
     * ```ts
     * {
     *   origin: 'original',
     *   reference: token
     * }
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT
     * ---------------------------------------------------------------------
     *
     * Tokens themselves are NOT cloned.
     *
     * The controller preserves token identity semantics.
     *
     * Only the container array is recreated.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIAL STATE
     * ---------------------------------------------------------------------
     *
     * Immediately after construction:
     *
     * ```txt
     * cursor = -1
     * current = null
     * ```
     *
     * No token is considered consumed until `next()` is called.
     *
     * ---------------------------------------------------------------------
     * @param tokens
     * Initial immutable token stream.
     *
     * @since 1.0.0
     */
    constructor(tokens: readonly Token[]) {
        this.#_tokens = tokens.map(t => {
            return {
                origin: 'original',
                reference: t,
            } as TokenEntry;
        });
    }

    /**
     * Current traversal cursor position.
     *
     * The cursor represents the index of the most recently consumed token
     * in the internal token stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR SEMANTICS
     * ---------------------------------------------------------------------
     *
     * The cursor is not a "next index" pointer. Instead, it follows a
     * strict **current-token model**:
     *
     * - `-1`
     *   No tokens have been consumed yet.
     *
     * - `0`
     *   The first token has been consumed and is the current token.
     *
     * - `n`
     *   Token at index `n` is the current active token.
     *
     * This design ensures deterministic rendering behavior where:
     *
     * > the cursor always reflects the last returned token from `next()`
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLLBACK COMPATIBILITY
     * ---------------------------------------------------------------------
     *
     * The cursor is the primary reference point for rollback operations.
     *
     * When rolling back:
     *
     * - the controller restores the cursor to a previous state
     * - subsequent traversal resumes from `cursor + 1` via `next()`
     *
     * This guarantees that rollback correctly resets traversal without
     * re-consuming or skipping tokens.
     *
     * ---------------------------------------------------------------------
     * 🔷 RELATION TO ARRAY INDEX
     * ---------------------------------------------------------------------
     *
     * Although internally backed by an array index, the cursor should be
     * understood as a **logical traversal state**, not a raw array pointer.
     *
     * This distinction is important because:
     *
     * - injected tokens can shift underlying storage
     * - rollback may remove injected entries
     * - traversal correctness depends on cursor semantics, not raw indices
     *
     * ---------------------------------------------------------------------
     * @returns
     * The index of the most recently consumed token, or `-1` if traversal
     * has not started.
     *
     * @since 1.0.0
     */
    get cursor(): number {
        return this.#_cursor;
    }

    /**
     * Returns the current token at the cursor.
     *
     * The current token is:
     *
     * - the most recently consumed token
     * - `null` before traversal begins
     *
     * This getter is non-mutating.
     *
     * ---------------------------------------------------------------------
     * @returns Current token or `null`
     *
     * @since 1.0.0
     */
    get current(): Token | null {
        return this.#_cursor < 0
            ? null
            : this.#_tokens[this.#_cursor].reference;
    }

    /**
     * Determines whether unread tokens remain.
     *
     * This method checks whether calling `next()`
     * would successfully advance traversal.
     *
     * ---------------------------------------------------------------------
     * @returns `true` if another token exists
     *
     * @since 1.0.0
     */
    hasNext(): boolean {
        return this.#_cursor + 1 < this.#_tokens.length;
    }

    /**
     * Advances traversal and consumes the next token.
     *
     * Behavior:
     *
     * 1. cursor advances
     * 2. current token updates
     * 3. token is returned
     *
     * ---------------------------------------------------------------------
     * 🔷 EOF BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * If traversal has reached end-of-stream:
     *
     * - returns `null`
     * - cursor remains unchanged
     *
     * ---------------------------------------------------------------------
     * @returns Next token or `null`
     *
     * @since 1.0.0
     */
    next(): Token | null {
        if (!this.hasNext()) {
            return null;
        }

        return this.#_tokens[++this.#_cursor].reference;
    }

    /**
     * Injects one or more tokens into the traversal stream.
     *
     * Injection inserts tokens into the underlying token sequence at a
     * deterministic position relative to the current traversal state.
     *
     * ---------------------------------------------------------------------
     * 🔷 CORE PURPOSE
     * ---------------------------------------------------------------------
     *
     * Injection allows the normalization/runtime layer to *safely extend*
     * the token stream during traversal without mutating original tokens.
     *
     * Injected tokens are:
     *
     * - tracked explicitly via `TokenEntry.origin = 'injected'`
     * - bound to a snapshot cursor position
     * - eligible for deterministic rollback
     *
     * This enables:
     *
     * - speculative structure expansion
     * - group-based transformations
     * - rollback-safe stream rewriting
     *
     * ---------------------------------------------------------------------
     * 🔷 DEFAULT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When no options are provided, tokens are injected immediately after
     * the current cursor position:
     *
     * ```txt
     * cursor → insert point → next tokens
     * ```
     *
     * The injected tokens become part of the *future traversal stream*.
     *
     * ---------------------------------------------------------------------
     * 🔷 INJECTION MODES
     * ---------------------------------------------------------------------
     *
     * Injection position can be controlled via `options.at`:
     *
     * ### 1. Number (absolute index)
     *
     * ```ts
     * inject(tokens, { at: number })
     * ```
     *
     * - Inserts tokens at the specified index in the stream
     * - Must be strictly greater than the current cursor
     *
     * ### 2. AnchorToken instance
     *
     * ```ts
     * inject(tokens, { at: AnchorToken })
     * ```
     *
     * - Finds the first matching anchor in the unconsumed stream
     * - Inserts tokens immediately after it
     *
     * ### 3. Anchor symbol id
     *
     * ```ts
     * inject(tokens, { at: symbol })
     * ```
     *
     * - Resolves anchor by internal symbol identifier
     * - Inserts tokens immediately after resolved anchor
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEES
     * ---------------------------------------------------------------------
     *
     * - The current cursor is never modified
     * - The current token is never modified
     * - Injection only affects *future traversal*
     * - Injected tokens are always explicitly tagged with:
     *
     *   ```ts
     *   {
     *     origin: 'injected',
     *     reference: Token,
     *     cursor: number
     *   }
     *   ```
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR SEMANTICS (CRITICAL)
     * ---------------------------------------------------------------------
     *
     * Each injected token captures the cursor position at injection time.
     *
     * This cursor snapshot is used for rollback logic:
     *
     * - If a group is aborted, the runtime rewinds the cursor to the
     *   group's start boundary
     * - Any injected tokens with:
     *
     *   ```txt
     *   token.cursor >= rollbackCursor
     *   ```
     *
     *   are removed from the stream
     *
     * This guarantees:
     *
     * - deterministic rollback behavior
     * - no leakage of speculative tokens
     * - clean re-execution of group logic
     *
     * ---------------------------------------------------------------------
     * 🔷 ANCHOR RESOLUTION RULES
     * ---------------------------------------------------------------------
     *
     * - Anchor lookup always starts after the current cursor
     * - Only tokens in the unconsumed portion are eligible
     * - First match wins
     *
     * ---------------------------------------------------------------------
     * 🔷 ORIGIN TRACKING
     * ---------------------------------------------------------------------
     *
     * All injected tokens are wrapped as:
     *
     * ```ts
     * {
     *   origin: 'injected',
     *   reference: Token,
     *   cursor: number
     * }
     * ```
     *
     * This enables:
     *
     * - rollback filtering
     * - debugging injected vs original stream content
     * - deterministic reconstruction of traversal state
     *
     * ---------------------------------------------------------------------
     * @param token
     * A single token or an array of tokens to inject.
     *
     * @param options
     * Optional injection configuration.
     *
     * @param options.at
     * Determines where injection occurs:
     *
     * - `number` → absolute index (must be > cursor)
     * - `AnchorToken` → insert after matching anchor instance
     * - `symbol` → insert after anchor id
     *
     * ---------------------------------------------------------------------
     * @returns
     * The same controller instance (for chaining).
     *
     * @throws TypeError
     * If `options.at` is not a supported type.
     *
     * @throws RangeError
     * If:
     * - numeric index is ≤ cursor
     * - anchor cannot be found in the active stream
     *
     * @since 1.0.0
     */
    inject(
        token: Token | readonly Token[],
        options?: {
            at?: number | AnchorToken | symbol
        }
    ): this {
        const input = (Array.isArray(token) ? token : [token]) as Token[];

        if (input.length === 0) {
            return this;
        }

        const insertIndex = (() => {
            // Detect injection position
            if (options?.at !== undefined) {
                const at = options.at;

                if (!(
                    at instanceof AnchorToken ||
                    typeof at === 'number' ||
                    typeof at === 'symbol'
                )) {
                    throw new TypeError(`Invalid injection position. Expected AnchorToken or number, received ${typeof at}`);
                }

                if (typeof at === 'number') {
                    if (at <= this.#_cursor) {
                        throw new RangeError(`Invalid injection position. Expected number > ${this.#_cursor}, received ${at}`);
                    }

                    return at;
                }

                if (at instanceof AnchorToken || typeof at === 'symbol') {
                    const atIndex = (() => {
                        const isSymbol = typeof at === 'symbol';

                        for (let i = this.#_cursor + 1; i < this.#_tokens.length; i++) {
                            const t = this.#_tokens[i];

                            if (isSymbol) {
                                const ref = t.reference;

                                if (
                                    ref.kind === 'anchor' &&
                                    ref.id === at
                                ) {
                                    return i;
                                }

                                continue;
                            }

                            if (t.reference === at) {
                                return i;
                            }
                        }

                        return -1;
                    })();


                    if (atIndex === -1) {
                        throw new RangeError(`Invalid injection position. Anchor token not found.`);
                    }

                    if (atIndex <= this.#_cursor) {
                        throw new RangeError(`Invalid injection position. Anchor token index ${atIndex} is before or at cursor index ${this.#_cursor}.`);
                    }

                    return atIndex + 1;
                }
            }

            return this.#_cursor + 1;
        })();

        const toInject = input.map(t => {
            const item: TokenEntry = {
                origin: 'injected',
                cursor: this.#_cursor,
                reference: t
            };

            return item;
        });

        // Inject after the current cursor
        this.#_tokens.splice(insertIndex, 0, ...toInject);

        return this;
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
        const cursor = this.#_cursor + offset;

        return cursor < 0 || cursor >= this.#_tokens.length
            ? null
            : this.#_tokens[cursor].reference;
    }

    /**
     * Rolls traversal state back to a previous cursor position.
     *
     * This operation restores the token stream and traversal cursor to a
     * previous deterministic state, while also cleaning up invalid injected
     * mutations introduced after that point.
     *
     * ---------------------------------------------------------------------
     * 🔷 CORE SEMANTIC MODEL
     * ---------------------------------------------------------------------
     *
     * The rollback system is NOT purely positional.
     *
     * It operates on two coupled dimensions:
     *
     * 1. Position in the stream (token index)
     * 2. Causality of mutation (injection cursor timestamp)
     *
     * This ensures that rollback behaves deterministically even in the
     * presence of speculative or nested injections.
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR MEANING
     * ---------------------------------------------------------------------
     *
     * The provided `cursor` represents the state BEFORE traversal resumes.
     *
     * Example:
     *
     * ```txt
     * To re-read token at index 0:
     * rollbackBefore(-1)
     * ```
     *
     * This is required because traversal is implemented as:
     *
     * ```txt
     * next() → increments cursor → reads token
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 TOKEN CATEGORIES
     * ---------------------------------------------------------------------
     *
     * The stream contains two token origins:
     *
     * ### 1. original tokens
     * - come from the immutable input stream
     * - never removed by rollback
     *
     * ### 2. injected tokens
     * - created during traversal via `inject()`
     * - carry metadata:
     *   - origin: 'injected'
     *   - cursor: injection-time cursor snapshot
     *
     * This cursor snapshot represents the *logical moment* at which the
     * token was introduced into the stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLLBACK DELETION RULE
     * ---------------------------------------------------------------------
     *
     * During rollback, injected tokens are removed only if:
     *
     * ```txt
     * token.origin === 'injected'
     * AND
     * token.cursor >= rollbackCursor
     * ```
     *
     * This means:
     *
     * - injected tokens created *after or at* the rollback boundary are removed
     * - injected tokens created *before* the rollback boundary are preserved
     *
     * even if they appear after the rollback index in the physical array.
     *
     * ---------------------------------------------------------------------
     * 🔷 WHY CURSOR-BASED FILTERING EXISTS
     * ---------------------------------------------------------------------
     *
     * Without cursor-based filtering, rollback would incorrectly remove:
     *
     * - valid injected tokens from earlier speculative branches
     *
     * This would break:
     *
     * - nested group rewrites
     * - multi-pass injection flows
     * - speculative normalization stages
     *
     * The cursor acts as a *causal anchor*, ensuring rollback only affects
     * mutations that were introduced in the invalidated execution window.
     *
     * ---------------------------------------------------------------------
     * 🔷 EFFECT ON STREAM
     * ---------------------------------------------------------------------
     *
     * After rollback:
     *
     * - all invalid injected tokens are removed
     * - original token stream remains unchanged
     * - traversal cursor is reset to the provided boundary
     *
     * The resulting stream is guaranteed to be:
     *
     * - structurally consistent
     * - deterministic
     * - free of orphaned injected mutations
     *
     * ---------------------------------------------------------------------
     * @param cursor
     * Cursor state to restore.
     *
     * This value represents the last consumed position before traversal
     * resumes.
     *
     * @since 1.0.0
     */
    rollbackBefore(cursor: number): void {
        const normalized = Math.max(
            -1,
            Math.min(this.#_tokens.length - 1, cursor)
        );

        for (let i = this.#_tokens.length - 1; i >= normalized; i--) {
            const token = this.#_tokens[i];
            if (token === undefined) { continue }

            if (token.origin === 'injected' && token.cursor >= normalized) {
                this.#_tokens.splice(i, 1);
            }
        }

        this.#_cursor = Math.max(-1, normalized - 1);
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
        ct: TokensController,
        as?: T
    ): T extends 'with-origin' ? `${Token['kind']}:${'O' | 'I'}`[] : Token['kind'][] {
        const kinds = ct.#_tokens.map(t => {
            return as === 'with-origin'
                ? `${t.reference.kind}:${t.origin === 'original' ? 'O' : 'I'}`
                : t.reference.kind;
        });

        return kinds as (T extends 'with-origin'
            ? `${Token['kind']}:${'O' | 'I'}`[]
            : Token['kind'][]
        );
    }
}

export default TokensController;