import BaseDataNode from "./assets/base.node";

/**
 * Graph representation node for JavaScript `Date` values.
 *
 * This node wraps a native `Date` instance and provides a
 * structured representation for downstream rendering systems.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `DateGraphNode` exists to distinguish temporal values from:
 * - primitives (stringified dates)
 * - generic objects
 * - unknown structured data
 *
 * It ensures that date semantics are preserved during:
 * - graph construction
 * - representation transformation
 * - rendering (JSON, CLI, formatted output)
 *
 * ---------------------------------------------------------------------
 * 🔷 SEMANTIC GUARANTEE
 * ---------------------------------------------------------------------
 *
 * This node always represents a valid `Date` instance.
 *
 * The underlying value is preserved without coercion at this stage.
 * Formatting (ISO string, invalid date handling, localization, etc.)
 * is deferred to the rendering layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE INFORMATION
 * ---------------------------------------------------------------------
 *
 * - `type`: always `"date"`
 * - `value`: the original `Date` instance
 *
 * Invalid dates (`NaN`) are not rejected here — they are handled
 * later in the rendering phase.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * The node is immutable after construction. The wrapped `Date`
 * reference is not replaced or mutated by this class.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class DateGraphNode extends BaseDataNode {
    /**
    * Internal Date instance.
    * @since 1.0.0
    */
    readonly #_value: Date;

    /**
     * Constant node type identifier.
     * @since 1.0.0
     */
    readonly #_type: 'date' = 'date';

    /**
     * Constant node type identifier.
     * @since 1.0.0
     */
    constructor(value: Date) {
        super('Date');
        this.#_value = new Date(value.getTime());
    }

    /**
     * Node type discriminator.
     *
     * @returns Always `"date"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Node type discriminator.
     *
     * @returns Always `"date"`.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Factory method for creating a DateGraphNode.
     *
     * @param value - Date instance to wrap.
     * @returns A new immutable {@link DateGraphNode}.
     * @since 1.0.0
     */
    static create(value: Date) {
        return new DateGraphNode(value);
    }
}

export default DateGraphNode;