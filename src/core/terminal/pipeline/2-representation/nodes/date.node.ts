import type DateGraphNode from "../../1-graphing/nodes/date.node";

/**
 * Date representation node.
 *
 * Represents a temporal value in the representation layer.
 *
 * This node is the renderer-facing counterpart of {@link DateGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Date nodes encapsulate JavaScript `Date` values in a form that is
 * safe for rendering, formatting, and serialization pipelines.
 *
 * Unlike graph nodes, representation nodes are not concerned with
 * structural traversal — only display semantics.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers typically format date nodes as:
 *
 * - ISO 8601 strings (`toISOString()`)
 * - localized formats (terminal / UI renderers)
 * - invalid markers when date is invalid
 *
 * Example outputs:
 *
 * ```txt
 * 2026-01-01T00:00:00.000Z
 * ```
 *
 * or
 *
 * ```txt
 * [Invalid Date]
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * The node is immutable after construction.
 *
 * The internal `Date` reference is preserved as-is and is not cloned.
 * Renderers should treat it as read-only.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * DateRepresentationNode.from(dateGraphNode)
 * ```
 *
 * This ensures a direct, lossless mapping from graph layer to
 * representation layer without transformation or normalization.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node is strictly typed as:
 *
 * ```ts
 * 'date'
 * ```
 *
 * enabling renderer-level discrimination without runtime inspection
 * of the underlying value.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class DateRepresentationNode {
    /**
     * Semantic type identifier for this representation node.
     *
     * Always `"date"`.
     *
     * @since 1.0.0
     */
    readonly #_type: 'date' = 'date';

    /**
     * Underlying JavaScript Date instance.
     *
     * Represents the original temporal value from the graph layer.
     *
     * @since 1.0.0
     */
    readonly #_value: Date;

    /**
     * Creates a new date representation node.
     *
     * @param value - JavaScript Date instance.
     * @since 1.0.0
     */
    constructor(value: Date) {
        this.#_value = value;
    }

    /**
     * Semantic node type.
     *
     * @returns Always `"date"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Underlying date value.
     *
     * @returns Original Date instance.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Converts a graph date node into a representation node.
     *
     * This is a direct transformation with no normalization applied.
     *
     * @param node - Date graph node.
     *
     * @returns Date representation node.
     * @since 1.0.0
     */
    static from(node: DateGraphNode) {
        return new DateRepresentationNode(node.value);
    }
}

export default DateRepresentationNode;