import TokensController from "../tokens/tokens.controller";
import ScopesController from "./scopes.controller";
import { ScopeCreateOptions } from "./types";

/**
 * Public renderer-facing transactional scope runtime.
 *
 * `ScopesRuntime` exposes controlled scope lifecycle operations over the
 * internal `ScopesController`.
 *
 * It provides renderers with the ability to:
 *
 * - create nested rendering scopes
 * - commit successful speculative work
 * - abort failed speculative work safely
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This runtime acts as the orchestration layer between:
 *
 * - renderer execution logic
 * - transactional rendering state
 * - token traversal rollback mechanics
 *
 * Unlike `ScopesController`, which only manages raw scope state,
 * `ScopesRuntime` coordinates:
 *
 * - scope creation
 * - traversal checkpoint capture
 * - rollback behavior
 * - transactional commit semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 TRANSACTIONAL MODEL
 * ---------------------------------------------------------------------
 *
 * Scopes behave similarly to transactional execution frames:
 *
 * ```txt
 * begin()
 *    ↓
 * speculative rendering work
 *    ↓
 * commit() OR abort()
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMIT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Committing a scope:
 *
 * - finalizes the scope successfully
 * - merges its writer output into the parent scope
 * - preserves all traversal mutations
 *
 * ---------------------------------------------------------------------
 * 🔷 ABORT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Aborting a scope:
 *
 * - discards the scope entirely
 * - rolls back injected traversal mutations
 * - restores traversal position consistency
 * - discards all speculative rendering output
 *
 * This enables safe speculative rendering and parsing behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLLBACK COORDINATION
 * ---------------------------------------------------------------------
 *
 * Rollback behavior is intentionally centralized here rather than exposed
 * directly to renderers.
 *
 * Renderers may:
 *
 * - begin scopes
 * - commit scopes
 * - abort scopes
 *
 * Renderers may NOT:
 *
 * - manipulate traversal cursors
 * - invoke rollback directly
 * - access rollback internals
 *
 * This preserves transactional correctness and prevents traversal-state
 * corruption.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE CURSOR SNAPSHOTS
 * ---------------------------------------------------------------------
 *
 * When a scope begins, the current traversal cursor is captured and stored
 * inside the scope state.
 *
 * This cursor acts as the rollback checkpoint used during abort.
 *
 * The captured cursor represents:
 *
 * > the most recently consumed token at scope creation time
 *
 * This is important because traversal cursors advance *before*
 * renderer dispatch occurs.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ScopesRuntime {
    /**
     * Internal scope controller.
     *
     * Owns the raw scope stack and writer composition mechanics.
     *
     * This controller is intentionally hidden from renderers to preserve
     * transactional guarantees.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_controller: ScopesController;

    /**
     * Internal token traversal controller.
     *
     * Used for:
     *
     * - traversal checkpoint capture
     * - rollback coordination during abort
     *
     * This controller remains internal to prevent renderers from coupling
     * themselves to traversal implementation details.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_tokens: TokensController;

    /**
     * Creates a new renderer-facing scope runtime.
     *
     * @param controller
     * Internal scope controller responsible for managing scope state.
     *
     * @param tokens
     * Internal token controller used for rollback coordination.
     *
     * @since 1.0.0
     */
    constructor(
        controller: ScopesController,
        tokens: TokensController
    ) {
        this.#_controller = controller;
        this.#_tokens = tokens;
    }

    /**
     * Indicates whether rendering is currently executing within the root scope.
     *
     * This is a renderer-facing proxy of the underlying scope controller state.
     *
     * The root scope represents the permanent rendering frame that exists for
     * the lifetime of the rendering session.
     *
     * This property is commonly used for invariant validation to ensure all
     * nested scopes have been properly committed or aborted before rendering
     * completes.
     *
     * Example:
     *
     * ```ts
     * if (!ctx.scopes.isRoot) {
     *     throw new Error(
     *         "Rendering ended at non-root scope."
     *     );
     * }
     * ```
     *
     * @returns
     * `true` if the current active scope is the root scope, otherwise `false`.
     *
     * @since 1.0.0
     */
    get isRoot() { return this.#_controller.isRoot; }

    /**
     * Begins a new nested rendering scope.
     *
     * A new scope is pushed onto the active scope stack and becomes the
     * current rendering context for subsequent operations.
     *
     * If no configuration is provided, a default empty configuration is used.
     *
     * ---------------------------------------------------------------------
     * 🔷 DX BEHAVIOR (IMPORTANT)
     * ---------------------------------------------------------------------
     *
     * This method does NOT require callers to pass an object.
     *
     * Both of the following are valid:
     *
     * ```ts
     * ctx.scopes.begin();
     * ctx.scopes.begin({ id: Symbol("scope") });
     * ```
     *
     * The configuration argument defaults to `{}` internally.
     *
     * ---------------------------------------------------------------------
     * 🔷 SCOPE INITIALIZATION
     * ---------------------------------------------------------------------
     *
     * When a scope is created:
     *
     * - the current writer is cloned and assigned to the new scope
     * - the current token cursor is captured as a rollback checkpoint
     * - a new isolated scope data store is created
     * - the scope is pushed onto the active scope stack
     *
     * ---------------------------------------------------------------------
     * 🔷 CURSOR SNAPSHOTTING
     * ---------------------------------------------------------------------
     *
     * The token traversal cursor is captured automatically at scope
     * creation time:
     *
     * - renderers cannot supply or override it
     * - it is used internally for rollback/abort operations
     *
     * ---------------------------------------------------------------------
     * 🔷 SPECULATIVE EXECUTION
     * ---------------------------------------------------------------------
     *
     * Scopes support speculative rendering operations such as:
     *
     * - token injection
     * - temporary rendering output
     * - nested structural exploration
     *
     * A scope may later be:
     *
     * - committed via `commit()`
     * - aborted via `abort()`
     *
     * ---------------------------------------------------------------------
     * @param config
     * Optional scope configuration.
     *
     * Supported fields:
     *
     * - `id?: symbol` — optional scope identifier
     * - `name?: string` — optional human-readable scope name
     *
     * If omitted, an empty configuration object is used.
     *
     * @since 1.0.0
     */
    begin(config: Omit<ScopeCreateOptions, 'cursor'> = {}): void {
        this.#_controller.create({
            ...config,
            cursor: this.#_tokens.cursor
        });
    }

    /**
     * Aborts the current active scope.
     *
     * Aborting a scope:
     *
     * - discards the scope entirely
     * - removes all speculative rendering output
     * - rolls back injected traversal mutations
     * - restores traversal consistency
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLLBACK PROCESS
     * ---------------------------------------------------------------------
     *
     * The rollback cursor captured during `begin()` is used to:
     *
     * - remove injected tokens created after scope creation
     * - restore deterministic traversal ordering
     *
     * Original tokens are preserved.
     *
     * ---------------------------------------------------------------------
     * 🔷 TRANSACTIONAL GUARANTEE
     * ---------------------------------------------------------------------
     *
     * After aborting:
     *
     * - traversal behaves as if the scope never existed
     * - speculative rendering side effects are discarded
     * - writer state is not merged into the parent scope
     *
     * ---------------------------------------------------------------------
     * @throws Error
     * If attempting to abort the root scope.
     *
     * @since 1.0.0
     */
    abort() {
        const removed = this.#_controller.abort();
        this.#_tokens.rollbackBefore(removed.cursor);
    }

    /**
     * Commits the current active scope.
     *
     * Committing a scope:
     *
     * - finalizes speculative rendering work
     * - merges the scope writer into the parent scope
     * - preserves all traversal mutations
     * - removes the scope from the stack
     *
     * ---------------------------------------------------------------------
     * 🔷 COMPOSITION MODEL
     * ---------------------------------------------------------------------
     *
     * Writer output is merged hierarchically:
     *
     * ```txt
     * child writer
     *      ↓ consume()
     * parent writer
     * ```
     *
     * This guarantees deterministic bottom-up rendering composition.
     *
     * ---------------------------------------------------------------------
     * 🔷 TRAVERSAL SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Unlike `abort()`, committing does not perform rollback.
     *
     * Any injected tokens or traversal mutations created during the scope
     * remain part of the active traversal stream.
     *
     * ---------------------------------------------------------------------
     * @throws Error
     * If attempting to commit the root scope.
     *
     * @since 1.0.0
     */
    commit() {
        this.#_controller.commit();
    }
}

export default ScopesRuntime;