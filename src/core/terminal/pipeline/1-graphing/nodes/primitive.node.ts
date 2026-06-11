import BaseDataNode from "./assets/base.node";
import type { PrimitiveType, PrimtiveNodeData } from "../types";

/**
 * Graph node representing a primitive JavaScript value.
 *
 * This node acts as the terminal leaf node in the graphing phase.
 * Unlike structured graph nodes (objects, arrays, maps, etc.),
 * primitive nodes do not contain child nodes.
 *
 * ---------------------------------------------------------------------
 * 🔷 SUPPORTED VALUES
 * ---------------------------------------------------------------------
 *
 * Primitive graph nodes support:
 *
 * - string
 * - number
 * - bigint
 * - boolean
 * - symbol
 * - undefined
 * - null
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This node preserves:
 * - the original primitive value
 * - its normalized primitive type
 *
 * The normalized type is important because:
 *
 * ```ts
 * typeof null === "object"
 * ```
 *
 * JavaScript incorrectly classifies `null` as an object, so this node
 * explicitly normalizes it into the semantic `"null"` type.
 *
 * ---------------------------------------------------------------------
 * 🔷 GRAPH ROLE
 * ---------------------------------------------------------------------
 *
 * Primitive nodes are terminal graph nodes:
 *
 * - no recursive traversal
 * - no child relationships
 * - no reference tracking
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING USAGE
 * ---------------------------------------------------------------------
 *
 * Representation and rendering layers can use this node directly for:
 * - JSON serialization
 * - CLI formatting
 * - ANSI styling
 * - primitive coercion
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class PrimitiveGraphNode extends BaseDataNode {
    /**
     * Internal primitive value.
     * @since 1.0.0
     */
    readonly #_value: PrimtiveNodeData;

    /**
     * Normalized primitive classification.
     * @since 1.0.0
     */
    readonly #_type: PrimitiveType;

    /**
     * Creates a new primitive graph node.
     *
     * The primitive type is automatically inferred and normalized.
     *
     * @param value - Primitive JavaScript value.
     * @since 1.0.0
     */
    constructor(value: PrimtiveNodeData) {
        super("Primitive");
        this.#_value = value;
        this.#_type = value === null ? 'null' : typeof value as PrimitiveType;
    }

    /**
     * Original primitive value.
     *
     * @returns The stored primitive value.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Normalized primitive type.
     *
     * Unlike JavaScript's `typeof`, this correctly classifies:
     *
     * ```ts
     * null -> "null"
     * ```
     *
     * @returns Semantic primitive classification.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Creates a new primitive graph node.
     *
     * Convenience factory method.
     *
     * @param value - Primitive JavaScript value.
     *
     * @returns A new {@link PrimitiveGraphNode}.
     * @since 1.0.0
     */
    static create(value: PrimtiveNodeData) {
        return new PrimitiveGraphNode(value);
    }
}

export default PrimitiveGraphNode;