import type { JSONRendererFlags } from "../types";
import type { Token } from "../../../../3-tokenization/types";

import keys from "./keys";
import ZexiRenderingContext from "../../../shared/context/context";
import LayoutResolver from "../../../shared/layout/resolver";

import objectPass from "../passes/object.pass";
import setPass from "../passes/set.pass";
import mapPass from "../passes/map.pass";

import { INLINE_SAFE_TOKENS } from "../configs";
const JSON_INLINE_SAFE_TOKENS = new Set(INLINE_SAFE_TOKENS);

/**
 * JSONHelpers
 * -----------
 *
 * A structural helper layer for the JSONRenderer pipeline.
 *
 * This class acts as an **intermediate orchestration layer** between:
 *
 * - Token stream inspection (read-only traversal)
 * - Layout resolution (inline vs block decisions)
 * - Structural transforms (Set / Map / Object passes)
 * - Rendering-side mutation (ignored tokens, layout flags, abort logic)
 *
 * It does NOT perform final rendering directly.
 * Instead, it:
 *
 * - Analyzes token structure
 * - Delegates transformation passes
 * - Coordinates layout decisions
 * - Mutates rendering context state when required
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * JSONHelpers sits between:
 *
 *   JSONRenderer (orchestrator)
 *          ↓
 *   JSONHelpers (analysis + transforms)
 *          ↓
 *   Pass modules (object.pass / set.pass / map.pass)
 *
 * This design intentionally isolates:
 *
 * - structural scanning logic
 * - layout decision heuristics
 * - envelope injection logic
 *
 * so that the renderer itself remains minimal and deterministic.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Separation of Rendering Passes**
 *    - Object, Set, and Map rendering are fully isolated
 *    - Each pass owns its own token traversal rules
 *
 * 2. **Token-Level Control**
 *    - Operates directly on immutable token streams
 *    - Uses controlled mutation only via:
 *        - ignored token registry
 *        - context injection APIs
 *
 * 3. **Layout Awareness**
 *    - Integrates with LayoutResolver for inline/block decisions
 *    - Maintains renderer-mode awareness (compact vs pretty)
 *
 * 4. **Safe Structural Abortion**
 *    - Rendering can be aborted mid-scope via context signals
 *    - Ensures partial structures do not corrupt output stream
 *
 * 5. **Envelope-Based Serialization**
 *    - Complex structures (Set / Map / Error) are emitted via envelopes
 *    - Uses DataEnvelope + anchor injection model
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STATE MODEL
 * ---------------------------------------------------------------------
 *
 * - `#_ctx`
 *   The rendering context. Provides access to:
 *   - token stream cursor & peek APIs
 *   - scope tracking
 *   - shared renderer data store
 *   - writer output buffer
 *
 * - `#_flags`
 *   Global rendering flags controlling:
 *   - forced block rendering
 *   - group-level ignore suppression
 *   - layout overrides
 *
 * - `#_mode`
 *   Rendering mode:
 *   - `compact` → minimal output, no layout resolution
 *   - `pretty` → layout resolver enabled
 *
 * - `#_ignoredTokens`
 *   A global registry of tokens excluded from output emission.
 *   Used by all structural passes to prevent duplicate rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN VISIBILITY MODEL
 * ---------------------------------------------------------------------
 *
 * Visibility is defined at helper level:
 *
 * - Primitive tokens:
 *   - `symbol` → invisible
 *   - `undefined` → invisible
 *
 * - All other token kinds are considered visible by default
 *
 * This ensures JSON output remains strict and predictable.
 *
 * ---------------------------------------------------------------------
 * 🔷 LAYOUT RESOLUTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Layout is determined using:
 *
 * 1. Explicit context layout (`RENDERING_LAYOUT_KEY`)
 * 2. Inherited layout from parent scopes
 * 3. Default fallback: `inline`
 *
 * Layout resolution is only active in `pretty` mode.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class JSONHelpers {
    /**
     * Rendering mode.
     *
     * Controls whether layout resolution is enabled:
     *
     * - `compact` → layout resolution disabled
     * - `pretty` → layout resolution enabled
     *
     * This directly affects spacing, grouping, and structural decisions.
     *
     * @since 1.0.0
     */
    readonly #_mode: 'compact' | 'pretty';

    /**
     * Rendering context instance.
     *
     * Provides access to:
     * - token stream traversal APIs
     * - scope lifecycle state
     * - shared renderer data
     *
     * This is the central coordination object for all helper operations.
     *
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Renderer configuration flags.
     *
     * These flags control structural rendering behavior such as:
     *
     * - forced block rendering
     * - group-level ignore behavior
     * - layout overrides and suppression rules
     *
     * @since 1.0.0
     */
    readonly #_flags: JSONRendererFlags;

    /**
     * Global ignored token registry.
     *
     * Stores tokens that must NOT be emitted in final output.
     *
     * This includes:
     * - structural wrappers consumed by transforms
     * - tokens replaced by envelope injection
     * - tokens suppressed by layout decisions
     *
     * @since 1.0.0
     */
    readonly #_ignoredTokens: Set<Token>;

    /**
     * Creates a new JSONHelpers instance.
     *
     * @param data.ctx
     * Rendering context used for token traversal and state management.
     *
     * @param data.flags
     * Renderer behavior flags controlling structural decisions.
     *
     * @param data.ignoredTokens
     * Shared token exclusion registry.
     *
     * @param data.mode
     * Rendering mode (`compact` or `pretty`).
     *
     * @since 1.0.0
     */
    constructor(data: {
        ctx: ZexiRenderingContext,
        flags: JSONRendererFlags,
        ignoredTokens: Set<Token>,
        mode: 'compact' | 'pretty'
    }) {
        this.#_ctx = data.ctx;
        this.#_flags = data.flags;
        this.#_mode = data.mode;
        this.#_ignoredTokens = data.ignoredTokens;
    }

    /**
     * Determines whether a token is eligible for JSON output.
     *
     * ---------------------------------------------------------------------
     * 🔷 VISIBILITY MODEL
     * ---------------------------------------------------------------------
     *
     * Primitive tokens are filtered according to JSON semantics:
     *
     * - `symbol` → excluded (non-serializable identity)
     * - `undefined` → excluded (JSON does not represent undefined)
     *
     * All other tokens are considered structurally valid.
     *
     * Non-primitive tokens (objects, arrays, structural markers)
     * are always considered visible because they are resolved later
     * in the rendering pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This method operates purely on token metadata.
     * It does NOT inspect runtime values.
     *
     * @param token
     * Token to evaluate for visibility.
     *
     * @returns
     * `true` if the token should be rendered, otherwise `false`.
     *
     * @since 1.0.0
     */
    isVisibleToken(token: Token): boolean {
        if (token.kind !== 'primitive') {
            return true;
        }

        if (
            token.type === 'symbol' ||
            token.type === 'undefined'
        ) {
            return false;
        }

        return true;
    }

    /**
     * Creates a LayoutResolver instance bound to the current rendering context.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * LayoutResolver is responsible for determining whether a structure
     * should be rendered as:
     *
     * - `inline` → compact single-line representation
     * - `block`  → expanded multi-line representation
     *
     * This helper preconfigures it with:
     * - current rendering context
     * - inline-safe token set
     *
     * ---------------------------------------------------------------------
     * @returns
     * A configured LayoutResolver instance.
     *
     * @since 1.0.0
     */
    createResolver() {
        return new LayoutResolver(this.#_ctx, JSON_INLINE_SAFE_TOKENS);
    }

    /**
     * Aborts the current rendering scope and forces block rendering
     * for the next group.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Ensures a current group exists in context
     * - Forces next group to be rendered as block
     * - Aborts current scope via context scope manager
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY RULES
     * ---------------------------------------------------------------------
     *
     * - Cannot abort root scope (fatal invariant violation)
     * - Requires an active group identifier
     *
     * ---------------------------------------------------------------------
     * @throws Error
     * If no active group exists or root scope is being aborted.
     *
     * @since 1.0.0
     */
    abortWriting() {
        const currentGroup = this.#_ctx.data.get<symbol>('currentGroup');
        if (!currentGroup) {
            throw new Error(`Invariant violation: Aborting a scope without a current group identifier.`);
        }

        this.#_flags.forceNextGroupAsBlock = true;
        if (this.#_ctx.scopes.isRoot) {
            throw new Error(`Invariant violation: Aborting the root scope.`);
        }

        this.#_ctx.scopes.abort();
    }

    /**
     * Marks the current token group as ignored.
     *
     * ---------------------------------------------------------------------
     * 🔷 EFFECT
     * ---------------------------------------------------------------------
     *
     * The current group and all its descendants will be excluded
     * from rendering output.
     *
     * This is used when:
     *
     * - a structure collapses into a minimal representation
     * - a transform replaces original tokens with an envelope
     * - layout resolution decides to bypass rendering
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    ignoreCurrentGroup() {
        this.#_flags.ignoreCurrentGroup = true;
    }

    /**
     * Resolves the current layout state for rendering.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESOLUTION ORDER
     * ---------------------------------------------------------------------
     *
     * 1. If mode is not `pretty`, returns `null`
     * 2. If requesting parent layout:
     *    - uses inherited layout from context (if available)
     * 3. Otherwise:
     *    - uses local layout from current context
     * 4. Defaults to `inline`
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Provides a consistent layout decision source for:
     *
     * - object rendering
     * - array rendering
     * - envelope formatting
     *
     * ---------------------------------------------------------------------
     * @param options.ofParent
     * If true, resolves layout from parent scope instead of current scope.
     *
     * @returns
     * - `'inline'` or `'block'` in pretty mode
     * - `null` in compact mode
     *
     * @since 1.0.0
     */
    getLayout(
        options?: {
            ofParent?: boolean
        }
    ): 'inline' | 'block' | null {
        if (this.#_mode !== 'pretty') { return null; }

        if (
            options?.ofParent === true &&
            this.#_ctx.data.hasInherited(keys.RENDERING_LAYOUT_KEY)
        ) {
            return this.#_ctx.data.getInherited<'inline' | 'block'>(keys.RENDERING_LAYOUT_KEY)!;
        }

        if (this.#_ctx.data.hasOwn(keys.RENDERING_LAYOUT_KEY)) {
            return this.#_ctx.data.get<'inline' | 'block'>(keys.RENDERING_LAYOUT_KEY)!;
        }

        return 'inline';
    }

    /**
     * Structural transformation entry point.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY
     * ---------------------------------------------------------------------
     *
     * Delegates rendering transformations to dedicated pass modules:
     *
     * - Object pass → structural object rendering
     * - Set pass → Set envelope serialization
     * - Map pass → Map envelope serialization
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN PRINCIPLE
     * ---------------------------------------------------------------------
     *
     * Each transform is:
     *
     * - isolated (no shared mutation logic)
     * - stateless at interface level
     * - context-driven internally
     *
     * This ensures predictable and testable rendering behavior.
     *
     * ---------------------------------------------------------------------
     * @since 1.0.0
     */
    readonly transforms = {
        /**
         * Executes the object rendering transformation pass.
         *
         * Delegates full logic to `objectPass`.
         *
         * @since 1.0.0
         */
        object: () => {
            objectPass(this.#_ctx, this);
        },

        /**
         * Executes the Set rendering transformation pass.
         *
         * Injects envelope structure for Set serialization.
         *
         * @since 1.0.0
         */
        set: () => {
            setPass({
                ctx: this.#_ctx,
                ignoredTokens: this.#_ignoredTokens
            });
        },

        /**
         * Executes the Map rendering transformation pass.
         *
         * Builds entry frames and injects map envelope structure.
         *
         * @since 1.0.0
         */
        map: () => {
            mapPass({
                ctx: this.#_ctx,
                ignoredTokens: this.#_ignoredTokens
            });
        }
    }
}

export default JSONHelpers;