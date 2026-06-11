import type ArrayGraphNode from "./nodes/array.node";
import type DateGraphNode from "./nodes/date.node";
import type ErrorGraphNode from "./nodes/error.node";
import type FunctionGraphNode from "./nodes/function.node";
import type MapGraphNode from "./nodes/map.node";
import type ObjectGraphNode from "./nodes/object.node";
import type PrimitiveGraphNode from "./nodes/primitive.node";
import type RegExpGraphNode from "./nodes/regex.node";
import type SetGraphNode from "./nodes/set.node";
import type UnknownGraphNode from "./nodes/unknown.node";

export type PrimitiveType = 'number' | 'string' | 'boolean' | 'null' | 'undefined' | 'symbol' | 'bigint';
export type PrimtiveNodeData = number | string | boolean | null | undefined | symbol | bigint;
export type GraphNodeType = GraphNode['type'];

export type GraphNode =
    | PrimitiveGraphNode
    | ArrayGraphNode
    | SetGraphNode
    | MapGraphNode
    | RegExpGraphNode
    | DateGraphNode
    | ErrorGraphNode
    | FunctionGraphNode
    | ObjectGraphNode
    | UnknownGraphNode

export type GraphParentNode =
    | ArrayGraphNode
    | SetGraphNode
    | MapGraphNode
    | ObjectGraphNode;

export type GraphRefNode = GraphParentNode | FunctionGraphNode | ErrorGraphNode;

/**
 * Represents a single parsed stack trace frame in a normalized structure.
 *
 * This format is used to convert raw JavaScript stack traces into a
 * structured, machine-readable representation that can later be rendered
 * by the inspection system.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `StackTraceLine` abstracts a single line of a runtime stack trace
 * into a structured format that separates:
 *
 * - source location
 * - execution type
 * - optional function metadata
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE CATEGORIES
 * ---------------------------------------------------------------------
 *
 * - `file`   → normal source file execution
 * - `eval`   → evaluated code context
 * - `native` → internal runtime/native execution
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type StackTraceLine = {
    source: string;
    line: number;
    column: number;
    type: 'file' | 'eval' | 'native';
    functionName?: string;
};

/**
 * Structured runtime error payload used by `ErrorGraphNode`.
 *
 * This interface represents a fully normalized error extracted during
 * the graph construction phase.
 *
 * It is NOT a wrapper around JavaScript `Error`.
 * It is a deterministic intermediate representation.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This structure exists to decouple error representation from runtime
 * JavaScript engine behavior.
 *
 * It allows errors to be:
 *
 * - serialized safely
 * - rendered consistently
 * - tokenized deterministically
 * - reused in identity-aware pipelines
 *
 * ---------------------------------------------------------------------
 * 🔷 STACK MODEL
 * ---------------------------------------------------------------------
 *
 * The `stack` field is NOT a string array.
 *
 * Instead, it is a structured representation of stack frames:
 *
 * ```ts
 * StackTraceLine
 * ```
 *
 * Each entry may contain:
 *
 * - function name
 * - file location
 * - line/column metadata
 * - optional module/context hints
 *
 * This enables structured rendering and future filtering.
 *
 * ---------------------------------------------------------------------
 * 🔷 CAUSE CHAIN
 * ---------------------------------------------------------------------
 *
 * The optional `cause` field represents nested error propagation:
 *
 * - preserves error chaining (`cause`)
 * - is already graph-normalized (`GraphNode`)
 *
 * This ensures recursive error structures remain consistent with the
 * rest of the graph system.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * - eliminate runtime dependency on `Error`
 * - enable deterministic error serialization
 * - support structured stack rendering
 * - integrate with identity-aware graph system
 *
 * ---------------------------------------------------------------------
 */
export interface ErrorGraphNodeData {
    name: string;
    stack: StackTraceLine[];
    cause?: GraphNode;
    message?: string;
}