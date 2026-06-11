import type { ErrorStartToken } from "../../../../3-tokenization/tokens/tokenization/error";
import type { Token } from "../../../../3-tokenization/types";

export const ERROR_SECTIONS = ['name', 'message', 'cause', 'stack'] as const;

type ErrorSection = typeof ERROR_SECTIONS[number];
type ErrorData = { groupId: symbol; closed: boolean }

/**
 * Internal tracking cache for structured error rendering sections.
 *
 * `ErrorCache` is responsible for coordinating lifecycle state across
 * multiple logical sections of an error during rendering:
 *
 * - name
 * - message
 * - cause
 * - stack
 *
 * Each section is represented by a token group and may be opened once
 * and later "consumed" (closed) exactly once during rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * This class exists to:
 *
 * - Ensure deterministic ordering of error section group closures
 * - Prevent duplicate section tracking
 * - Provide safe id-based matching for nested group tokens
 * - Track whether a section has already been consumed
 *
 * It is strictly scoped to a single error instance and must not be reused
 * across different error tokens.
 *
 * ---------------------------------------------------------------------
 * 🔷 SECTION LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * Each section goes through the following states:
 *
 * 1. **Untracked**
 *    - section not yet registered
 *
 * 2. **Tracked**
 *    - section registered via `track()`
 *    - group id stored
 *    - not yet consumed
 *
 * 3. **Consumed**
 *    - section marked as closed via `consume()`
 *    - group id returned for closing token emission
 *
 * ---------------------------------------------------------------------
 * 🔷 CONSUMPTION SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The `consume()` method:
 *
 * - marks the section as closed if not already closed
 * - returns the associated group id
 * - enforces single-consumption semantics per section
 *
 * Re-consuming a section is safe but idempotent in terms of state change.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - A section can only be tracked once
 * - Only tracked sections can be consumed
 * - Consumption is tracked per section independently
 * - Error identity is immutable for the lifetime of the cache
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ErrorCache {
    /**
     * Unique identifier of the error instance this cache belongs to.
     *
     * Used to ensure that tokens being processed belong to the same
     * logical error scope during rendering.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol;

    /**
     * Internal registry of tracked error sections.
     *
     * Maps each section name to:
     *
     * - its associated group id
     * - whether it has been consumed (closed)
     *
     * @internal
     */
    readonly #_data = new Map<ErrorSection, ErrorData>();

    /**
     * Internal list of trailing tokens used to close error sections
     * during rendering.
     *
     * These tokens represent the *structural end markers* for error
     * subsections (e.g. stack, cause, message).
     *
     * They are not mutated by the cache and are treated as a static
     * rendering resource provided at construction time.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_closeTokens: Token[];

    /**
     * Creates a new error tracking cache for a given error token.
     *
     * @param error
     * The error start token that defines the identity of this cache.
     *
     * The token's `id` is used as the canonical error identifier for
     * all tracked sections.
     *
     * @param closeTokens
     * A static list of trailing tokens used to emit closing boundaries
     * for error sections during rendering.
     *
     * These tokens are not modified by the cache. They act as structural
     * markers consumed by the renderer after section lifecycle completion.
     *
     * @since 1.0.0
     */
    constructor(error: ErrorStartToken, closeTokens: Token[]) {
        this.#_id = error.id;
        this.#_closeTokens = closeTokens;
    }

    /**
     * Registers a new error section for tracking.
     *
     * Each section can only be registered once per cache instance.
     *
     * @param section
     * Logical error section name (e.g. `"name"`, `"message"`).
     *
     * @param id
     * The group id associated with the section's token boundary.
     *
     * @throws
     * If the section has already been tracked.
     * If the section is an invalid section name.
     *
     * @since 1.0.0
     */
    track(section: ErrorSection, id: symbol): void {
        if (this.#_data.has(section)) {
            throw new Error(`section "${section}" already tracked`);
        }

        if (!ERROR_SECTIONS.includes(section)) {
            throw new Error(`invalid section "${section}"`);
        }

        this.#_data.set(section, { groupId: id, closed: false });
    }

    /**
     * Checks whether a section has been registered in this cache.
     *
     * This does NOT indicate whether the section has been consumed.
     *
     * @param section
     * The section to check.
     *
     * @returns
     * `true` if the section is tracked, otherwise `false`.
     *
     * @since 1.0.0
     */
    isRegistered(section: ErrorSection): boolean {
        return this.#_data.has(section);
    }

    /**
     * Checks whether a section has already been consumed (closed).
     *
     * A section is considered consumed after its group has been closed
     * via `consume()`.
     *
     * @param section
     * The section to check.
     *
     * @returns
     * `true` if the section has been consumed, otherwise `false`.
     *
     * @since 1.0.0
     */
    isConsumed(section: ErrorSection): boolean {
        const data = this.#_data.get(section);

        return data ? data.closed : false;
    }

    /**
     * Consumes a tracked error section and returns its group identifier.
     *
     * This method:
     *
     * - marks the section as consumed (if not already)
     * - returns the associated group id for closing tokens
     *
     * @param section
     * The section to consume.
     *
     * @returns
     * The group id associated with the section.
     *
     * @throws
     * If the section has not been previously tracked.
     * If the section is an invalid section name.
     *
     * @since 1.0.0
     */
    consume(section: ErrorSection): symbol {
        if (!ERROR_SECTIONS.includes(section)) {
            throw new Error(`invalid section "${section}"`);
        }

        if (!this.isRegistered(section)) {
            throw new Error(`section "${section}" not tracked`);
        }

        const data = this.#_data.get(section)!;

        if (!data.closed) {
            data.closed = true;
        }

        return data.groupId;
    }

    /**
     * Returns the unique identifier of the error instance.
     *
     * This id is used to ensure that all tracked sections belong to the
     * same logical error during rendering.
     *
     * @since 1.0.0
     */
    get errorId(): symbol { return this.#_id; }

    /**
     * Returns the trailing tokens used for closing error sections.
     *
     * These tokens define the structural end of error rendering segments
     * (such as message, cause, stack) and are emitted after section
     * consumption is complete.
     *
     * The returned array is the same reference provided at construction
     * time and is not modified by this cache.
     *
     * @returns
     * The static list of closing tokens associated with this error cache.
     *
     * @since 1.0.0
     */
    get closeTokens(): Token[] { return this.#_closeTokens; }
}

export default ErrorCache;