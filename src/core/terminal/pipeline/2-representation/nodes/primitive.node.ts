import PrimitiveGraphNode from "../../1-graphing/nodes/primitive.node";
import type { PrimitiveType, PrimtiveNodeData } from "../../1-graphing/types";

/**
 * Primitive representation node.
 *
 * Represents a terminal (non-structured) value in the representation layer.
 *
 * This is the renderer-oriented counterpart of {@link PrimitiveGraphNode}.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Primitive nodes represent leaf values in the representation tree,
 * meaning they have no children and cannot be further decomposed.
 *
 * These include:
 * - string
 * - number
 * - bigint
 * - boolean
 * - symbol
 * - null
 * - undefined
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLE IN PIPELINE
 * ---------------------------------------------------------------------
 *
 * ```txt
 * PrimitiveGraphNode
 *        ↓
 * PrimitiveRepresentationNode
 *        ↓
 * Renderer
 *        ↓
 * Final Output
 * ```
 *
 * This node acts as a stable, renderer-friendly wrapper around raw
 * primitive graph values.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Renderers typically treat primitive nodes as:
 * - direct string conversions
 * - styled literals (ANSI terminal output)
 * - JSON-compatible values
 *
 * No structural traversal is required.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * Primitive representation nodes are immutable after construction.
 *
 * They are safe to reuse across rendering pipelines.
 *
 * ---------------------------------------------------------------------
 * 🔷 FACTORY METHOD
 * ---------------------------------------------------------------------
 *
 * The `from()` method converts a graph primitive node into a
 * representation primitive node without mutation or transformation loss.
 *
 * This ensures:
 * - type consistency
 * - value fidelity
 * - zero structural overhead
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class PrimitiveRepresentationNode {
    /**
     * Primitive type classification.
     *
     * Defines how the value should be interpreted by renderers.
     *
     * @since 1.0.0
     */
    readonly #_type: PrimitiveType;

    /**
     * Raw primitive value from the graph layer.
     *
     * This value is guaranteed to be terminal and non-iterable.
     *
     * @since 1.0.0
     */
    readonly #_value: PrimtiveNodeData;

    /**
     * Creates a new primitive representation node.
     *
     * @param type - Primitive type classification.
     * @param value - Raw primitive value.
     *
     * @since 1.0.0
     */
    constructor(type: PrimitiveType, value: PrimtiveNodeData) {
        this.#_type = type;
        this.#_value = value;
    }

    /**
     * Primitive type classification.
     *
     * @returns The primitive type.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Raw primitive value.
     *
     * @returns The underlying primitive value.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Converts a graph primitive node into a representation node.
     *
     * This is a lossless transformation at the semantic level:
     * no normalization or structural changes are applied.
     *
     * @param node - Primitive graph node.
     *
     * @returns Primitive representation node.
     * @since 1.0.0
     */
    static from(node: PrimitiveGraphNode) {
        return new PrimitiveRepresentationNode(node.type, node.value);
    }
}

export default PrimitiveRepresentationNode;