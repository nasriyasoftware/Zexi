import TOKENS from "./tokens";
import TokensBuffer from "./container/tokens.buffer";
import type { RepRefNode } from "../2-representation/types";
import type { StackTraceLine } from "../1-graphing/types";

export type Token = InstanceType<typeof TOKENS[keyof typeof TOKENS]>;

/**
 * Defines the allowed syntactic forms for key-value separation
 * across different rendering styles.
 *
 * This type does NOT represent runtime behavior. Instead, it encodes
 * the *presentation intent* of a key-value relationship so that
 * renderers can adapt formatting based on output target.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * Different output formats express key-value relationships differently:
 *
 * - Object notation → ":"
 * - Assignment notation → "="
 * - Arrow/map notation → "=>"
 *
 * This union type ensures that only supported separator styles are
 * used during token construction.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING IMPACT
 * ---------------------------------------------------------------------
 *
 * Renderers may use this value to:
 *
 * - switch formatting mode (JSON vs debug vs map output)
 * - adjust spacing rules around separators
 * - control alignment in pretty layouts
 *
 * ---------------------------------------------------------------------
 * 🔷 EXTENSIBILITY NOTE
 * ---------------------------------------------------------------------
 *
 * This type is intentionally restrictive to preserve consistent output
 * semantics across all renderers.
 *
 * Adding new separator styles should be done cautiously, as it affects
 * all downstream rendering strategies.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type SeparatorTokenValue = ':' | '=' | '=>';

export type TokenizationCacheEntry = {
    node: RepRefNode;
    buffer: TokensBuffer;
    count: number;
}

/**
 * Semantic token representing a structured runtime error.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ErrorToken` is the final semantic representation of an error
 * within the tokenization phase.
 *
 * It no longer operates on raw JavaScript `Error` objects.
 * Instead, it consumes a fully normalized data structure produced by
 * the representation layer.
 *
 * This ensures:
 *
 * - complete decoupling from runtime error objects
 * - deterministic rendering input
 * - structured stack trace representation
 * - composable error chains via token buffers
 *
 * ---------------------------------------------------------------------
 * 🔷 DATA MODEL
 * ---------------------------------------------------------------------
 *
 * The token is constructed from:
 *
 * ```ts
 * interface ErrorTokenData {
 *   name: string;
 *   message?: string;
 *   stack: StackTraceLine[];
 *   cause?: TokensBuffer;
 * }
 * ```
 *
 * Where:
 *
 * - `name` → runtime error class name (e.g. `"TypeError"`)
 * - `message` → optional error message
 * - `stack` → pre-parsed stack trace lines
 * - `cause` → optional token buffer representing nested error chain
 *
 * ---------------------------------------------------------------------
 * 🔷 CAUSE SEMANTICS (IMPORTANT CHANGE)
 * ---------------------------------------------------------------------
 *
 * Unlike earlier versions where `cause` referenced a single token,
 * the new design uses:
 *
 * ```ts
 * TokensBuffer
 * ```
 *
 * This allows:
 *
 * - multi-token error representations
 * - nested error formatting (multi-line causes)
 * - structured stack + metadata chaining
 * - consistent composition with other tokenized structures
 *
 * Example:
 *
 * ```text
 * Error: root failure
 *   ↳ Caused by:
 *     TypeError: inner failure
 * ```
 *
 * becomes a buffered token stream rather than a single node.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * Tokenization pipeline position:
 *
 * ```text
 * ErrorGraphNode
 *        ↓
 * ErrorRepresentationNode
 *        ↓
 * ErrorToken
 *        ↓
 * TokensBuffer (stream of tokens)
 *        ↓
 * Rendering layer
 * ```
 *
 * This ensures errors are fully decomposed into renderable streams.
 *
 * ---------------------------------------------------------------------
 * 🔷 STACK TRACE MODEL
 * ---------------------------------------------------------------------
 *
 * Stack traces are assumed to be already normalized before tokenization.
 *
 * The token does NOT parse stack strings.
 *
 * Instead it receives:
 *
 * - structured `StackTraceLine[]`
 * - already filtered and normalized by graphing phase
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * All properties are immutable after construction:
 *
 * - error name
 * - message
 * - stack frames
 * - cause buffer reference
 *
 * This guarantees deterministic rendering output.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * This token does NOT define visual layout.
 *
 * Renderers decide:
 *
 * - indentation
 * - collapse/expand behavior
 * - ANSI styling
 * - inline vs multiline rendering
 * - cause expansion formatting
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface ErrorTokenData {
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
     * Optional buffered token stream representing the causal chain.
     *
     * This allows multi-token nested error rendering instead of a single
     * flattened token reference.
     *
     * Typically includes:
     *
     * - separator tokens
     * - nested ErrorToken streams
     * - indentation tokens
     *
     * @since 1.0.0
     */
    cause?: TokensBuffer;

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