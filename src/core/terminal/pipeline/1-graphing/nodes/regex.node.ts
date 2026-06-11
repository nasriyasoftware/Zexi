import BaseDataNode from "./assets/base.node";

/**
 * Graph node representing JavaScript RegExp values.
 *
 * `RegExpGraphNode` is a terminal leaf node in the graph model
 * used during the graph-building phase of the inspection pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This node encapsulates native `RegExp` instances without transforming
 * their internal structure. It preserves the original reference while
 * allowing downstream representation and rendering layers to:
 *
 * - Convert regex into string form (e.g. `/abc/g`)
 * - Apply formatting or syntax highlighting
 * - Treat regex as a primitive-like renderable entity
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - Leaf node (no children)
 * - Immutable after creation
 * - Not recursively traversed
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING NOTES
 * ---------------------------------------------------------------------
 *
 * Renderers typically handle this node by:
 *
 * - `String(value)` or `value.toString()`
 * - Preserving flags (`g`, `i`, `m`, etc.)
 * - Treating invalid regex only at construction time (if applicable)
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node is strongly typed as:
 * - `type`: `"regex"`
 * - `value`: `RegExp`
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class RegExpGraphNode extends BaseDataNode {
    /**
     * Original RegExp instance.
     * @since 1.0.0
     */
    readonly #_value: RegExp;

    /**
     * Discriminated node type.
     * @since 1.0.0
     */
    readonly #_type: 'regex' = 'regex';
    
    /**
     * Discriminated node type.
     * @since 1.0.0
     */
    constructor(value: RegExp) {
        super('RegExp');
        this.#_value = new RegExp(value);
    }

    /**
     * Node type discriminator.
     *
     * @returns `"regex"`
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Original RegExp instance.
     *
     * @returns The wrapped RegExp value.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Factory method for creating a RegExp graph node.
     *
     * @param value - RegExp instance.
     * @returns A new immutable {@link RegExpGraphNode}.
     * @since 1.0.0
     */
    static create(value: RegExp) {
        return new RegExpGraphNode(value);
    }
}

export default RegExpGraphNode;