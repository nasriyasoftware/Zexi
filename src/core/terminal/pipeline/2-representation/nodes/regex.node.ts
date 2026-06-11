import type RegExpGraphNode from "../../1-graphing/nodes/regex.node";

/**
 * RegExp representation node.
 *
 * Represents a JavaScript regular expression in the representation layer.
 *
 * This node is the renderer-facing counterpart of {@link RegExpGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * RegExp representation nodes encapsulate JavaScript `RegExp` values
 * in a format suitable for inspection and rendering pipelines.
 *
 * They preserve the original pattern and flags without transformation.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers typically format regex nodes as:
 *
 * - `/pattern/flags`
 *
 * Example:
 *
 * ```txt
 * /abc/i
 * ```
 *
 * This representation is derived directly from the underlying RegExp
 * instance using its `source` and `flags` properties.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * RegExp representation nodes are immutable after construction.
 *
 * The original RegExp reference is preserved without cloning.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH TRANSFORMATION
 * ---------------------------------------------------------------------
 *
 * Created via:
 *
 * ```ts
 * RegExpRepresentationNode.from(regexGraphNode)
 * ```
 *
 * This ensures a direct 1:1 mapping from graph-layer regex nodes to
 * representation-layer nodes.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node is strictly typed as:
 *
 * ```ts
 * 'regex'
 * ```
 *
 * enabling renderers to distinguish it from primitives and other
 * object-like structures without runtime inspection.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class RegExpRepresentationNode {
    /**
     * Semantic node type identifier.
     *
     * Always `"regex"`.
     *
     * @since 1.0.0
     */
    readonly #_type: 'regex' = 'regex';

    /**
     * Underlying JavaScript RegExp instance.
     *
     * Represents the original regular expression from the graph layer.
     *
     * @since 1.0.0
     */
    readonly #_value: RegExp;

    /**
     * Underlying JavaScript RegExp instance.
     *
     * Represents the original regular expression from the graph layer.
     *
     * @since 1.0.0
     */
    constructor(value: RegExp) { this.#_value = value; }

    /**
    * Semantic node type.
    *
    * @returns Always `"regex"`.
    * @since 1.0.0
    */
    get type() { return this.#_type; }

    /**
     * Underlying RegExp value.
     *
     * @returns Original RegExp instance.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Converts a graph regex node into a representation node.
     *
     * This transformation is lossless and preserves the original RegExp
     * instance.
     *
     * @param node - RegExp graph node.
     *
     * @returns RegExp representation node.
     * @since 1.0.0
     */
    static from(node: RegExpGraphNode) {
        return new RegExpRepresentationNode(node.value);
    }
}

export default RegExpRepresentationNode;