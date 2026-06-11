/**
 * Traversal depth tracker used by rendering engines.
 *
 * `TraversalDepth` maintains the current recursive traversal depth
 * during rendering operations.
 *
 * It acts as a shared mutable state object that tracks how deeply
 * the renderer has entered nested structures such as:
 *
 * - objects
 * - arrays
 * - maps
 * - sets
 * - grouped semantic scopes
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This utility belongs to the rendering layer and is used to support:
 *
 * - indentation calculation
 * - layout decisions
 * - nested structural formatting
 * - recursion-aware rendering behavior
 *
 * It is intentionally renderer-agnostic and may be reused by:
 *
 * - terminal renderers
 * - debug renderers
 * - future structured renderers
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * `TraversalDepth` is intentionally minimal.
 *
 * The class exists to provide:
 *
 * - explicit traversal state management
 * - predictable recursion tracking
 * - safe nesting control
 * - centralized depth mutation logic
 *
 * This avoids:
 *
 * - duplicated depth counters
 * - hidden recursion state
 * - inconsistent indentation behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE MODEL
 * ---------------------------------------------------------------------
 *
 * The internal depth value represents the CURRENT traversal depth.
 *
 * Examples:
 *
 * ```text
 * Root object         → depth = 0
 * Nested object       → depth = 1
 * Deep nested array   → depth = 2
 * ```
 *
 * Depth increases BEFORE entering nested structures
 * and decreases AFTER traversal completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * The following invariants are strictly enforced:
 *
 * - depth is always ≥ 0
 * - each `increase()` must be paired with `decrease()`
 * - depth always reflects the active traversal level
 *
 * Violating these invariants indicates a renderer logic error.
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE MODEL
 * ---------------------------------------------------------------------
 *
 * Typical recursive rendering:
 *
 * ```ts
 * depth.increase();
 * render(child);
 * depth.decrease();
 * ```
 *
 * Safer usage:
 *
 * ```ts
 * try {
 *   depth.increase();
 *   render(child);
 * } finally {
 *   depth.decrease();
 * }
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR SAFETY
 * ---------------------------------------------------------------------
 *
 * Attempting to decrease below zero throws:
 *
 * ```
 * Invariant violation: cannot decrease depth below zero
 * ```
 *
 * This protects against:
 *
 * - unbalanced recursion
 * - renderer desynchronization
 * - invalid traversal state transitions
 * - indentation corruption bugs
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class TraversalDepth {

    /**
     * Internal mutable traversal depth counter.
     *
     * Represents the current recursive nesting level
     * during rendering traversal.
     *
     * The value is guaranteed to remain ≥ 0.
     *
     * @since 1.0.0
     */
    #_depth: number = 0;

    /**
     * Current traversal depth value.
     *
     * This value reflects the active nesting level
     * at the current point in traversal.
     *
     * Typical renderer usage:
     *
     * - indentation calculation
     * - nesting-aware layout decisions
     * - recursive formatting control
     *
     * ---------------------------------------------------------------------
     * 🔷 READ-ONLY CONTRACT
     * ---------------------------------------------------------------------
     *
     * Depth mutation must ONLY occur through:
     *
     * - `increase()`
     * - `decrease()`
     *
     * Direct mutation is intentionally prohibited.
     *
     * @returns Current traversal depth
     *
     * @since 1.0.0
     */
    get value(): number {
        return this.#_depth;
    }

    /**
     * Increases traversal depth by one level.
     *
     * This method should be called BEFORE entering
     * a nested rendering scope.
     *
     * Typical examples:
     *
     * - entering object contents
     * - entering array contents
     * - entering grouped rendering scopes
     *
     * ---------------------------------------------------------------------
     * 🔷 STATE TRANSITION
     * ---------------------------------------------------------------------
     *
     * ```text
     * depth = N
     *      ↓
     * increase()
     *      ↓
     * depth = N + 1
     * ```
     *
     * @since 1.0.0
     */
    increase(): void {
        this.#_depth++;
    }

    /**
     * Decreases traversal depth by one level.
     *
     * This method should be called AFTER completing
     * traversal of a nested rendering scope.
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Depth may NEVER become negative.
     *
     * Attempting to decrease below zero indicates:
     *
     * - unbalanced traversal
     * - invalid recursion handling
     * - renderer state corruption
     *
     * In such cases, an invariant violation error is thrown.
     *
     * ---------------------------------------------------------------------
     * 🔷 STATE TRANSITION
     * ---------------------------------------------------------------------
     *
     * ```text
     * depth = N
     *      ↓
     * decrease()
     *      ↓
     * depth = N - 1
     * ```
     *
     * @throws Error
     * If depth would become negative
     *
     * @since 1.0.0
     */
    decrease(): void {
        if (this.#_depth - 1 < 0) {
            throw new Error('Invariant violation: cannot decrease depth below zero');
        }

        this.#_depth--;
    }
}

export default TraversalDepth;