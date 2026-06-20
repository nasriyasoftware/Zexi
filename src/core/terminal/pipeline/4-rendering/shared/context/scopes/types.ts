import type RenderingWriter from "../writer/writer";

/**
 * Defines the API for interacting with scope-local and chain-resolved
 * rendering state data.
 *
 * The `ScopeDataController` is a deterministic lexical scope storage system
 * used during rendering to manage contextual state across nested structures.
 *
 * It provides controlled access to scoped data through:
 *
 * - local scope writes (isolation)
 * - hierarchical reads (lexical resolution)
 * - inheritance-aware queries
 * - resolvability checks
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE MODEL
 * ---------------------------------------------------------------------
 *
 * The system is based on a stack of scope frames:
 *
 * ```text
 * [Root Scope]
 * [Parent Scope]
 * [Current Scope]
 * ```
 *
 * Each scope owns an independent key-value map.
 *
 * ---------------------------------------------------------------------
 * 🔷 CRITICAL DESIGN RULES
 * ---------------------------------------------------------------------
 *
 * 1. Writes NEVER propagate upward or downward
 * 2. Reads ALWAYS traverse upward (nearest-first)
 * 3. The current scope is always index N (top of stack)
 * 4. Parent scopes are N-1 → 0
 *
 * ---------------------------------------------------------------------
 * 🔷 LOOKUP SEMANTICS
 * ---------------------------------------------------------------------
 *
 * All lookup operations follow this deterministic order:
 *
 * ```text
 * current → parent → grandparent → ... → root
 * ```
 *
 * The first match always wins.
 *
 * This guarantees:
 *
 * - predictable shadowing behavior
 * - deterministic rendering output
 * - no non-local mutation side effects
 *
 * ---------------------------------------------------------------------
 * 🔷 NULL CONTRACT
 * ---------------------------------------------------------------------
 *
 * All "get" operations return:
 *
 * - a concrete value if found
 * - `null` if not found
 *
 * IMPORTANT:
 *
 * `null` is a semantic sentinel meaning:
 *
 * > "The key does not exist anywhere in the resolved scope chain."
 *
 * It is NOT equivalent to:
 *
 * - undefined
 * - missing return
 * - optional property access failure
 *
 * ---------------------------------------------------------------------
 * 🔷 RESOLUTION CATEGORIES
 * ---------------------------------------------------------------------
 *
 * The API exposes three distinct resolution modes:
 *
 * | Method            | Scope Coverage         |
 * |-------------------|------------------------|
 * | `hasOwn`          | current only           |
 * | `hasInherited`    | parent → root          |
 * | `hasResolvable`   | current → root         |
 * | `get`             | current → root         |
 * | `getInherited`    | parent → root          |
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface ScopeDataController {
    /**
     * Retrieves a value from the active scope chain using lexical resolution.
     *
     * Lookup begins at the current scope and proceeds upward:
     *
     * ```text
     * current → parent → grandparent → ... → root
     * ```
     *
     * The first matching key is returned immediately.
     *
     * ---------------------------------------------------------------------
     * 🔷 SHADOWING RULE
     * ---------------------------------------------------------------------
     *
     * Inner scopes override outer scopes without modifying them.
     *
     * Example:
     *
     * ```text
     * Root    { a: 1 }
     * Parent  { a: 2 }
     * Current { }
     * ```
     *
     * Result:
     * ```ts
     * get("a") → 2
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 DEEP BEHAVIOR GUARANTEE
     * ---------------------------------------------------------------------
     *
     * - traversal is linear and deterministic
     * - no scope is skipped
     * - no backtracking occurs
     * - evaluation stops immediately on match
     *
     * ---------------------------------------------------------------------
     * 🔷 FAILURE MODE
     * ---------------------------------------------------------------------
     *
     * If no scope contains the key:
     *
     * ```ts
     * return null;
     * ```
     *
     * This is intentional and distinguishes:
     *
     * - missing value
     * - falsy value
     * - undefined JavaScript behavior
     *
     * ---------------------------------------------------------------------
     * @template T
     * Expected type of the resolved value.
     *
     * @param key
     * Scope key to resolve.
     *
     * @returns
     * Nearest matching value in the scope chain, or `null` if not found.
     *
     * @since 1.0.0
     */
    get<T = unknown>(key: ScopeKey): T | null;

    /**
     * Retrieves the nearest value from ancestor scopes only.
     *
     * This method explicitly excludes the current scope from lookup.
     *
     * Lookup order:
     *
     * ```text
     * parent → grandparent → ... → root
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 DIFFERENCE FROM `get()`
     * ---------------------------------------------------------------------
     *
     * | Method          | Includes Current Scope |
     * |-----------------|------------------------|
     * | `get()`         | YES                    |
     * | `getInherited()`| NO                     |
     *
     * ---------------------------------------------------------------------
     * 🔷 USE CASE MODEL
     * ---------------------------------------------------------------------
     *
     * This method is designed for:
     *
     * - inheritance inspection
     * - parent-state introspection
     * - detecting overrides from outer scopes
     * - preventing local shadow resolution
     *
     * ---------------------------------------------------------------------
     * 🔷 FAILURE MODE
     * ---------------------------------------------------------------------
     *
     * If no ancestor scope contains the key:
     *
     * ```ts
     * return null;
     * ```
     *
     * ---------------------------------------------------------------------
     * @template T
     * Expected type.
     *
     * @param key
     * Key to resolve in ancestor scopes only.
     *
     * @returns
     * Nearest ancestor value or `null` if not found.
     *
     * @since 1.0.0
     */
    getInherited<T extends any = unknown>(key: ScopeKey): T | null;

    /**
     * Checks whether a key exists in the current scope only.
     *
     * This is a strict local existence check.
     *
     * No ancestor scopes are evaluated.
     *
     * ---------------------------------------------------------------------
     * 🔷 SCOPE RULE
     * ---------------------------------------------------------------------
     *
     * ```text
     * current → checked
     * parent  → ignored
     * root    → ignored
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 SEMANTIC DIFFERENCE
     * ---------------------------------------------------------------------
     *
     * This method answers:
     *
     * > "Was this value defined in THIS scope?"
     *
     * NOT:
     *
     * > "Can this value be resolved?"
     *
     * ---------------------------------------------------------------------
     * @param key
     * Key to check.
     *
     * @returns
     * `true` if defined in current scope only.
     *
     * @since 1.0.0
     */
    hasOwn(key: ScopeKey): boolean;

    /**
     * Checks whether a key exists in ancestor scopes.
     *
     * The current scope is excluded from the lookup.
     *
     * Traversal begins at the immediate parent scope and proceeds upward:
     *
     * ```text
     * parent → grandparent → ... → root
     * ```
     *
     * The first match terminates the search.
     *
     * ---------------------------------------------------------------------
     * 🔷 DEPTH CONTROL SEMANTICS
     * ---------------------------------------------------------------------
     *
     * `maxDepth` limits how far upward the search may travel.
     *
     * Depth is defined relative to the current scope:
     *
     * | Depth | Scopes Checked            |
     * |-------|---------------------------|
     * | 1     | parent only               |
     * | 2     | parent + grandparent      |
     * | 3     | parent + grandparent + 1  |
     *
     * If omitted, all ancestor scopes are checked.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLE STACK
     * ---------------------------------------------------------------------
     *
     * ```text
     * Root   { a }
     * Mid    { b }
     * Leaf   { c }
     * ```
     *
     * ```ts
     * hasInherited("b", 1) → true
     * hasInherited("a", 1) → false
     * hasInherited("a", 2) → true
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 SEMANTIC INTENT
     * ---------------------------------------------------------------------
     *
     * This method answers:
     *
     * > "Does ANY ancestor scope define this key?"
     *
     * WITHOUT:
     *
     * - resolving value
     * - considering current scope
     * - mutating state
     *
     * ---------------------------------------------------------------------
     * @param key
     * Key to search for.
     *
     * @param maxDepth
     * Optional maximum ancestor depth to traverse.
     *
     * @returns
     * `true` if found within allowed ancestor range.
     *
     * @since 1.0.0
     */
    hasInherited(key: ScopeKey, maxDepth?: number): boolean;

    /**
     * Determines whether a key can be resolved from the full scope chain.
     *
     * This includes:
     *
     * - current scope
     * - all ancestor scopes
     *
     * Equivalent to:
     *
     * ```ts
     * get(key) !== null
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 LOOKUP ORDER
     * ---------------------------------------------------------------------
     *
     * ```text
     * current → parent → grandparent → ... → root
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 SEMANTIC INTENT
     * ---------------------------------------------------------------------
     *
     * This method answers:
     *
     * > "Would a `get()` call succeed for this key?"
     *
     * It does NOT:
     *
     * - return values
     * - distinguish ownership
     * - exclude current scope
     *
     * ---------------------------------------------------------------------
     * @param key
     * Key to resolve.
     *
     * @returns
     * `true` if resolvable from any scope.
     *
     * @since 1.0.0
     */
    hasResolvable(key: ScopeKey): boolean;

    /**
     * Writes a value into the current scope only.
     *
     * Scope writes are strictly local and never propagate to ancestors.
     *
     * This guarantees deterministic isolation between nested rendering contexts.
     *
     * ---------------------------------------------------------------------
     * 🔷 MUTATION MODEL
     * ---------------------------------------------------------------------
     *
     * ```text
     * current → modified
     * parent  → unchanged
     * root    → unchanged
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 SHADOWING BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * Writing a key that exists in a parent scope creates a shadow:
     *
     * ```ts
     * root.set("a", 1);
     * child.set("a", 2);
     * ```
     *
     * Both values coexist in different scopes.
     *
     * ---------------------------------------------------------------------
     * 🔷 OVERWRITE RULE
     * ---------------------------------------------------------------------
     *
     * By default, duplicate keys in the SAME scope are forbidden.
     *
     * This prevents accidental mutation of established state.
     *
     * Overwrite must be explicit:
     *
     * ```ts
     * set(key, value, { overwrite: true });
     * ```
     *
     * ---------------------------------------------------------------------
     * @param key
     * Scope key.
     *
     * @param value
     * Value to store.
     *
     * @param options
     * Optional mutation configuration.
     *
     * @param options.overwrite
     * Allows replacing an existing key in the current scope.
     *
     * @throws Error
     * If overwriting a local key without explicit permission.
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