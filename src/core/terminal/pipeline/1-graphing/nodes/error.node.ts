import BaseDataNode from "./assets/base.node";
import type { ErrorGraphNodeData } from "../types";

/**
 * Graph representation node for JavaScript `Error` objects.
 *
 * This node represents a structural, pipeline-safe abstraction of an
 * `Error` instance inside the graphing phase.
 *
 * Unlike primitive wrappers, it does NOT directly store the original
 * Error object. Instead, it stores a normalized structural snapshot.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ROLE
 * ---------------------------------------------------------------------
 *
 * ErrorGraphNode is part of the GRAPH LAYER:
 *
 * ```txt
 * JS Error
 *   ↓
 * GraphErrorNode
 *   ↓
 * RepresentationNode (ErrorRepresentationNode)
 *   ↓
 * Tokenization
 *   ↓
 * Rendering / Serialization
 * ```
 *
 * This separation ensures:
 *
 * - deterministic transformation of error structures
 * - safe downstream rendering without raw runtime objects
 * - consistent handling of stack traces and causes
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL MODEL
 * ---------------------------------------------------------------------
 *
 * Instead of storing a raw Error object, this node stores:
 *
 * ```ts
 * ErrorGraphNodeData {
 *   name: string;
 *   message?: string;
 *   stack: StackTraceLine[];
 *   cause?: GraphNode;
 * }
 * ```
 *
 * This ensures:
 *
 * - stack trace is pre-parsed and structured
 * - cause chain is already graph-normalized
 * - message is optional and normalized
 *
 * ---------------------------------------------------------------------
 * 🔷 TWO-PHASE CONSTRUCTION MODEL
 * ---------------------------------------------------------------------
 *
 * This node is intentionally constructed in two phases:
 *
 * ### Phase 1 — Creation
 *
 * ```ts
 * const node = ErrorGraphNode.create();
 * ```
 *
 * At this point:
 *
 * - node is EMPTY
 * - identity exists (#_id)
 * - no data is assigned yet
 *
 * ---
 *
 * ### Phase 2 — Assignment
 *
 * ```ts
 * node.assign(data);
 * ```
 *
 * This locks the node with:
 *
 * - name
 * - stack trace
 * - optional cause
 * - optional message
 *
 * Once assigned, the node becomes immutable.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * After `assign()`:
 *
 * - data cannot be modified
 * - repeated assignment is forbidden
 * - structural identity remains stable
 *
 * This guarantees deterministic graph traversal.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Each instance owns a unique internal symbol:
 *
 * ```ts
 * readonly #_id: symbol
 * ```
 *
 * This identity is used for:
 *
 * - graph deduplication
 * - representation reuse
 * - tokenization reference tracking
 *
 * ⚠️ Important:
 * This identity is NOT tied to:
 * - JavaScript Error identity
 * - stack trace identity
 * - value equality
 *
 * It is strictly a graph-layer identity.
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The node enforces strict single-assignment semantics:
 *
 * - calling `assign()` twice throws
 * - prevents partial mutation corruption
 *
 * This ensures:
 *
 * - stable downstream representation
 * - predictable token emission
 * - safe memoization behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE DISCIPLINE
 * ---------------------------------------------------------------------
 *
 * - `type` is always `"error"`
 * - `data` is guaranteed after assignment
 *
 * Accessing `data` before assignment is invalid.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING NOTE
 * ---------------------------------------------------------------------
 *
 * Rendering layers should NOT consume GraphErrorNode directly.
 *
 * Instead, they operate on:
 *
 * ```ts
 * ErrorRepresentationNode
 * ```
 *
 * This node only exists to normalize structure.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ErrorGraphNode extends BaseDataNode {
    /**
     * Unique immutable structural identity symbol.
     *
     * This symbol is automatically generated during construction and is
     * used internally throughout the compilation pipeline to:
     *
     * - track structural node identity
     * - memoize downstream transformations
     * - cache representation/token stages
     * - detect repeated structures
     *
     * The symbol is runtime-local and intentionally non-serializable.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol = Symbol();

    /**
     * Assignment guard flag.
     *
     * Ensures that GraphErrorNode can only be assigned once.
     *
     * This enforces immutability after initialization.
     *
     * @internal
     */
    #_assigned = false;

    /**
     * Normalized error structure.
     *
     * Contains a fully graph-safe representation of the original Error:
     *
     * - name
     * - message (optional)
     * - stack trace (structured)
     * - cause chain (graph node)
     *
     * This value is only available after `assign()`.
     *
     * @internal
     */
    #_data?: ErrorGraphNodeData;

    /**
     * Constant node type discriminator.
     *
     * Always:
     *
     * ```ts
     * "error"
     * ```
     *
     * Used by:
     *
     * - representation mapping
     * - tokenization routing
     * - renderer dispatch
     *
     * @since 1.0.0
     */
    readonly #_type: 'error' = 'error';

    /**
     * Creates an empty ErrorGraphNode.
     *
     * The node is initially unassigned and must be populated via
     * `assign()` before use in graph traversal.
     *
     * This design allows:
     *
     * - cycle-safe construction in error chains
     * - deferred normalization of stack/cause
     * - stable identity before data resolution
     *
     * @since 1.0.0
     */
    constructor() {
        super('Error');
    }

    /**
     * Returns the structural identity of this graph node.
     *
     * ---------------------------------------------------------------------
     * 🔷 IDENTITY MODEL
     * ---------------------------------------------------------------------
     *
     * Each ErrorGraphNode owns a unique internal `symbol` generated at
     * construction time:
     *
     * ```ts
     * readonly #_id: symbol
     * ```
     *
     * This getter exposes that identity in a read-only form.
     *
     * ---------------------------------------------------------------------
     * 🔷 SEMANTIC ROLE
     * ---------------------------------------------------------------------
     *
     * This identity is used for:
     *
     * - GraphIdentityTracker deduplication
     * - representation-layer reuse
     * - tokenization reference mapping
     * - structural equality comparisons (node-level, not JS-level)
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT DISTINCTION
     * ---------------------------------------------------------------------
     *
     * This is NOT:
     *
     * - JavaScript object identity (`===`)
     * - Error instance identity
     * - serialized identifier
     *
     * This is a **graph pipeline identity only**.
     *
     * ---------------------------------------------------------------------
     * 🔷 STABILITY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * - unique per node instance
     * - immutable for lifetime of node
     * - safe for cross-phase reference tracking
     *
     * ---------------------------------------------------------------------
     * @returns Unique structural identity symbol for this node
     * @since 1.0.0
     */
    get id(): symbol {
        return this.#_id;
    }

    /**
     * Node type discriminator.
     *
     * Always returns:
     *
     * ```ts
     * "error"
     * ```
     *
     * Used by:
     *
     * - representation mapping
     * - token routing
     * - renderer dispatch
     *
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Returns the assigned error structure.
     *
     * This includes:
     *
     * - error name
     * - optional message
     * - structured stack trace
     * - optional cause graph node
     *
     * ⚠️ Must only be accessed after `assign()` has been called.
     *
     * @returns Fully initialized error graph data
     * @throws if accessed before assignment (runtime invariant violation)
     * @since 1.0.0
     */
    get data() {
        if (!this.#_assigned) {
            throw new Error('Invariant Violation: `assign()` must be called before `data` can be accessed.');
        }
        
        return this.#_data!;
    }

    /**
     * Assigns normalized error data to this node.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Completes the construction of the error graph node by attaching
     * structured error metadata.
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY RULES
     * ---------------------------------------------------------------------
     *
     * This method can ONLY be called once.
     *
     * Subsequent calls will throw an error to guarantee immutability.
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURAL GUARANTEE
     * ---------------------------------------------------------------------
     *
     * After assignment:
     *
     * - node becomes fully immutable
     * - data is safe for downstream representation
     * - identity is stable for graph reuse
     *
     * ---------------------------------------------------------------------
     * @param data - Normalized error structure
     * @throws Error if node was already assigned
     * @since 1.0.0
     */
    assign(data: ErrorGraphNodeData) {
        if (this.#_assigned) {
            throw new Error('Invariant violation: Error node already assigned.');
        }

        this.#_assigned = true;
        this.#_data = data;
    }

    /**
     * Creates a new empty ErrorGraphNode instance.
     *
     * This is the first phase of the two-phase construction model.
     *
     * @returns Uninitialized ErrorGraphNode
     * @since 1.0.0
     */
    static create() {
        return new ErrorGraphNode();
    }
}

export default ErrorGraphNode;