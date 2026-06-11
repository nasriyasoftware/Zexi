import BaseDataNode from "./assets/base.node";

/**
 * Graph node representing values that cannot be classified.
 *
 * `UnknownGraphNode` is the final fallback node used by the graph builder
 * when a JavaScript value does not match any known or supported type.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This node acts as a safety net in the graph construction pipeline.
 * It ensures that *all values* are represented in the graph, even if:
 *
 * - the type is exotic or host-specific
 * - the value is non-standard or malformed
 * - future JS types are introduced
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - Leaf node (no children)
 * - Always terminal in traversal
 * - Preserves original raw value without interpretation
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING NOTES
 * ---------------------------------------------------------------------
 *
 * Renderers typically handle this node as:
 *
 * - empty string (`""`)
 * - placeholder (`[Unknown]`)
 * - debug dump (`Object.prototype.toString.call(value)`)
 *
 * depending on output mode and safety constraints.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOAL
 * ---------------------------------------------------------------------
 *
 * This node guarantees:
 * - no runtime crashes during graph building
 * - full lossless coverage of input space (structurally)
 * - predictable fallback behavior for unknown types
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class UnknownGraphNode extends BaseDataNode {
    /**
     * Original unclassified value.
     * @since 1.0.0
     */
    readonly #_value: unknown;

    /**
     * Discriminated node type.
     * @since 1.0.0
     */
    readonly #_type: 'unknown' = 'unknown';

    /**
     * Discriminated node type.
     * @since 1.0.0
     */
    constructor(value: unknown) {
        super('Unknown');
        this.#_value = value;
    }

    /**
     * Original stored value.
     *
     * @returns The raw unknown input.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Node type discriminator.
     *
     * @returns `"unknown"`
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Factory method for creating an UnknownGraphNode.
     *
     * @param value - Any unsupported or unclassified value.
     * @returns A new {@link UnknownGraphNode}.
     * @since 1.0.0
     */
    static create(value: unknown) {
        return new UnknownGraphNode(value);
    }
}

export default UnknownGraphNode;