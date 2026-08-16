/**
 * keys
 * -----
 *
 * A centralized registry of Symbol-based context keys used throughout
 * the JSON rendering pipeline.
 *
 * These keys are used to store and retrieve shared renderer state inside
 * the Zexi rendering context (`ZexiRenderingContext#data`).
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * The renderer operates across multiple independent passes (object, set, map),
 * all of which need a shared mechanism for:
 *
 * - caching structural metadata
 * - persisting rendering decisions across passes
 * - sharing layout decisions (inline vs block)
 * - coordinating multi-phase envelope injection
 *
 * Instead of string-based identifiers (which are collision-prone),
 * this module uses `Symbol.for(...)` to guarantee:
 *
 * - global uniqueness across runtime boundaries
 * - deterministic lookup across renderer phases
 * - safe cross-module access without naming collisions
 *
 * ---------------------------------------------------------------------
 * 🔷 WHY SYMBOLS (NOT STRINGS)
 * ---------------------------------------------------------------------
 *
 * Strings would introduce risks such as:
 *
 * - accidental overwrites in shared context maps
 * - debugging ambiguity in large token graphs
 * - cross-module collisions in complex render pipelines
 *
 * Symbols provide:
 *
 * ✔ guaranteed uniqueness
 * ✔ stable identity across modules
 * ✔ safe reuse across nested rendering scopes
 *
 * ---------------------------------------------------------------------
 * 🔷 KEY USAGE MODEL
 * ---------------------------------------------------------------------
 *
 * Each key is used with:
 *
 *   ctx.data.set(KEY, value)
 *   ctx.data.get(KEY)
 *   ctx.data.has(KEY)
 *
 * or inherited equivalents in scoped contexts.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * These keys enable coordination between:
 *
 * - JSONNormalizationHelpers (render orchestration)
 * - LayoutResolver (inline/block decisions)
 * - objectPass (property filtering + suppression logic)
 * - setPass (envelope injection + size computation)
 * - mapPass (entry framing + structural assembly)
 *
 * ---------------------------------------------------------------------
 * 🔷 KEY DEFINITIONS
 * ---------------------------------------------------------------------
 *
 * @since 1.0.0
 */

/**
 * Symbol key used to store cached error rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Holds an `ErrorCache` instance during error serialization.
 *
 * This cache tracks:
 * - error sections (name, message, cause, stack)
 * - section completion state
 * - suppression rules for trailing tokens
 *
 * Used primarily by the error rendering pipeline to ensure
 * consistent multi-pass error assembly.
 *
 * @since 1.0.0
 */
const ERROR_CACHE = Symbol('error_cache');

/**
 * Symbol key used to store cached object rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Holds an `ObjectCache` instance during object rendering.
 *
 * This cache tracks:
 * - ignored properties (non-visible tokens)
 * - suppression rules for trailing commas
 * - property-level visibility decisions
 *
 * Used by `objectPass` and object rendering logic inside JSONNormalizationHelpers.
 *
 * @since 1.0.0
 */
const OBJECT_CACHE = Symbol('object_cache');

/**
 * Symbol key used to store rendering layout state.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Stores the current layout decision for a rendering scope:
 *
 * - 'inline'
 * - 'block'
 *
 * This is used by LayoutResolver and downstream renderer logic
 * to determine whether a structure should be emitted inline or
 * expanded into a multi-line block form.
 *
 * ---------------------------------------------------------------------
 * 🔷 LAYOUT PROPAGATION
 * ---------------------------------------------------------------------
 *
 * Layout may be:
 *
 * - explicitly set by passes (set/map/error)
 * - inherited from parent scopes
 * - overridden by structural constraints (nesting depth, deferred envelopes)
 *
 * @since 1.0.0
 */
const RENDERING_LAYOUT = Symbol('rendering_layout');

/**
 * Symbol key used to store the active rendering group identifier.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Represents the currently active rendering group within the pipeline.
 *
 * A "group" is a transient execution unit created during rendering
 * when a structure (object, array, expression, etc.) is evaluated
 * in either inline or block mode.
 *
 * This key is used to:
 *
 * - detect whether a group is currently active
 * - associate rollback and abort operations with a specific group
 * - ensure that layout fallback (inline → block) is correctly scoped
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * - created when a rendering group begins
 * - removed when the group completes or is aborted
 *
 * @since 1.0.0
 */
const GROUP = Symbol('current_group');

/**
 * Symbol key used to store the initial traversal depth of a rendering group.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Captures the traversal depth at the exact moment a rendering group begins.
 *
 * This value is used to restore the depth state when a group is aborted,
 * ensuring that any depth changes performed during speculative inline
 * rendering are fully reverted.
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE IN ROLLBACK
 * ---------------------------------------------------------------------
 *
 * During `abortWriting`:
 *
 * - current depth is compared against this stored value
 * - any excess depth increments are reversed
 * - traversal state is restored to the group's entry depth
 *
 * This guarantees structural consistency between:
 *
 * - failed inline rendering attempts
 * - subsequent block rendering retries
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANT
 * ---------------------------------------------------------------------
 *
 * - must always be set when a group is created
 * - must never be greater than the current traversal depth
 *   at rollback time (otherwise indicates corruption)
 *
 * @since 1.0.0
 */
const GROUP_DEPTH = Symbol('current_group_initial_depth');

/**
 * Symbol key used to store the currently active object being rendered.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Stores a reference to the object currently being traversed within the
 * active rendering scope.
 *
 * This allows rendering utilities and nested passes to access the object
 * being processed without requiring it to be threaded through every
 * rendering call.
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * The value is established when object rendering begins and remains
 * scoped to the current rendering context.
 *
 * Nested object scopes automatically shadow the parent value, and the
 * previous value is restored when the nested scope completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 USE CASES
 * ---------------------------------------------------------------------
 *
 * Primarily used by object-rendering logic for operations that require
 * access to the original object instance, such as:
 *
 * - inspecting object metadata
 * - evaluating property visibility
 * - coordinating object-specific rendering behavior
 * - sharing the current object across helper utilities
 *
 * @since 1.0.0
 */
const OBJECT = Symbol('current_object');

/**
 * keys
 * ----
 *
 * Aggregated export of all renderer context keys.
 *
 * This object is the single source of truth for all Symbol-based
 * identifiers used across the JSON rendering pipeline.
 *
 * @since 1.0.0
 */
const keys = {
    ERROR_CACHE,
    GROUP,
    GROUP_DEPTH,
    OBJECT,
    OBJECT_CACHE,
    RENDERING_LAYOUT
} as const;

export default keys;