import type { GraphRefNode } from "../types";

/**
 * JavaScript values capable of participating in graph identity tracking.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `TrackableData` represents all runtime JavaScript values that:
 *
 * - are reference-capable
 * - may participate in shared graph identity
 * - may form circular structures
 * - require canonical graph node ownership
 *
 * Primitive values are intentionally excluded because primitives:
 *
 * - are copied by value
 * - do not preserve identity semantics
 * - cannot form circular references
 * - do not require reference tracking
 *
 * ---------------------------------------------------------------------
 * 🔷 TRACKED RUNTIME TYPES
 * ---------------------------------------------------------------------
 *
 * Supported identity-capable values:
 *
 * - arrays
 * - maps
 * - sets
 * - plain objects
 * - functions
 * - errors
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Tracking occurs using native JavaScript reference identity:
 *
 * ```ts
 * a === b
 * ```
 *
 * Meaning:
 *
 * - the exact same JS object maps to the exact same graph node
 * - structurally identical objects are NOT considered identical
 *
 * Example:
 *
 * ```ts
 * const a = {};
 * const b = {};
 *
 * a !== b
 * ```
 *
 * therefore:
 *
 * ```txt
 * ObjectGraphNode#1
 * ObjectGraphNode#2
 * ```
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type TrackableData =
    | any[]
    | Map<any, any>
    | Set<any>
    | Function
    | Object
    | Error;

/**
 * Identity tracking metadata associated with a tracked runtime object.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `GraphRef` stores the canonical graph identity associated with a
 * JavaScript reference-capable value.
 *
 * It acts as the bridge between:
 *
 * ```txt
 * JS runtime identity
 *         ↓
 * Graph node identity
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * A tracked reference stores:
 *
 * - the canonical graph node
 * - how many times the original JS object was encountered
 *
 * This allows the graph builder to:
 *
 * - preserve shared identity
 * - reuse existing graph nodes
 * - avoid duplicate graph construction
 * - detect aliasing relationships
 *
 * ---------------------------------------------------------------------
 * 🔷 OCCURRENCE COUNT
 * ---------------------------------------------------------------------
 *
 * `count` represents:
 *
 * ```txt
 * number of encounters of the original JS object
 * ```
 *
 * NOT:
 *
 * - traversal depth
 * - graph node depth
 * - renderer reference index
 * - serialization position
 *
 * Example:
 *
 * ```ts
 * const shared = {};
 *
 * const obj = {
 *   a: shared,
 *   b: shared,
 *   c: shared
 * };
 * ```
 *
 * Result:
 *
 * ```txt
 * count === 3
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY PRESERVATION
 * ---------------------------------------------------------------------
 *
 * The same runtime object always maps to the same graph node:
 *
 * ```ts
 * x === y
 * ```
 *
 * therefore:
 *
 * ```ts
 * xNode === yNode
 * ```
 *
 * This preserves structural identity throughout the entire pipeline.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type GraphRef = {
    /**
     * Canonical graph node associated with the runtime object.
     *
     * This node is allocated only once and reused for all subsequent
     * encounters of the same JS object identity.
     *
     * @since 1.0.0
     */
    node: GraphRefNode;

    /**
     * Number of times the original JS object identity was encountered.
     *
     * Incremented whenever the same runtime reference is traversed again.
     *
     * @since 1.0.0
     */
    count: number
};