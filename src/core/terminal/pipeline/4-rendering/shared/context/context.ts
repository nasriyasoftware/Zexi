import TraversalDepth from "./traversal/traversal.depth";
import TokensController from "./tokens/tokens.controller";
import RenderingWriter from "./writer/writer";
import ScopesController from "./scopes/scopes.controller";
import ScopesRuntime from "./scopes/runtime";
import TokensRuntime from "./tokens/runtime";
import type { Token } from "../../../3-tokenization/types";
import type { ScopeDataController } from "./scopes/types";

/**
 * Central orchestration context for the Zexi rendering pipeline.
 *
 * `ZexiRenderingContext` coordinates all runtime systems involved in
 * token-driven rendering, including:
 *
 * - token traversal and mutation
 * - nested scope lifecycle management
 * - structured writer composition
 * - traversal depth tracking
 * - scoped runtime state
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE OVERVIEW
 * ---------------------------------------------------------------------
 *
 * The rendering pipeline is built around three core internal controllers:
 *
 * - `TokensController`
 *   Manages mutable token traversal and injection.
 *
 * - `ScopesController`
 *   Manages hierarchical rendering scopes and writer composition.
 *
 * - `TraversalDepth`
 *   Tracks recursive structural depth shared across all scopes.
 *
 * These controllers are NOT exposed directly to renderers.
 *
 * Instead, renderers interact through restricted runtime APIs:
 *
 * - `TokensRuntime`
 * - `ScopesRuntime`
 *
 * This preserves strict internal invariants while exposing only the
 * operations required during rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE MODEL
 * ---------------------------------------------------------------------
 *
 * Rendering is performed using a strict stack-based scope system.
 *
 * Example:
 *
 * ```text
 * [ root scope ]
 * [ scope A ]
 * [ scope B ] ← current scope
 * ```
 *
 * Each scope owns:
 *
 * - an isolated writer
 * - local scoped data
 * - a traversal cursor snapshot
 *
 * Scopes are always entered and exited in LIFO order.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * New scopes are created through:
 *
 * ```ts
 * context.scopes.begin(...)
 * ```
 *
 * The runtime automatically captures the current token cursor
 * at scope creation time.
 *
 * Scopes may later be:
 *
 * - committed
 * - aborted
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMIT MODEL
 * ---------------------------------------------------------------------
 *
 * Committing a scope:
 *
 * - removes the scope from the stack
 * - preserves traversal progress
 * - merges child writer output into parent writer
 *
 * Example:
 *
 * ```text
 * child writer → parent writer
 * ```
 *
 * This enables deterministic bottom-up rendering composition.
 *
 * ---------------------------------------------------------------------
 * 🔷 ABORT MODEL
 * ---------------------------------------------------------------------
 *
 * Aborting a scope:
 *
 * - destroys the scope
 * - discards all scope-local data
 * - discards scope writer output
 * - rolls token traversal back to the scope entry point
 * - removes injected tokens created after scope creation
 *
 * This enables speculative rendering and reversible parsing behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN TRAVERSAL MODEL
 * ---------------------------------------------------------------------
 *
 * Token traversal is globally shared across all scopes through a single
 * `TokensController` instance.
 *
 * Traversal behavior is cursor-based:
 *
 * - cursor points to most recently consumed token
 * - `next()` advances traversal
 * - `peek()` performs non-mutating lookahead
 * - `inject()` inserts runtime tokens into the stream
 *
 * Injected tokens become immediately visible to traversal.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN ROLLBACK MODEL
 * ---------------------------------------------------------------------
 *
 * Internal rollback behavior is intentionally hidden from renderers.
 *
 * Only `ScopesRuntime.abort()` may trigger rollback semantics.
 *
 * During rollback:
 *
 * - injected tokens created after the captured cursor are removed
 * - original source tokens remain intact
 * - traversal resumes from the scope entry boundary
 *
 * This guarantees deterministic recovery behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITER MODEL
 * ---------------------------------------------------------------------
 *
 * Each scope owns an isolated `RenderingWriter`.
 *
 * Writers are created using:
 *
 * ```ts
 * RenderingWriter.from(parentWriter)
 * ```
 *
 * This ensures:
 *
 * - inherited formatting configuration
 * - shared traversal depth tracking
 * - isolated output buffering
 *
 * Writers are merged ONLY during valid scope commits.
 *
 * ---------------------------------------------------------------------
 * 🔷 DEPTH MODEL
 * ---------------------------------------------------------------------
 *
 * A single shared `TraversalDepth` instance is used across the entire
 * rendering pipeline.
 *
 * This guarantees:
 *
 * - consistent indentation
 * - synchronized nesting depth
 * - deterministic recursive rendering behavior
 *
 * All writers reference the same depth tracker.
 *
 * ---------------------------------------------------------------------
 * 🔷 DATA MODEL
 * ---------------------------------------------------------------------
 *
 * Scope-local runtime state is exposed through `data`.
 *
 * Data resolution follows lexical-style shadowing:
 *
 * - current scope checked first
 * - parent scopes checked recursively
 * - root scope checked last
 *
 * Scope data is isolated and automatically discarded when a scope exits.
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME API ISOLATION
 * ---------------------------------------------------------------------
 *
 * Renderers never receive direct access to:
 *
 * - internal controllers
 * - rollback operations
 * - cursor mutation
 * - internal scope stack
 *
 * Instead, restricted runtime APIs enforce safe interaction boundaries.
 *
 * This prevents renderer implementations from violating rendering
 * invariants accidentally.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROOT SCOPE
 * ---------------------------------------------------------------------
 *
 * The root scope is automatically created during construction.
 *
 * The root scope:
 *
 * - always exists
 * - owns the root writer
 * - cannot be committed
 * - cannot be aborted
 *
 * It acts as the permanent base rendering frame.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * The following invariants are strictly enforced:
 *
 * - scopes are strictly LIFO
 * - root scope cannot be removed
 * - writer composition occurs only during commit
 * - rollback occurs only during abort
 * - traversal cursor ownership is internal
 * - renderers cannot mutate controller internals directly
 *
 * Violating these invariants indicates rendering pipeline corruption.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ZexiRenderingContext {
    /**
     * Shared traversal depth tracker.
     *
     * This instance is shared globally across all rendering scopes and
     * writers to maintain deterministic structural depth semantics.
     *
     * Used for:
     *
     * - indentation calculation
     * - recursive nesting tracking
     * - structural hierarchy awareness
     *
     * @since 1.0.0
     */
    readonly #_depth = new TraversalDepth();

    /**
     * Internal mutable token traversal controller.
     *
     * Responsible for:
     *
     * - sequential token traversal
     * - token injection
     * - rollback behavior
     * - cursor management
     *
     * This controller is intentionally hidden from renderers.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_tokens: TokensController;

    /**
     * Internal rendering scope controller.
     *
     * Responsible for:
     *
     * - scope stack management
     * - scope lifecycle operations
     * - writer composition
     * - scoped data isolation
     *
     * This controller is intentionally hidden from renderers.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_scopes: ScopesController;

    /**
     * Creates a new rendering context.
     *
     * Initializes:
     *
     * - the shared traversal depth tracker
     * - the token traversal controller
     * - the root rendering scope
     * - runtime-safe APIs for renderers
     *
     * -----------------------------------------------------------------
     * 🔷 ROOT INITIALIZATION
     * -----------------------------------------------------------------
     *
     * During construction:
     *
     * - a root `RenderingWriter` is created
     * - the root scope is initialized automatically
     * - the root scope cursor is initialized to `-1`
     *
     * The root scope remains active for the entire lifetime
     * of the rendering context.
     *
     * -----------------------------------------------------------------
     * @param tokens
     * Immutable source token stream consumed by the rendering pipeline.
     *
     * The token array is internally cloned by `TokensController`
     * to guarantee traversal isolation.
     *
     * @param config
     * Rendering configuration object.
     *
     * @param config.spaces
     * Number of spaces used per indentation level.
     *
     * This value is inherited by all writers created throughout
     * nested scopes.
     *
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    constructor(
        /**
         * Immutable array of tokens that will be consumed by the rendering
         * pipeline via a shared `TokensController`.
         */
        tokens: readonly Token[],

        /** Configuration object controlling rendering behavior. */
        config: {
            /** Number of spaces used per indentation level. */
            spaces: number
        }
    ) {
        this.#_tokens = new TokensController(tokens);
        this.#_scopes = new ScopesController(new RenderingWriter({
            depth: this.#_depth,
            spaces: config.spaces
        }));

        this.scopes = new ScopesRuntime(this.#_scopes, this.#_tokens);
        this.tokens = new TokensRuntime(this.#_tokens);
        this.data = this.#_scopes.data;
    }

    /**
     * Shared traversal depth tracker.
     *
     * Exposes the globally shared `TraversalDepth` instance used by all
     * rendering writers and nested scopes.
     *
     * @returns Shared traversal depth tracker
     *
     * @since 1.0.0
     */
    get depth() {
        return this.#_depth;
    }

    /**
     * Current active rendering writer.
     *
     * Always resolves to the writer owned by the current active scope.
     *
     * This writer represents the active output buffer receiving rendered
     * content at the current point in traversal.
     *
     * @returns Current active scope writer
     *
     * @since 1.0.0
     */
    get writer() {
        return this.#_scopes.current.writer;
    }

    /**
     * Scoped runtime data controller.
     *
     * Provides lexical-style scoped storage and chain-based lookup.
     *
     * Used for:
     *
     * - temporary renderer state
     * - intermediate parsing metadata
     * - nested rendering coordination
     *
     * @since 1.0.0
     */
    readonly data: ScopeDataController;

    /**
     * Restricted scope lifecycle runtime API.
     *
     * Exposes safe scope operations to renderers while hiding internal
     * controller mechanics such as rollback coordination.
     *
     * @since 1.0.0
     */
    readonly scopes: ScopesRuntime;

    /**
     * Restricted token traversal runtime API.
     *
     * Exposes safe token traversal and injection operations while hiding
     * internal cursor mutation and rollback behavior.
     *
     * @since 1.0.0
     */
    readonly tokens: TokensRuntime;
}

export default ZexiRenderingContext;