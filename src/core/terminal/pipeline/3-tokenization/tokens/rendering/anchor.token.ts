import BaseToken from "../assets/__base.token__";

/**
 * Stream-local insertion and lookup marker.
 *
 * `AnchorToken` represents a non-rendering reference point inside the
 * token stream that can later be used by traversal and mutation systems
 * to locate a deterministic insertion position.
 *
 * Anchors are primarily intended for deferred stream manipulation such as:
 *
 * - injecting tokens at a future location
 * - locating structural boundaries
 * - coordinating rendering across disconnected sections
 * - replacing fragile index-based insertion logic
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * Unlike structural tokens, an anchor does not contribute to rendered
 * output. Its sole responsibility is to act as a stable reference within
 * the token stream.
 *
 * Typical usage:
 *
 * ```ts
 * const anchor = new AnchorToken("set:end");
 *
 * tokens.inject([
 *     ...prefix,
 *     anchor,
 *     ...suffix
 * ]);
 *
 * tokens.injectAt(extraTokens, anchor);
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY
 * ---------------------------------------------------------------------
 *
 * Every anchor owns a unique identifier that remains stable for the
 * lifetime of the token instance.
 *
 * Consumers should use the anchor instance (or its id) as the canonical
 * insertion reference rather than relying on stream indexes, which may
 * change as tokens are injected or removed.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE LABEL
 * ---------------------------------------------------------------------
 *
 * Every anchor carries a human-readable purpose string describing the
 * reason the anchor exists within the token stream.
 *
 * The purpose:
 *
 * - is intended exclusively for debugging and diagnostics
 * - is never interpreted by rendering systems
 * - does not participate in anchor identity
 * - is not required to be unique
 *
 * Example values:
 *
 * - `"set:end"`
 * - `"map:entries"`
 * - `"error:stack-close"`
 *
 * Consumers must not rely on the purpose value for stream traversal,
 * lookup, insertion, or rendering behavior.
 * 
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class AnchorToken extends BaseToken<'anchor'> {
    /**
     * Unique identifier for this anchor instance.
     *
     * This identifier is used by stream mutation systems to locate and
     * target a specific anchor regardless of its current position in the
     * token stream.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol = Symbol('anchor');

    /**
     * Human-readable description of the anchor's intended purpose.
     *
     * This value exists exclusively for diagnostics and debugging and is
     * not interpreted by the rendering pipeline.
     *
     * @since 1.0.0
     */
    readonly #_purpose: string;

    /**
     * Creates a new anchor token.
     *
     * @param purpose
     * Human-readable label describing the intended role of the anchor
     * within the token stream.
     *
     * @since 1.0.0
     */
    constructor(purpose: string) {
        super('anchor');
        this.#_purpose = purpose;
    }

    /**
     * Unique identifier of this anchor instance.
     *
     * @since 1.0.0
     */
    get id(): symbol { return this.#_id; }

    /**
     * Human-readable purpose label associated with this anchor.
     *
     * @since 1.0.0
     */
    get purpose(): string { return this.#_purpose; }
}