import BaseDataNode from "./assets/base.node";

/**
 * Graph representation of a JavaScript function value.
 *
 * This node wraps function references discovered during the graph-building phase
 * and preserves them without execution or transformation.
 *
 * Unlike primitive values, functions are treated as opaque executable entities
 * in the graph model.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `FunctionGraphNode` exists to:
 * - Preserve function identity in the graph phase
 * - Prevent accidental execution during traversal
 * - Allow downstream representation/rendering layers to decide:
 *   - whether to display function source
 *   - whether to show `[Function]` placeholders
 *   - whether to skip or summarize functions entirely
 *
 * ---------------------------------------------------------------------
 * 🔷 BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - Functions are NOT invoked
 * - Function internals are NOT traversed
 * - Only the reference is stored
 *
 * This ensures safety and determinism during graph construction.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING NOTES
 * ---------------------------------------------------------------------
 *
 * Renderers may choose to represent function nodes as:
 * - `[Function]`
 * - `[Function: name]`
 * - `ƒ name() { ... }`
 * - or omit entirely (e.g. JSON renderer)
 *
 * depending on output mode and constraints.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * Function references are immutable once captured by the graph.
 * The node does not allow reassignment or transformation of the function value.
 *
 * ---------------------------------------------------------------------
 * 
 * @since 1.0.0
 */
class FunctionGraphNode extends BaseDataNode {
    /**
     * Internal function reference captured from input.
     * @since 1.0.0
     */
    readonly #_value: Function;

    /**
     * Static type discriminator for this node.
     * @since 1.0.0
     */
    readonly #_type: 'function' = 'function';

    /**
     * Creates a new function graph node.
     *
     * @param value - Function reference to store in the graph.
     * @since 1.0.0
     */
    constructor(value: Function) {
        super('Function');
        this.#_value = value;
    }

    /**
     * Node type discriminator.
     *
     * @returns Always `"function"`.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Original function reference.
     *
     * @returns The stored function.
     * @since 1.0.0
     */
    get value() { return this.#_value; }

    /**
     * Creates a function graph node.
     *
     * @param value - Function reference.
     * @returns A new {@link FunctionGraphNode}.
     * @since 1.0.0
     */
    static create(value: Function) {
        return new FunctionGraphNode(value);
    }
}

export default FunctionGraphNode;