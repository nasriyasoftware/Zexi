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
 * - JSONHelpers (render orchestration)
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
const ERROR_CACHE_KEY = Symbol.for('error_cache');

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
 * Used by `objectPass` and object rendering logic inside JSONHelpers.
 *
 * @since 1.0.0
 */
const OBJECT_CACHE_KEY = Symbol.for('object_cache');

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
const RENDERING_LAYOUT_KEY = Symbol.for('rendering_layout');

/**
 * Symbol key used to store array rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Tracks array-specific rendering metadata during layout resolution
 * and rendering passes.
 *
 * This may include:
 *
 * - array iteration state
 * - separator suppression rules
 * - inline vs block constraints for elements
 *
 * Primarily used by array-related rendering logic (future or partial implementation).
 *
 * @since 1.0.0
 */
const ARRAY_RENDERING_KEY = Symbol.for('array_rendering');

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
    ERROR_CACHE_KEY,
    OBJECT_CACHE_KEY,
    RENDERING_LAYOUT_KEY,
    ARRAY_RENDERING_KEY,
} as const;

export default keys;