import type ErrorGraphNode from "../../1-graphing/nodes/error.node";
import { ErrorGraphNodeData } from "../../1-graphing/types";
import { ErrorRepNodeData } from "../types";

/**
 * Representation-layer node for normalized JavaScript errors.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ErrorRepresentationNode` is the renderer-facing semantic counterpart
 * of {@link ErrorGraphNode}.
 *
 * It encapsulates a fully normalized structural representation of an
 * error suitable for:
 *
 * - tokenization
 * - rendering
 * - serialization
 * - structured logging
 * - snapshot generation
 *
 * Unlike graph-layer nodes, representation nodes contain NO runtime
 * traversal behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This node belongs to the SECOND transformation phase:
 *
 * ```txt
 * Runtime Error
 *        ↓
 * Graph Layer
 *        ↓
 * ErrorGraphNode
 *        ↓
 * Representation Layer
 *        ↓
 * ErrorRepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * Rendering
 * ```
 *
 * This layer exists specifically to:
 *
 * - isolate rendering semantics
 * - remove runtime coupling
 * - normalize renderer-facing structures
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME DECOUPLING
 * ---------------------------------------------------------------------
 *
 * Earlier versions stored raw runtime `Error` instances directly.
 *
 * This was intentionally removed because runtime errors:
 *
 * - vary across JS engines
 * - expose unstable prototype behavior
 * - contain non-deterministic stack formats
 * - leak runtime-specific semantics downstream
 *
 * This implementation instead operates entirely on:
 *
 * ```ts
 * ErrorRepNodeData
 * ```
 *
 * which is:
 *
 * - structurally normalized
 * - deterministic
 * - renderer-safe
 * - serialization-safe
 *
 * ---------------------------------------------------------------------
 * 🔷 REPRESENTATION RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * This node is responsible ONLY for semantic representation.
 *
 * It is NOT responsible for:
 *
 * - runtime traversal
 * - stack parsing
 * - cycle detection
 * - graph identity tracking
 * - rendering layout decisions
 * - ANSI formatting
 *
 * Those responsibilities belong to earlier or later pipeline phases.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Error representation nodes are immutable after creation.
 *
 * Internal semantic payload:
 *
 * - cannot be reassigned
 * - is preserved exactly as provided
 * - is never normalized again
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node discriminator is always:
 *
 * ```ts
 * "error"
 * ```
 *
 * allowing renderers and tokenizers to dispatch specialized behavior
 * without runtime inspection.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERER EXPECTATIONS
 * ---------------------------------------------------------------------
 *
 * Renderers may safely assume:
 *
 * - stack traces are already parsed
 * - causes are already recursively transformed
 * - no graph-layer nodes remain
 * - no runtime Error objects exist
 *
 * This allows renderers to remain purely semantic and formatting-oriented.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * This node exists to guarantee:
 *
 * - deterministic rendering behavior
 * - cross-runtime consistency
 * - stable serialization
 * - strict pipeline separation
 * - semantic normalization
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ErrorRepresentationNode {
    /**
     * Static semantic type identifier.
     *
     * Always:
     *
     * ```ts
     * "error"
     * ```
     *
     * Used by renderers and tokenizers for dispatching error-specific
     * formatting rules.
     *
     * This value is immutable and shared across all instances.
     *
     * @since 1.0.0
     */
    readonly #_type: 'error' = 'error';

    /**
     * Fully normalized semantic error payload.
     *
     * This payload contains:
     *
     * - normalized error metadata
     * - structured stack traces
     * - recursively transformed causes
     * - renderer-safe semantics
     *
     * IMPORTANT:
     * This payload NEVER contains:
     *
     * - runtime Error objects
     * - GraphNode instances
     * - traversal metadata
     * - mutable graph state
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_data: ErrorRepNodeData;

    /**
     * Creates a new ErrorRepresentationNode.
     *
     * The provided payload must already be fully normalized by the
     * representation builder.
     *
     * No:
     *
     * - validation
     * - parsing
     * - recursion
     * - normalization
     *
     * occurs here.
     *
     * This constructor is intentionally lightweight.
     *
     * @param data - Fully normalized representation-layer error payload.
     * @since 1.0.0
     */
    constructor(data: ErrorRepNodeData) {
        this.#_data = data;
    }

    /**
     * Node type discriminator.
     *
     * Used by:
     *
     * - renderer dispatch
     * - tokenization routing
     * - formatting rules
     *
     * Always returns:
     *
     * ```ts
     * "error"
     * ```
     *
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Fully normalized semantic error payload.
     *
     * Contains:
     *
     * - name
     * - message
     * - structured stack trace
     * - optional semantic cause
     *
     * IMPORTANT:
     * This is NOT a runtime Error instance.
     *
     * @returns Immutable representation-layer error payload.
     * @since 1.0.0
     */
    get data() { return this.#_data; }

    /**
     * Creates an ErrorRepresentationNode from normalized representation data.
     *
     * -----------------------------------------------------------------
     * 🔷 PIPELINE ROLE
     * -----------------------------------------------------------------
     *
     * This method represents the final normalization boundary before
     * tokenization begins.
     *
     * Input data MUST already:
     *
     * - be representation-safe
     * - contain only RepresentationNodes
     * - be graph-independent
     * - be runtime-independent
     *
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT
     * -----------------------------------------------------------------
     *
     * This method intentionally no longer accepts:
     *
     * ```ts
     * ErrorGraphNode
     * ```
     *
     * directly.
     *
     * This enforces strict architectural isolation between:
     *
     * - graphing
     * - representation
     * - tokenization
     *
     * -----------------------------------------------------------------
     *
     * @param data - Fully normalized representation-layer error payload.
     * @returns Immutable error representation node.
     *
     * @since 1.0.0
     */
    static create(data: ErrorRepNodeData) {
        return new ErrorRepresentationNode(data);
    }
}

export default ErrorRepresentationNode;