import type RenderingWriter from "../writer/writer";

/**
 * Defines the API for interacting with scope-local and chain-resolved
 * rendering state data.
 *
 * The `ScopeDataController` provides a controlled interface for:
 *
 * - reading scoped values
 * - checking local scope ownership
 * - checking inherited bindings
 * - checking chain-wide resolvability
 * - setting values with overwrite protection
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN MODEL
 * ---------------------------------------------------------------------
 *
 * This controller operates on a stack of scope frames where:
 *
 * - each scope owns its own isolated data map
 * - lookup operations traverse the scope chain (top → bottom)
 * - write operations always target the current active scope
 *
 * ---------------------------------------------------------------------
 * 🔷 RESOLUTION MODEL
 * ---------------------------------------------------------------------
 *
 * Key existence can be queried at three different levels:
 *
 * - `hasOwn()` → current scope only
 * - `hasInherited()` → parent scopes only
 * - `hasResolvable()` → current scope or any parent scope
 *
 * This allows renderers to distinguish between:
 *
 * - locally-owned values
 * - inherited values
 * - values that can be resolved regardless of origin
 *
 * @since 1.0.0
 */
export interface ScopeDataController {
    /**
     * Retrieves a value from the scope chain.
     *
     * The lookup starts from the current scope and traverses downward
     * through parent scopes until a matching key is found.
     *
     * @typeParam T
     * Expected return type of the stored value.
     *
     * @param key
     * The key to retrieve from the scope chain.
     *
     * @returns
     * The value associated with the key, or `null` if not found.
     *
     * @since 1.0.0
     */
    get<T = unknown>(key: ScopeKey): T | null;

    /**
     * Checks whether a key is owned by the current active scope.
     *
     * This operation does NOT traverse parent scopes.
     *
     * @param key
     * The key to check.
     *
     * @returns
     * `true` if the key exists in the current scope, otherwise `false`.
     *
     * @since 1.0.0
     */
    hasOwn(key: ScopeKey): boolean;

    /**
     * Checks whether a key exists in any parent scope.
     *
     * The current scope is intentionally excluded from this lookup.
     *
     * This is useful for detecting inherited values or determining
     * whether a local binding shadows an ancestor binding.
     *
     * @param key
     * The key to search for.
     *
     * @returns
     * `true` if the key exists in a parent scope, otherwise `false`.
     *
     * @since 1.0.0
     */
    hasInherited(key: ScopeKey): boolean;

    /**
     * Checks whether a key can be resolved from the current scope chain.
     *
     * This operation searches:
     *
     * - the current scope
     * - all parent scopes
     *
     * and returns whether a matching binding exists anywhere in the
     * active scope hierarchy.
     *
     * This is equivalent to asking whether a subsequent call to
     * `get()` would return a non-null value.
     *
     * @param key
     * The key to search for.
     *
     * @returns
     * `true` if the key can be resolved from the scope chain,
     * otherwise `false`.
     *
     * @since 1.0.0
     */
    hasResolvable(key: ScopeKey): boolean;

    /**
     * Sets a value in the current active scope.
     *
     * By default, overwriting an existing key in the current scope is
     * considered a violation and will throw an error.
     *
     * ---------------------------------------------------------------------
     * 🔷 OVERWRITE BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - `overwrite: false` → throws if key already exists in current scope
     * - `overwrite: true` → allows replacing the value in current scope
     *
     * This does NOT affect parent scopes.
     *
     * @param key
     * The key to assign in the current scope.
     *
     * @param value
     * The value to store in the current scope.
     *
     * @param options
     * Optional behavior configuration.
     *
     * @since 1.0.0
     */
    set(key: ScopeKey, value: any, options?: ScopeDataSetOptions): void;
}

