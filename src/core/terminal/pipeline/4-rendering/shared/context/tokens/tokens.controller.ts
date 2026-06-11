import { AnchorToken } from "../../../../3-tokenization/tokens/rendering/anchor.token";
import { Token } from "../../../../3-tokenization/types";
import type { TokenEntry } from "./types";

/**
 * Mutable streaming token traversal controller.
 *
 * `TokensController` provides deterministic sequential access
 * over a token stream while supporting controlled runtime mutation
 * through token injection and rollback.
 *
 * It is designed specifically for rendering and transformation
 * pipelines where tokens may need to be:
 *
 * - traversed incrementally
 * - inspected ahead-of-time
 * - dynamically expanded
 * - temporarily injected
 * - reverted during speculative rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAVERSAL MODEL
 * ---------------------------------------------------------------------
 *
 * The controller uses a cursor-based traversal model.
 *
 * The internal cursor always points to the:
 *
 * > most recently consumed token
 *
 * This means:
 *
 * - before traversal starts:
 *   - cursor = -1
 *   - current = null
 *
 * - after calling `next()`:
 *   - cursor advances first
 *   - returned token becomes `current`
 *
 * Example:
 *
 * ```txt
 * cursor = -1
 *
 * next()
 *
 * cursor = 0
 * current = token[0]
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT CURSOR SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The cursor represents:
 *
 * > "the token already consumed"
 *
 * NOT:
 *
 * > "the next unread token"
 *
 * This distinction is critical for rollback behavior.
 *
 * Example:
 *
 * ```txt
 * next() consumed token[0]
 * cursor = 0
 *
 * speculative scope created here
 * ```
 *
 * If the scope aborts and traversal must restart from `token[0]`,
 * rollback must restore:
 *
 * ```txt
 * cursor = -1
 * ```
 *
 * because the traversal loop will call `next()` again.
 *
 * Rollback therefore restores the cursor to:
 *
 * > the position BEFORE the desired restart token
 *
 * ---------------------------------------------------------------------
 * 🔷 STREAM BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Tokens are consumed sequentially using `next()`.
 *
 * Example:
 *
 * ```ts
 * controller.next(); // token[0]
 * controller.next(); // token[1]
 * controller.current // token[1]
 * ```
 *
 * The controller behaves similarly to a streaming iterator,
 * but additionally supports:
 *
 * - lookahead (`peek`)
 * - runtime token insertion (`inject`)
 * - speculative rollback (`rollbackBefore`)
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN INJECTION
 * ---------------------------------------------------------------------
 *
 * Tokens may be inserted dynamically into the stream during traversal.
 *
 * Injection does NOT mutate traversal state:
 *
 * - the cursor is never modified
 * - the current token is never modified
 *
 * Instead, injection mutates the *future unread portion* of the stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 INJECTION POSITIONING
 * ---------------------------------------------------------------------
 *
 * Injection supports deterministic placement via `inject(tokens, { at })`.
 *
 * ### Default behavior
 *
 * If no `at` option is provided:
 *
 * - tokens are inserted immediately after the current cursor
 * - they become the next tokens to be consumed
 *
 * ```txt
 * [A, B, C]
 *  ^ cursor = A
 *
 * inject(X)
 *
 * [A, X, B, C]
 * ```
 *
 * ---------------------------------------------------------------------
 * ### Explicit numeric index
 *
 * ```ts
 * inject(tokens, { at: number })
 * ```
 *
 * - inserts tokens at the given absolute index
 * - index must be strictly greater than the current cursor
 *
 * This allows deterministic insertion into the *unconsumed region*
 * of the stream.
 *
 * ---------------------------------------------------------------------
 * ### Anchor-based injection
 *
 * ```ts
 * inject(tokens, { at: AnchorToken | symbol })
 * ```
 *
 * - resolves the first matching anchor in the *unconsumed stream*
 * - inserts tokens immediately after the anchor
 *
 * Example:
 *
 * ```txt
 * [A, anchor, C]
 *      ^
 *
 * inject(B, { at: anchor })
 *
 * [A, anchor, B, C]
 * ```
 *
 * Anchors act as stable structural references for injection points
 * in otherwise index-unstable streams.
 *
 * ---------------------------------------------------------------------
 * 🔷 SEMANTIC GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Injection is purely structural:
 *
 * - it does NOT consume tokens
 * - it does NOT advance traversal
 * - it does NOT remove or replace anchors
 *
 * Injected tokens are simply placed into the future stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 USE CASES
 * ---------------------------------------------------------------------
 *
 * This model enables:
 *
 * - speculative rendering expansion
 * - envelope boundary injection (start/end wrapping)
 * - deferred structural synthesis
 * - dynamic token expansion (sets, maps, objects)
 * - anchor-driven stream composition
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLLBACK MODEL
 * ---------------------------------------------------------------------
 *
 * The controller supports transactional rollback through
 * `rollbackBefore(cursor)`.
 *
 * Rollback removes:
 *
 * - injected tokens added after a checkpoint
 *
 * while preserving:
 *
 * - original immutable source tokens
 *
 * This enables speculative rendering scopes where temporary
 * injected tokens can be discarded safely.
 *
 * ---------------------------------------------------------------------
 * 🔷 LOOKAHEAD MODEL
 * ---------------------------------------------------------------------
 *
 * The controller supports non-mutating lookahead using `peek()`.
 *
 * Unlike `next()`, peeking:
 *
 * - does not advance the cursor
 * - does not modify traversal state
 * - allows future-token inspection
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The internal token array is mutable internally but isolated
 * from external mutation.
 *
 * The constructor wraps all provided tokens into immutable-origin
 * `TokenEntry` structures.
 *
 * This guarantees:
 *
 * - traversal stability
 * - predictable rollback semantics
 * - immutable external ownership
 * - origin-aware mutation tracking
 *
 * ---------------------------------------------------------------------
 * 🔷 EOF SEMANTICS
 * ---------------------------------------------------------------------
 *
 * End-of-stream is represented using `null`.
 *
 * The following methods may return `null`:
 *
 * - `current`
 * - `next`
 * - `peek`
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
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

    _debug() {
        console.debug(this.#_tokens.map(t => t.reference.kind));
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
     * The injected tokens become the next tokens to be consumed by traversal.
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
     * - Inserts tokens at the specified index in the token stream
     * - Must be strictly greater than the current cursor position
     *
     * ### 2. AnchorToken instance
     *
     * ```ts
     * inject(tokens, { at: AnchorToken })
     * ```
     *
     * - Locates the first matching anchor token in the stream
     * - Inserts tokens immediately after the anchor
     *
     * ### 3. Anchor symbol id
     *
     * ```ts
     * inject(tokens, { at: symbol })
     * ```
     *
     * - Resolves an anchor by its internal symbol identifier
     * - Inserts tokens immediately after the resolved anchor
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEES
     * ---------------------------------------------------------------------
     *
     * - The current cursor is never modified
     * - The current token is never modified
     * - Injection only affects *future traversal*
     *
     * ---------------------------------------------------------------------
     * 🔷 ANCHOR RESOLUTION RULES
     * ---------------------------------------------------------------------
     *
     * - Anchor lookup always starts after the current cursor
     * - Only anchors appearing in the *unconsumed portion* of the stream
     *   are eligible for resolution
     * - The first match is used
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
     *   reference: Token
     * }
     * ```
     *
     * This allows:
     *
     * - rollback filtering
     * - debugging injected vs native tokens
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

        // Inject after the current cursor
        this.#_tokens.splice(insertIndex, 0, ...input.map(t => {
            return {
                origin: 'injected',
                reference: t,
            } as TokenEntry;
        }));

        return this;
    }

    /**
     * Peeks into the token stream without mutating traversal state.
     *
     * Offsets are relative to the current cursor.
     *
     * ---------------------------------------------------------------------
     * 🔷 OFFSET RULES
     * ---------------------------------------------------------------------
     *
     * `peek(1)`
     *   Next unread token.
     *
     * `peek(0)`
     *   Current token.
     *
     * `peek(2)`
     *   Token after next.
     *
     * ---------------------------------------------------------------------
     * 🔷 OUT OF BOUNDS
     * ---------------------------------------------------------------------
     *
     * Returns `null` if:
     *
     * - index < 0
     * - index >= token count
     *
     * ---------------------------------------------------------------------
     * @param offset
     * Relative offset from current cursor.
     *
     * @returns Peeked token or `null`
     *
     * @since 1.0.0
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
     * This operation:
     *
     * - removes injected tokens after the rollback boundary
     * - preserves original tokens
     * - restores traversal cursor state
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT CURSOR SEMANTICS
     * ---------------------------------------------------------------------
     *
     * The provided cursor value represents:
     *
     * > the cursor state BEFORE traversal should resume
     *
     * Example:
     *
     * To re-read token at index `0`,
     * rollback MUST target:
     *
     * ```txt
     * cursor = -1
     * ```
     *
     * because `next()` increments before reading.
     *
     * ---------------------------------------------------------------------
     * 🔷 REMOVAL RULES
     * ---------------------------------------------------------------------
     *
     * During rollback:
     *
     * - injected tokens are removed
     * - original tokens remain intact
     *
     * This guarantees deterministic restoration of the source stream.
     *
     * ---------------------------------------------------------------------
     * @param cursor
     * Cursor state to restore.
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

            if (token.origin === 'injected') {
                this.#_tokens.splice(i, 1);
            }
        }

        this.#_cursor = Math.max(-1, normalized - 1);
    }
}

export default TokensController;