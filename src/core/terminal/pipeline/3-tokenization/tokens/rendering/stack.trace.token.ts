import BaseToken from "../assets/__base.token__";
import buildStack from "../../../1-graphing/helpers/build.stack";
import type { StackTraceLine } from "../../../1-graphing/types";
import { ErrorStartToken } from "../tokenization/error";

/**
 * Structured stack trace token used for expanded diagnostic rendering.
 *
 * `StackTraceToken` represents a normalized, renderer-readable stack trace
 * that can be safely consumed by rendering engines without requiring
 * repeated parsing or transformation logic.
 *
 * Unlike raw JavaScript stack strings, this token stores stack frames
 * in a structured immutable format that enables renderers to:
 *
 * - apply syntax highlighting
 * - render multiline stack traces
 * - collapse or expand frames
 * - filter internal frames
 * - generate clickable source references
 * - support compact and pretty layouts
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `StackTraceToken` belongs to the semantic rendering token layer.
 *
 * It acts as a transport-safe representation of diagnostic stack data
 * between tokenization and rendering.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * Error Representation
 *        ↓
 * Tokenization
 *        ↓
 * StackTraceToken
 *        ↓
 * Renderer
 *        ↓
 * Styled / formatted output
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This token exists to decouple:
 *
 * - raw runtime stack traces
 * - stack parsing logic
 * - renderer formatting behavior
 *
 * By normalizing stack traces into structured frames, renderers can
 * operate deterministically without implementing parsing logic
 * themselves.
 *
 * ---------------------------------------------------------------------
 * 🔷 STACK OWNERSHIP MODEL
 * ---------------------------------------------------------------------
 *
 * `StackTraceToken` may optionally belong to an error rendering scope.
 *
 * Ownership is established by passing the originating
 * `ErrorStartToken` during construction.
 *
 * This allows renderers to distinguish between:
 *
 * - standalone stack trace rendering
 * - error-owned diagnostic stack traces
 *
 * without relying on ambient traversal state.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMPORTANT
 * ---------------------------------------------------------------------
 *
 * Ownership is intentionally established using the originating
 * token instance itself rather than a raw symbol identifier.
 *
 * This guarantees that:
 *
 * - stack traces cannot attach to arbitrary scope ids
 * - ownership relationships remain explicit
 * - token origin semantics remain traceable
 * - renderer coordination stays structurally safe
 *
 * ---------------------------------------------------------------------
 * 🔷 STACK NORMALIZATION
 * ---------------------------------------------------------------------
 *
 * `StackTraceToken` accepts either:
 *
 * - a raw JavaScript stack trace string
 * - pre-normalized `StackTraceLine[]`
 *
 * When a raw string is provided, the constructor internally normalizes
 * the stack using:
 *
 * - `buildStack`
 *
 * This process:
 *
 * - splits the raw stack trace
 * - parses stack frames
 * - extracts structured location metadata
 * - converts frames into `StackTraceLine` objects
 *
 * When pre-normalized lines are provided directly, no parsing occurs.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Stack trace frames are immutable after construction.
 *
 * The internal frame array is:
 *
 * - cloned during initialization
 * - frozen using `Object.freeze`
 *
 * This guarantees:
 *
 * - deterministic renderer behavior
 * - protection against external mutation
 * - stable rendering semantics across pipeline stages
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Renderers may interpret this token differently depending on:
 *
 * - rendering target
 * - verbosity mode
 * - layout strategy
 * - ownership semantics
 *
 * Example rendering styles:
 *
 * - multiline expanded traces
 * - compact single-line previews
 * - syntax-highlighted terminal frames
 * - structured debug diagnostics
 * - nested error diagnostics
 *
 * The token itself defines NO visual behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `StackTraceToken` represents a structured multiline rendering unit.
 *
 * Renderers commonly pair it with:
 *
 * - indentation scopes
 * - hard line tokens
 * - ANSI formatting tokens
 * - group layout boundaries
 *
 * during expanded diagnostic rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL GUARANTEE
 * ---------------------------------------------------------------------
 *
 * `StackTraceToken` guarantees:
 *
 * - stable frame ordering
 * - immutable frame storage
 * - renderer-safe structured access
 * - deterministic ownership semantics
 * - deterministic output semantics
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class StackTraceToken extends BaseToken<'stack-trace'> {
    /**
     * Immutable normalized stack trace frames.
     *
     * Each frame represents a structured stack entry extracted from
     * a runtime stack trace.
     *
     * The frame array is frozen and cannot be mutated after construction.
     *
     * @since 1.0.0
     */
    readonly #_lines: readonly StackTraceLine[];

    /**
     * Optional owning error scope identifier.
     *
     * When present, this stack trace is considered part of an
     * error diagnostic rendering scope.
     *
     * The identifier originates exclusively from an
     * `ErrorStartToken`.
     *
     * -----------------------------------------------------------------
     * 🔷 IMPORTANT
     * -----------------------------------------------------------------
     *
     * This field is intentionally NOT publicly mutable.
     *
     * Ownership semantics are established only during token creation
     * to guarantee structural consistency across rendering phases.
     *
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_errorId?: symbol;

    /**
     * Creates a new structured stack trace token.
     *
     * The provided input may be either:
     *
     * - a raw stack trace string
     * - pre-normalized stack frames
     * - `undefined` for an empty stack
     *
     * Raw stack strings are normalized automatically using `buildStack`.
     *
     * Pre-normalized frame arrays are shallow-cloned and frozen to
     * preserve immutability guarantees.
     *
     * -----------------------------------------------------------------
     * 🔷 ERROR OWNERSHIP
     * -----------------------------------------------------------------
     *
     * An optional `ErrorStartToken` may be provided to associate
     * this stack trace with a specific error rendering scope.
     *
     * When provided:
     *
     * - the error scope id is captured internally
     * - ownership becomes immutable
     * - renderers may apply error-aware formatting semantics
     *
     * -----------------------------------------------------------------
     *
     * @param stack
     * Raw stack string or normalized stack frames.
     *
     * @param errorToken
     * Optional originating error token used to establish
     * error ownership semantics.
     *
     * @since 1.0.0
     */
    constructor(
        stack: string | undefined | StackTraceLine[],
        errorToken?: ErrorStartToken
    ) {
        super('stack-trace');
        this.#_lines = Object.freeze(
            typeof stack === 'string'
                ? buildStack(stack)
                : [...(stack ?? [])]
        );

        if (errorToken instanceof ErrorStartToken) {
            this.#_errorId = errorToken.id;
        }
    }

    /**
     * Returns stack trace ownership semantics.
     *
     * Ownership determines whether this stack trace:
     *
     * - exists independently
     * - belongs to an error diagnostic scope
     *
     * Renderers may use this information to:
     *
     * - apply nested error formatting
     * - group stack traces with parent errors
     * - enable diagnostic collapsing behavior
     * - distinguish standalone traces from error metadata
     *
     * -----------------------------------------------------------------
     * 🔷 OWNERSHIP VALUES
     * -----------------------------------------------------------------
     *
     * - `standalone`
     *   Independent stack trace token
     *
     * - `error`
     *   Stack trace owned by an error scope
     *
     * -----------------------------------------------------------------
     *
     * @returns Ownership classification.
     *
     * @since 1.0.0
     */
    get ownership(): 'standalone' | 'error' {
        return this.#_errorId ? 'error' : 'standalone';
    }

    /**
     * Returns the owning error scope identifier if present.
     *
     * This identifier matches the originating `ErrorStartToken`
     * used during construction.
     *
     * Standalone stack traces return `undefined`.
     *
     * @returns Owning error scope id or `undefined`
     *
     * @since 1.0.0
     */
    get errorId(): symbol | undefined {
        return this.#_errorId;
    }

    /**
     * Returns immutable normalized stack trace frames.
     *
     * These frames are renderer-ready and may be used for:
     *
     * - multiline rendering
     * - syntax highlighting
     * - source formatting
     * - debug inspection
     * - stack visualization tooling
     *
     * @returns Immutable stack trace frames
     *
     * @since 1.0.0
     */
    get lines() {
        return this.#_lines;
    }
}