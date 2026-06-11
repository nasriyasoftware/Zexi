/**
 * Represents the indentation state of a single rendering line.
 *
 * LineIndent is a deterministic layout primitive responsible for
 * lazily resolving indentation when the first visible content is written.
 *
 * Instead of applying indentation at construction time, it follows a
 * strict two-phase lifecycle where indentation is only materialized
 * when explicitly applied.
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE MODEL
 * ---------------------------------------------------------------------
 *
 * The indentation state follows a strict state machine:
 *
 * 1. `pending`
 *    - Indentation has not yet been applied.
 *    - The line is structurally valid but has no resolved layout.
 *
 * 2. `applied`
 *    - Indentation has been computed and frozen.
 *    - No further mutation is allowed.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This class ensures that:
 *
 * - indentation is not computed at creation time
 * - blank or unused lines do not incur layout cost
 * - indentation becomes immutable after resolution
 *
 * It is designed for streaming, incremental layout systems where
 * lines may exist without ever receiving content.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class LineIndent {
    /**
     * Internal lifecycle state of indentation.
     *
     * - `pending`: indentation has not been applied yet
     * - `applied`: indentation has been resolved and frozen
     *
     * This state enforces a strict single-transition lifecycle.
     *
     * @since 1.0.0
     */
    #_status: 'pending' | 'applied' = 'pending';

    /**
     * Resolved indentation width expressed in spaces.
     *
     * This value is only meaningful after `apply()` has been invoked.
     *
     * Before application:
     * - treated as 0 in layout calculations
     *
     * After application:
     * - represents fixed indentation width for the line
     *
     * @since 1.0.0
     */
    #_depthBasedSpaces = 0;

    /**
     * Constructs a LineIndent instance.
     *
     * If a copy object is provided, the instance is initialized
     * from serialized state rather than default values.
     *
     * This enables safe cloning without sharing mutable references.
     *
     * @param copy optional serialized indentation state
     *
     * @since 1.0.0
     */
    constructor(copy?: {
        /**
         * Resolved indentation width to restore.
         *
         * This represents the already computed indentation value.
         *
         * @since 1.0.0
         */
        depthBasedSpaces: number;

        /**
         * Lifecycle state of indentation.
         *
         * Must be either:
         * - `pending`
         * - `applied`
         *
         * This restores the exact previous state of the indent.
         *
         * @since 1.0.0
         */
        status: 'pending' | 'applied';
    }) {
        if (copy) {
            this.#_depthBasedSpaces = copy.depthBasedSpaces;
            this.#_status = copy.status;
        }
    }

    /**
     * Returns the current lifecycle state of indentation.
     *
     * @returns current indentation status
     *
     * @since 1.0.0
     */
    get status() {
        return this.#_status;
    }

    /**
     * Returns the effective indentation width for layout computation.
     *
     * Behavior:
     *
     * - If status is `pending`, returns `0`
     * - If status is `applied`, returns resolved indentation width
     *
     * This ensures that uninitialized lines do not contribute to layout width.
     *
     * @returns indentation width in spaces
     *
     * @since 1.0.0
     */
    get width() {
        return this.status === 'applied' ? this.#_depthBasedSpaces : 0;
    }

    /**
     * Applies indentation to the line and transitions the lifecycle state.
     *
     * This method finalizes indentation computation and ensures immutability
     * after application.
     *
     * Once applied:
     * - the indentation value is frozen
     * - subsequent calls are prohibited
     *
     * @param depthBasedSpaces computed indentation width in spaces
     *
     * @throws if indentation is not in `pending` state
     *
     * @since 1.0.0
     */
    apply(depthBasedSpaces: number) {
        if (this.status !== 'pending') {
            throw new Error(`Invariant violation: cannot apply an indent on a ${this.status} indent.`);
        }

        this.#_depthBasedSpaces = depthBasedSpaces;
        this.#_status = 'applied';
    }

    /**
     * Creates a deep clone of this LineIndent instance.
     *
     * The clone preserves both:
     * - resolved indentation value
     * - lifecycle state
     *
     * This ensures deterministic reproduction of layout state
     * in sub-writer or copied contexts.
     *
     * @returns new LineIndent instance with identical state
     *
     * @since 1.0.0
     */
    clone(): LineIndent {
        return new LineIndent({
            depthBasedSpaces: this.#_depthBasedSpaces,
            status: this.#_status
        });
    }
}

export default LineIndent;