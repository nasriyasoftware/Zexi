import RenderingWriter from "../writer/writer";
import type {
    ScopeCreateOptions,
    ScopeDataController,
    ScopeDataSetOptions,
    ScopeKey,
    ScopeState
} from "./types";

const ROOT_SCOPE_ID = Symbol("ROOT_SCOPE");

/**
 * Controller responsible for managing a stack of rendering scopes.
 *
 * `ScopesController` is the central orchestration layer for scoped
 * rendering execution.
 *
 * It provides:
 *
 * - hierarchical scope creation
 * - speculative scope execution
 * - deterministic rollback support
 * - lexical-style scoped data resolution
 * - isolated writer composition
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE MODEL: STACK-BASED RENDERING SCOPES
 * ---------------------------------------------------------------------
 *
 * The controller maintains a strict LIFO (last-in-first-out)
 * scope stack:
 *
 * ```txt
 * [ root ]
 * [ group ]
 * [ error ]
 * [ cause ] ← current
 * ```
 *
 * Each scope represents an isolated rendering execution frame.
 *
 * A scope contains:
 *
 * - a unique identifier
 * - a traversal rollback cursor
 * - a dedicated rendering writer
 * - isolated scoped data
 *
 * Only the top-most scope is active and writable.
 *
 * ---------------------------------------------------------------------
 * 🔷 SPECULATIVE RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Scopes support speculative execution through:
 *
 * - `commit()`
 * - `abort()`
 *
 * This allows renderers to:
 *
 * - explore rendering branches
 * - inject temporary tokens
 * - attempt speculative parsing
 * - rollback safely on failure
 *
 * without corrupting parent rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURSOR SNAPSHOT MODEL
 * ---------------------------------------------------------------------
 *
 * Every scope stores the token traversal cursor position at the
 * moment the scope was created.
 *
 * The stored cursor acts as a rollback checkpoint.
 *
 * Example:
 *
 * ```txt
 * cursor = 5
 * create scope
 *
 * speculative tokens injected...
 *
 * abort scope
 * rollbackBefore(5)
 * ```
 *
 * The controller itself does not perform token rollback.
 *
 * Instead:
 *
 * - the cursor is exposed through `ScopeState.cursor`
 * - higher-level rendering context logic is responsible for
 *   invoking token rollback operations
 *
 * This separation keeps scope lifecycle management independent
 * from token stream mutation mechanics.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITER ISOLATION MODEL
 * ---------------------------------------------------------------------
 *
 * Each scope owns an isolated `RenderingWriter`.
 *
 * Child writers are created via:
 *
 * ```ts
 * RenderingWriter.from(parent.writer)
 * ```
 *
 * This guarantees:
 *
 * - writer inheritance
 * - isolated output accumulation
 * - deterministic nested rendering composition
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMIT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Calling `commit()`:
 *
 * 1. removes the current scope
 * 2. consumes its writer into the parent writer
 * 3. preserves rendered output
 *
 * Example:
 *
 * ```txt
 * child writer
 *      ↓ consume
 * parent writer
 * ```
 *
 * Scoped data itself is discarded after commit.
 *
 * ---------------------------------------------------------------------
 * 🔷 ABORT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Calling `abort()`:
 *
 * - removes the current scope
 * - discards its writer entirely
 * - discards all scope-local data
 * - returns the removed scope state
 *
 * This enables higher-level systems to:
 *
 * - rollback token traversal
 * - discard speculative rendering
 * - retry rendering branches
 *
 * safely and deterministically.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROOT SCOPE
 * ---------------------------------------------------------------------
 *
 * A root scope is automatically created during construction.
 *
 * The root scope:
 *
 * - always exists
 * - cannot be committed
 * - cannot be aborted
 * - owns the primary rendering writer
 * - starts with cursor `-1`
 *
 * Its identity is permanently fixed to `ROOT_SCOPE_ID`.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPED DATA MODEL
 * ---------------------------------------------------------------------
 *
 * Each scope owns an isolated:
 *
 * ```ts
 * Map<ScopeKey, unknown>
 * ```
 *
 * Reads traverse the scope chain from:
 *
 * ```txt
 * current → parent → root
 * ```
 *
 * This creates lexical shadowing semantics:
 *
 * - child scopes may shadow parent values
 * - parent values remain intact
 * - destroying a child scope restores parent visibility
 *
 * Example:
 *
 * ```txt
 * root:  name = "Ahmad"
 * child: name = "Ali"
 * ```
 *
 * Inside child scope:
 *
 * ```ts
 * get("name") === "Ali"
 * ```
 *
 * After child destruction:
 *
 * ```ts
 * get("name") === "Ahmad"
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE LIFECYCLE INVARIANTS
 * ---------------------------------------------------------------------
 *
 * The following invariants are strictly enforced:
 *
 * - root scope cannot be committed
 * - root scope cannot be aborted
 * - only current scope may be destroyed
 * - writers are isolated per scope
 * - scoped data is never shared structurally
 *
 * Violations indicate rendering pipeline corruption.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ScopesController {
    /**
     * Internal stack of active scopes.
     *
     * The final entry is always considered the current active scope.
     *
     * Stack ordering is strictly hierarchical:
     *
     * ```txt
     * root → parent → child
     * ```
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_stack: ScopeState[] = [];

    /**
     * Creates a new rendering scopes controller.
     *
     * Initializes the immutable root scope using the provided writer.
     *
     * The root scope:
     *
     * - uses cursor `-1`
     * - acts as the rendering base frame
     * - owns the primary rendering writer
     * - persists for the lifetime of the controller
     *
     * @param writer
     * Root rendering writer used as the base output target.
     *
     * @since 1.0.0
     */
    constructor(writer: RenderingWriter) {
        this.#_stack.push({
            id: ROOT_SCOPE_ID,
            cursor: -1,
            name: 'root',
            writer,
            data: new Map(),
        });
    }

    /**
     * Indicates whether the current active scope is the root scope.
     *
     * The root scope is the permanent base scope created during controller
     * initialization and cannot be:
     *
     * - committed
     * - aborted
     * - removed from the stack
     *
     * This property provides a semantic way to verify scope position without
     * exposing the internal root scope identifier.
     *
     * Typical usage:
     *
     * ```ts
     * if (!scopes.isRoot) {
     *     scopes.commit();
     * }
     * ```
     *
     * @returns
     * `true` if the current scope is the root scope, otherwise `false`.
     *
     * @since 1.0.0
     */
    get isRoot() { return this.current.id === ROOT_SCOPE_ID; }

    /**
     * Returns the current active scope.
     *
     * The current scope is always the top-most stack entry.
     *
     * This scope is:
     *
     * - the only writable scope
     * - the source of active scoped data
     * - the active rendering target
     *
     * @returns Current active scope state.
     *
     * @since 1.0.0
     */
    get current() { return this.#_stack[this.#_stack.length - 1]; }

    /**
     * Creates a new child scope.
     *
     * The new scope:
     *
     * - becomes the active scope
     * - receives its own isolated writer
     * - stores the provided traversal cursor snapshot
     * - starts with empty scoped data
     *
     * The child writer is cloned from the current writer using:
     *
     * ```ts
     * RenderingWriter.from(current.writer)
     * ```
     *
     * This preserves rendering state inheritance while maintaining
     * output isolation.
     *
     * @param config
     * Scope creation configuration.
     *
     * @param config.cursor
     * Token traversal cursor snapshot used for rollback recovery.
     *
     * @param config.id
     * Optional explicit scope identifier.
     * If omitted, a generated symbol is used.
     *
     * @param config.name
     * Optional human-readable scope name.
     *
     * @since 1.0.0
     */
    create(config: ScopeCreateOptions): void {
        const id = config.id ?? Symbol('rendering-scope');

        this.#_stack.push({
            id,
            name: config.name,
            cursor: config.cursor,
            writer: RenderingWriter.from(this.current.writer),
            data: new Map(),
        });
    }

    /**
     * Aborts the current active scope.
     *
     * Aborting:
     *
     * - removes the scope from the stack
     * - discards all rendered output
     * - discards all scope-local data
     * - does NOT consume the writer into the parent scope
     *
     * The removed scope state is returned so higher-level systems
     * may perform rollback operations using its stored cursor.
     *
     * Typical usage:
     *
     * ```ts
     * const scope = scopes.abort();
     * tokens.rollbackBefore(scope.cursor);
     * ```
     *
     * @returns Removed scope state.
     *
     * @throws Error
     * If attempting to abort the root scope.
     *
     * @since 1.0.0
     */
    abort(): ScopeState {
        if (this.current.id === ROOT_SCOPE_ID) {
            throw new Error('Invariant violation: Attempting to destroy the root scope.');
        }

        const removedScope = this.#_stack.pop()!;
        return removedScope;
    }

    /**
     * Commits the current active scope into its parent scope.
     *
     * Committing:
     *
     * - removes the current scope
     * - merges its writer into the parent writer
     * - preserves rendered output
     * - discards scope-local data afterward
     *
     * Writer merging occurs through:
     *
     * ```ts
     * parent.writer.consume(child.writer)
     * ```
     *
     * The removed scope state is returned for debugging,
     * diagnostics, or traversal bookkeeping.
     *
     * @returns Removed committed scope state.
     *
     * @throws Error
     * If attempting to commit the root scope.
     *
     * @since 1.0.0
     */
    commit(): ScopeState {
        if (this.current.id === ROOT_SCOPE_ID) {
            throw new Error('Invariant violation: Attempting to commit the root scope.');
        }

        const removedScope = this.#_stack.pop()!;
        this.current.writer.consume(removedScope.writer);
        return removedScope;
    }

    /**
     * Scoped data access controller.
     *
     * Provides lexical-style scoped storage operations for:
     *
     * - reading values
     * - checking existence
     * - writing values
     *
     * Reads traverse the scope chain while writes are always isolated
     * to the current scope.
     *
     * @since 1.0.0
     */
    readonly data: ScopeDataController = {
        /**
         * Retrieves a value from the scope chain.
         *
         * Lookup order:
         *
         * ```txt
         * current → parent → root
         * ```
         *
         * The first matching key is returned.
         *
         * This creates lexical shadowing semantics where inner scopes
         * override outer scopes without mutating them.
         *
         * @typeParam T
         * Expected return value type.
         *
         * @param key
         * Scope key to resolve.
         *
         * @returns
         * Resolved value or `null` if the key does not exist anywhere
         * in the chain.
         *
         * @since 1.0.0
         */
        get: <T extends any = unknown>(key: ScopeKey): T | null => {
            for (let i = this.#_stack.length - 1; i >= 0; i--) {
                const scope = this.#_stack[i];
                if (scope.data.has(key)) {
                    return scope.data.get(key) as T;
                }
            }

            return null;
        },

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
        hasOwn: (key: ScopeKey): boolean => {
            return this.current.data.has(key);
        },

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
        hasInherited: (key: ScopeKey): boolean => {
            for (let i = this.#_stack.length - 2; i >= 0; i--) {
                const scope = this.#_stack[i];
                if (scope.data.has(key)) {
                    return true;
                }
            }

            return false;
        },

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
        hasResolvable(key: ScopeKey): boolean {
            return this.hasOwn(key) || this.hasInherited(key);
        },

        /**
         * Stores a value in the current active scope.
         *
         * Values are always written locally and never propagated to
         * parent scopes.
         *
         * By default, overwriting an existing key in the same scope
         * is forbidden to prevent accidental state mutation.
         *
         * Shadowing parent-scope values is fully allowed.
         *
         * Example:
         *
         * ```ts
         * root.set("name", "Ahmad");
         * child.set("name", "Ali");
         * ```
         *
         * Both values coexist safely in separate scopes.
         *
         * @param key
         * Scope key identifier.
         *
         * @param value
         * Value to store.
         *
         * @param options
         * Optional write behavior configuration.
         *
         * @param options.overwrite
         * Allows replacing an existing key inside the current scope.
         *
         * @throws Error
         * If attempting to overwrite an existing local key without
         * `overwrite: true`.
         *
         * @since 1.0.0
         */
        set: (
            key: ScopeKey,
            value: unknown,
            options: ScopeDataSetOptions = { overwrite: false },
        ) => {
            if (
                options.overwrite !== true &&
                this.current.data.has(key)
            ) {
                throw new Error(`Invariant violation: Attempting to overwrite current scope data with key "${key.toString()}" without "overwrite" option.`);
            }

            this.current.data.set(key, value);
        }
    }
}

export default ScopesController;