/**
 * Represents a single execution scope in the rendering pipeline.
 *
 * A scope is an isolated rendering frame participating in the
 * hierarchical scope stack managed by `ScopesController`.
 *
 * Each scope encapsulates:
 *
 * - immutable scope identity
 * - token traversal rollback state
 * - isolated rendering output
 * - local scoped data
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * `ScopeState` exists to model nested rendering execution contexts
 * with deterministic isolation semantics.
 *
 * This enables advanced rendering behavior such as:
 *
 * - nested structural rendering
 * - speculative parsing
 * - transactional rendering
 * - rollback-safe token injection
 * - lexical scoped state resolution
 *
 * ---------------------------------------------------------------------
 * 🔷 STACK MODEL
 * ---------------------------------------------------------------------
 *
 * Scopes exist in a strict LIFO stack:
 *
 * ```txt
 * [ root ]
 * [ group ]
 * [ error ]
 * [ cause ] ← current
 * ```
 *
 * Rules:
 *
 * - only the top-most scope is active
 * - scopes may only be removed from the top
 * - child scopes inherit rendering state from parent scopes
 * - scope-local state remains isolated
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITER ISOLATION
 * ---------------------------------------------------------------------
 *
 * Every scope owns its own `RenderingWriter`.
 *
 * Child writers are cloned from the parent writer using:
 *
 * ```ts
 * RenderingWriter.from(parent.writer)
 * ```
 *
 * This ensures:
 *
 * - isolated rendering accumulation
 * - deterministic nested composition
 * - rollback-safe speculative rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR SNAPSHOT MODEL
 * ---------------------------------------------------------------------
 *
 * Each scope stores the token traversal cursor position captured
 * immediately before the scope was created.
 *
 * This cursor acts as a rollback checkpoint for speculative parsing.
 *
 * Example:
 *
 * ```txt
 * cursor = 5
 * create scope
 *
 * inject speculative tokens...
 *
 * abort scope
 * rollbackBefore(5)
 * ```
 *
 * The stored cursor itself does not perform rollback automatically.
 *
 * Higher-level orchestration layers are responsible for invoking
 * rollback operations using this cursor value.
 *
 * ---------------------------------------------------------------------
 * 🔷 DATA ISOLATION MODEL
 * ---------------------------------------------------------------------
 *
 * Each scope owns a dedicated local data map:
 *
 * ```ts
 * Map<ScopeKey, unknown>
 * ```
 *
 * Data:
 *
 * - belongs exclusively to the scope
 * - is destroyed when the scope is removed
 * - participates in chain-based lexical lookup
 * - is never structurally shared
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * Scopes are:
 *
 * - created via `ScopesController.create`
 * - committed via `ScopesController.commit`
 * - discarded via `ScopesController.abort`
 *
 * When a scope is removed:
 *
 * - its local data is destroyed
 * - its writer is either committed or discarded
 * - its cursor may be used for rollback recovery
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface ScopeState {
    /**
     * Unique immutable identifier for this scope.
     *
     * Used internally for:
     *
     * - scope identity tracking
     * - debugging
     * - invariant enforcement
     *
     * @since 1.0.0
     */
    readonly id: symbol;

    /**
     * Token traversal cursor snapshot captured at scope creation.
     *
     * This cursor represents the traversal position immediately
     * before the scope began execution.
     *
     * It is primarily used for:
     *
     * - speculative parsing recovery
     * - injected token rollback
     * - transactional rendering semantics
     *
     * Example:
     *
     * ```txt
     * cursor = 10
     * create scope
     *
     * inject tokens...
     *
     * abort scope
     * rollbackBefore(10)
     * ```
     *
     * The cursor itself is immutable and does not automatically
     * trigger rollback behavior.
     *
     * @since 1.0.0
     */
    readonly cursor: number;

    /**
     * Optional human-readable scope name.
     *
     * Useful for:
     *
     * - diagnostics
     * - debug tracing
     * - rendering instrumentation
     * - stack inspection
     *
     * Names are not required to be unique.
     *
     * @since 1.0.0
     */
    readonly name?: string;

    /**
     * Rendering writer owned by this scope.
     *
     * The writer accumulates rendering output locally until the scope
     * is either:
     *
     * - committed into its parent
     * - discarded during abort
     *
     * Writers are isolated per scope to guarantee deterministic
     * rendering behavior.
     *
     * @since 1.0.0
     */
    readonly writer: RenderingWriter;

    /**
     * Local scope data storage.
     *
     * Stores values owned exclusively by this scope.
     *
     * Data is:
     *
     * - mutable within the active scope
     * - isolated from sibling scopes
     * - chain-resolvable by lexical lookup
     * - destroyed immediately when scope exits
     *
     * Parent scopes are never mutated automatically.
     *
     * @since 1.0.0
     */
    readonly data: Map<ScopeKey, unknown>
}

/**
 * Configuration object used when creating a new rendering scope.
 *
 * `ScopeCreateOptions` defines the metadata and rollback state
 * associated with a newly created scope.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR REQUIREMENT
 * ---------------------------------------------------------------------
 *
 * The `cursor` field is required because every scope must capture
 * the traversal position from which speculative execution began.
 *
 * This enables deterministic rollback semantics if the scope is later
 * aborted.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTITY MODEL
 * ---------------------------------------------------------------------
 *
 * Scope identity may either:
 *
 * - be provided explicitly
 * - be generated automatically by the controller
 *
 * Explicit IDs are useful for:
 *
 * - debugging
 * - deterministic tracing
 * - external scope coordination
 *
 * ---------------------------------------------------------------------
 * 🔷 NAMING MODEL
 * ---------------------------------------------------------------------
 *
 * The optional `name` field exists purely for diagnostics and
 * debugging visibility.
 *
 * It has no semantic effect on rendering behavior.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface ScopeCreateOptions {
    /**
     * Optional explicit scope identifier.
     *
     * If omitted, the controller generates a unique symbol.
     *
     * Useful for:
     *
     * - diagnostics
     * - deterministic tracing
     * - external coordination
     *
     * @since 1.0.0
     */
    id?: symbol;

    /**
     * Optional human-readable scope name.
     *
     * Primarily useful for:
     *
     * - debugging
     * - logging
     * - tracing nested rendering operations
     *
     * Names are not required to be unique.
     *
     * @since 1.0.0
     */
    name?: string;

    /**
     * Token traversal cursor snapshot captured before scope creation.
     *
     * This cursor becomes the rollback checkpoint associated with
     * the scope.
     *
     * If the scope is later aborted, higher-level systems may use
     * this cursor to restore token traversal state.
     *
     * Example:
     *
     * ```ts
     * scopes.create({
     *   cursor: tokens.cursor
     * });
     * ```
     *
     * @since 1.0.0
     */
    cursor: number;
}

/**
 * Options controlling how values are written into a scope.
 *
 * @since 1.0.0
 */
export interface ScopeDataSetOptions {
    /**
     * Whether an existing value in the current scope may be overwritten.
     *
     * - `false` → throws if key already exists in current scope
     * - `true` → allows replacement of existing value
     *
     * This does not affect parent scopes.
     *
     * @default false
     */
    overwrite: boolean;
}

/**
 * Represents a valid key used for scope data storage.
 *
 * Keys may be:
 *
 * - string identifiers
 * - symbols for internal/opaque scope bindings
 *
 * @since 1.0.0
 */
export type ScopeKey = string | symbol;