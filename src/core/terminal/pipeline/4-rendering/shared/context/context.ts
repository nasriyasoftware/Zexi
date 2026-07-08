import TraversalDepth from "./traversal/traversal.depth";
import TokensController from "./tokens/tokens.controller";
import RenderingWriter from "./writer/writer";
import ScopesController from "./scopes/scopes.controller";
import ScopesRuntime from "./scopes/runtime";
import TokensRuntime from "./tokens/runtime";
import type { Token } from "../../../3-tokenization/types";
import type { ScopeDataController } from "./scopes/types";

/**
 * Central execution context for the Zexi rendering pipeline.
 *
 * `ZexiRenderingContext` is the runtime kernel responsible for coordinating
 * deterministic rendering of a tokenized representation into its final
 * textual output.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE POSITION
 * ---------------------------------------------------------------------
 *
 * This context forms the execution environment of the final pipeline stage:
 *
 * ```txt
 * Graphing
 *   ↓
 * Representation
 *   ↓
 * Tokenization
 *   ↓
 * ZexiRenderingContext
 *   ↓
 * Final Output
 * ```
 *
 * It bridges:
 *
 * - token traversal (`TokensController`)
 * - rendering scopes (`ScopesController`)
 * - output composition (`RenderingWriter`)
 * - shared traversal depth tracking
 * - scoped runtime metadata
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This context is an active runtime, not merely a container of shared
 * objects.
 *
 * It owns and coordinates:
 *
 * - sequential token traversal
 * - scoped rendering execution
 * - writer lifecycle and composition
 * - indentation state
 * - runtime metadata
 *
 * All renderers execute exclusively through this context.
 *
 * ---------------------------------------------------------------------
 * 🔷 OWNERSHIP MODEL
 * ---------------------------------------------------------------------
 *
 * The context establishes strict ownership boundaries.
 *
 * ### Internal components (not exposed directly)
 *
 * - `TokensController`
 *   → traversal state and cursor management
 *
 * - `ScopesController`
 *   → scope stack, writer orchestration and lifecycle
 *
 * - `RenderingWriter`
 *   → output generation
 *
 * ### Public runtime APIs
 *
 * - `tokens`
 *   → controlled traversal API
 *
 * - `scopes`
 *   → controlled scope lifecycle API
 *
 * - `writer`
 *   → current active rendering writer
 *
 * - `data`
 *   → scoped runtime metadata
 *
 * - `depth`
 *   → shared structural depth tracker
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION MODEL
 * ---------------------------------------------------------------------
 *
 * Rendering proceeds as a deterministic forward traversal over the
 * token stream.
 *
 * During execution, renderers may:
 *
 * - consume tokens
 * - inspect upcoming tokens
 * - open nested rendering scopes
 * - write formatted output
 * - maintain scoped metadata
 *
 * The traversal order is strictly linear and deterministic.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE MODEL
 * ---------------------------------------------------------------------
 *
 * Rendering scopes provide isolated execution environments.
 *
 * Each scope owns:
 *
 * - its own writer
 * - its own scoped metadata
 * - a traversal checkpoint
 *
 * Nested scopes inherit structural state while remaining isolated until
 * committed.
 *
 * Committing a scope merges its writer into the parent scope.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITER MODEL
 * ---------------------------------------------------------------------
 *
 * The active writer is always the writer associated with the current
 * rendering scope.
 *
 * Writers:
 *
 * - accumulate formatted output
 * - share the global traversal depth
 * - remain isolated until committed
 *
 * The context exposes only the current active writer.
 *
 * ---------------------------------------------------------------------
 * 🔷 DEPTH MODEL
 * ---------------------------------------------------------------------
 *
 * A single shared `TraversalDepth` instance is used throughout the entire
 * rendering execution.
 *
 * It represents logical nesting depth and is shared by every writer
 * created within the context.
 *
 * ---------------------------------------------------------------------
 * 🔷 DATA MODEL
 * ---------------------------------------------------------------------
 *
 * `data` provides hierarchical runtime metadata bound to rendering scopes.
 *
 * Resolution follows lexical scope rules:
 *
 * - current scope
 * - parent scopes
 * - root scope
 *
 * Data is automatically discarded when its owning scope exits.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROOT SCOPE GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Construction automatically creates a permanent root rendering scope.
 *
 * The root scope:
 *
 * - owns the initial writer
 * - cannot be removed
 * - remains active for the lifetime of the context
 *
 * ---------------------------------------------------------------------
 * 🔷 DETERMINISM GUARANTEE
 * ---------------------------------------------------------------------
 *
 * Identical token streams always produce identical output.
 *
 * This guarantee is achieved through:
 *
 * - deterministic token traversal
 * - deterministic scope behavior
 * - isolated writers
 * - shared traversal depth
 * - explicit scope commits
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This class provides a single, unified execution surface for rendering.
 *
 * It centralizes all runtime state required during rendering while hiding
 * internal controllers behind safe runtime APIs.
 *
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
            spaces: number;

            /** Maximum output line width. */
            maxWidth?: number;
        }
    ) {
        this.#_tokens = new TokensController(tokens);
        this.#_scopes = new ScopesController(new RenderingWriter({
            depth: this.#_depth,
            spaces: config.spaces,
            maxWidth: config.maxWidth
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