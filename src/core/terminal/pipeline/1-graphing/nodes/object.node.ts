import atomix from "@nasriya/atomix";
import BaseDataNode from "./assets/base.node";
import PropertyNode from "./assets/property.node";
import type { GraphNode } from "../types";

/**
 * Graph node representing a JavaScript object-like structure.
 *
 * This node stores object members as semantic property/value pairs,
 * where:
 *
 * - keys are {@link PropertyNode} instances
 * - values are arbitrary {@link GraphNode} instances
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ObjectGraphNode` acts as the canonical graph representation for:
 * - object literals
 * - class instances
 * - prototype members
 * - accessors
 * - methods
 *
 * Unlike plain JavaScript objects, this structure preserves:
 * - semantic property metadata
 * - accessor distinction
 * - prototype traversal results
 * - renderer-friendly structure
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STORAGE MODEL
 * ---------------------------------------------------------------------
 *
 * Members are stored internally using:
 *
 * ```ts
 * Map<PropertyNode, GraphNode>
 * ```
 *
 * This enables renderers and transformation layers to:
 * - distinguish methods from properties
 * - preserve insertion order
 * - inspect metadata safely
 * - serialize structurally
 *
 * ---------------------------------------------------------------------
 * 🔷 OBJECT CLASSIFICATION
 * ---------------------------------------------------------------------
 *
 * Objects are classified into:
 *
 * - `"record"`
 *   Plain object literals.
 *
 * - `"object"`
 *   Non-literal instances (classes/custom prototypes).
 *
 * This distinction is important for renderers such as:
 * - JSON serializers
 * - CLI inspectors
 * - debugging renderers
 *
 * ---------------------------------------------------------------------
 * 🔷 CLASS NAME HANDLING
 * ---------------------------------------------------------------------
 *
 * For non-record objects, the constructor/prototype name is preserved
 * as lightweight runtime metadata.
 *
 * Examples:
 *
 * ```ts
 * class User {}
 *
 * // className = "User"
 * ```
 *
 * Record objects always use:
 *
 * ```txt
 * Record
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 ORDER GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Property insertion order is preserved through the internal `Map`.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ObjectGraphNode extends BaseDataNode {
    /**
     * Internal semantic property storage.
     *
     * Keys represent property metadata while values represent
     * recursively processed graph nodes.
     *
     * @since 1.0.0
     */
    readonly #_data: Map<PropertyNode, GraphNode> = new Map();

    /**
     * Internal object classification.
     * @since 1.0.0
     */
    readonly #_type: 'object' | 'record';

    /**
     * Runtime class/prototype name.
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Creates a new object graph node.
     *
     * The provided object is analyzed to determine whether it is:
     * - a plain record object
     * - a class/custom prototype instance
     *
     * @param value - Source object being transformed into a graph node.
     * @since 1.0.0
     */
    constructor(value: object) {
        const isRecordObject = atomix.valueIs.record(value);

        super(isRecordObject ? 'Record' : 'Object');
        this.#_type = isRecordObject ? 'record' : 'object';
        this.#_name = isRecordObject
            ? 'Record'
            : (value?.constructor?.name ?? 'Record');
    }

    /**
     * Semantic object classification.
     *
     * @returns Whether the node represents a plain record or custom object.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Object member storage.
     *
     * The returned map preserves insertion order.
     *
     * @returns Property/value graph mapping.
     * @since 1.0.0
     */
    get data() { return this.#_data; }

    /**
     * Runtime class/prototype name.
     *
     * For plain objects this returns `"Record"`.
     *
     * @returns The semantic object name.
     * @since 1.0.0
     */
    get className() { return this.#_name; }

    /**
     * Adds a semantic property entry to the object graph.
     *
     * @param prop - Property metadata node.
     * @param value - Graph node representing the property value.
     *
     * @since 1.0.0
     */
    add(prop: PropertyNode, value: GraphNode) {
        this.#_data.set(prop, value);
    }

    /**
     * Creates a semantic property node.
     *
     * Convenience wrapper around {@link PropertyNode.create}.
     *
     * @param args - Property creation arguments.
     *
     * @returns A new immutable {@link PropertyNode}.
     * @since 1.0.0
     */
    static createProp(...args: Parameters<typeof PropertyNode['create']>) {
        return PropertyNode.create(...args);
    }

    /**
     * Creates a new object graph node.
     *
     * @param value - Source object.
     *
     * @returns A new {@link ObjectGraphNode}.
     * @since 1.0.0
     */
    static create(value: object) {
        return new ObjectGraphNode(value);
    }
}

export default ObjectGraphNode;