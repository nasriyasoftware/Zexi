const message = `Circular reference detected while serializing an object.` as const;

/**
 * Error thrown when a circular object reference is detected
 * during graph construction.
 *
 * This error protects the graphing pipeline from entering
 * infinite recursive traversal loops when objects reference
 * themselves directly or indirectly.
 *
 * ---------------------------------------------------------------------
 * 🔷 WHEN IT IS THROWN
 * ---------------------------------------------------------------------
 *
 * The error is raised by {@link ReferenceTracker} when:
 *
 * - an object references itself
 * - nested structures create recursive cycles
 * - arrays, maps, or sets contain previously visited objects
 *
 * Examples:
 *
 * ```ts
 * const obj: any = {};
 * obj.self = obj;
 * ```
 *
 * ```ts
 * const a: any = {};
 * const b: any = { a };
 * a.b = b;
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Circular references cannot be represented safely in the
 * current graph model because the graphing phase produces
 * an acyclic serialization-oriented structure.
 *
 * Throwing early guarantees:
 * - recursion safety
 * - deterministic graph generation
 * - predictable renderer behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR MESSAGE
 * ---------------------------------------------------------------------
 *
 * The error always uses a stable standardized message:
 *
 * ```txt
 * Circular reference detected while serializing an object.
 * ```
 *
 * ---------------------------------------------------------------------
 * @extends Error
 * @since 1.0.0
 */
class CircularReferenceError extends Error {
    /**
     * Creates a new circular reference error.
     * @since 1.0.0
     */
    constructor() {
        super(message);

        /**
         * Preserves runtime class identity.
         * @since 1.0.0
         */
        super.name = this.constructor.name;
    }
}

export default CircularReferenceError;