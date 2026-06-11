import { StackTraceLine } from "../1-graphing/types";
import type ArrayRepresentationNode from "./nodes/array.node";
import type DateRepresentationNode from "./nodes/date.node";
import type ErrorRepresentationNode from "./nodes/error.node";
import type FunctionRepresentationNode from "./nodes/function.node";
import type MapRepresentationNode from "./nodes/map.node";
import type ObjectRepresentationNode from "./nodes/object.node";
import type PrimitiveRepresentationNode from "./nodes/primitive.node";
import type RegExpRepresentationNode from "./nodes/regex.node";
import type SetRepresentationNode from "./nodes/set.node";

export type PresentationNodeType = RepresentationNode['type'];
export type RepresentationNode =
    | ArrayRepresentationNode
    | DateRepresentationNode
    | ErrorRepresentationNode
    | FunctionRepresentationNode
    | MapRepresentationNode
    | ObjectRepresentationNode
    | PrimitiveRepresentationNode
    | RegExpRepresentationNode
    | SetRepresentationNode;

export type RepRefNode =
    | ArrayRepresentationNode
    | SetRepresentationNode
    | MapRepresentationNode
    | ObjectRepresentationNode
    | FunctionRepresentationNode
    | ErrorRepresentationNode;

/**
 * Representation-layer semantic error payload.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ErrorRepNodeData` is the fully normalized semantic representation of a
 * JavaScript error after graph transformation.
 *
 * Unlike graph-layer error structures, this payload contains ONLY:
 *
 * - renderer-safe values
 * - representation-layer nodes
 * - normalized semantic metadata
 *
 * It intentionally removes all runtime dependencies from the error model.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This interface exists at the boundary between:
 *
 * ```txt
 * Graph Layer
 *        ↓
 * Representation Layer
 *        ↓
 * Tokenization Layer
 * ```
 *
 * By the time this structure is created:
 *
 * - runtime `Error` objects are gone
 * - prototype chains are removed
 * - stack traces are already parsed
 * - causes are already recursively transformed
 *
 * This guarantees downstream layers never depend on:
 *
 * - runtime VM-specific error behavior
 * - prototype inspection
 * - native stack parsing
 * - JavaScript object identity
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN SHIFT
 * ---------------------------------------------------------------------
 *
 * Earlier pipeline versions stored raw runtime `Error` references:
 *
 * ```ts
 * Error
 * ```
 *
 * which leaked runtime semantics into downstream layers.
 *
 * This design was intentionally replaced with a pure structural model:
 *
 * ```ts
 * ErrorRepNodeData
 * ```
 *
 * to guarantee:
 *
 * - deterministic rendering
 * - runtime independence
 * - serializer stability
 * - environment consistency
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURE
 * ---------------------------------------------------------------------
 *
 * ## `name`
 *
 * Runtime error class name:
 *
 * Examples:
 *
 * - `"Error"`
 * - `"TypeError"`
 * - `"ReferenceError"`
 *
 * ---------------------------------------------------------------------
 *
 * ## `message`
 *
 * Optional human-readable message.
 *
 * Examples:
 *
 * ```txt
 * Cannot read property 'x' of undefined
 * ```
 *
 * This field is optional because JavaScript allows:
 *
 * ```ts
 * new Error()
 * ```
 *
 * without a message.
 *
 * ---------------------------------------------------------------------
 *
 * ## `stack`
 *
 * Structured stack trace lines.
 *
 * IMPORTANT:
 * Stack traces are already parsed and normalized BEFORE entering the
 * representation layer.
 *
 * This avoids:
 *
 * - runtime parsing in renderers
 * - serializer-specific stack logic
 * - environment inconsistencies
 *
 * ---------------------------------------------------------------------
 *
 * ## `cause`
 *
 * Optional recursively normalized representation-layer node.
 *
 * This represents:
 *
 * ```ts
 * Error.cause
 * ```
 *
 * after full representation conversion.
 *
 * IMPORTANT:
 * This field intentionally stores:
 *
 * ```ts
 * RepresentationNode
 * ```
 *
 * NOT:
 *
 * ```ts
 * GraphNode
 * ```
 *
 * ensuring strict phase isolation.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE GUARANTEE
 * ---------------------------------------------------------------------
 *
 * This structure NEVER contains:
 *
 * - runtime Error objects
 * - GraphNode instances
 * - prototype references
 * - mutable traversal state
 * - graph-layer metadata
 *
 * It is completely representation-safe.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY EXPECTATION
 * ---------------------------------------------------------------------
 *
 * Implementations are expected to treat this structure as immutable after
 * creation.
 *
 * Downstream phases MUST NOT mutate:
 *
 * - stack entries
 * - cause nodes
 * - error metadata
 *
 * ---------------------------------------------------------------------
 * 🔷 SERIALIZATION SAFETY
 * ---------------------------------------------------------------------
 *
 * Because this structure is runtime-independent, it can safely be used by:
 *
 * - terminal renderers
 * - JSON serializers
 * - AST exporters
 * - structured logging systems
 * - snapshot testing systems
 *
 * without depending on native runtime error behavior.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface ErrorRepNodeData {
    /**
     * Runtime error class name.
     *
     * Examples:
     *
     * - `"Error"`
     * - `"TypeError"`
     * - `"ReferenceError"`
     *
     * @since 1.0.0
     */
    name: string;

    /**
     * Structured normalized stack trace.
     *
     * Stack frames are parsed during graph construction and preserved in
     * normalized form for deterministic rendering.
     *
     * @since 1.0.0
     */
    stack: StackTraceLine[];

    /**
     * Optional recursively normalized representation-layer cause node.
     *
     * Represents:
     *
     * ```ts
     * Error.cause
     * ```
     *
     * after recursive representation conversion.
     *
     * IMPORTANT:
     * This field NEVER contains GraphNode instances.
     *
     * @since 1.0.0
     */
    cause?: RepresentationNode;

    /**
     * Optional human-readable error message.
     *
     * Examples:
     *
     * ```txt
     * Cannot read property 'x' of undefined
     * ```
     *
     * @since 1.0.0
     */
    message?: string;
}