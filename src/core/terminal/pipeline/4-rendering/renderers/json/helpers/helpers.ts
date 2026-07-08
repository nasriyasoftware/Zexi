import ZexiRenderingContext from "../../../shared/context/context";
import objectPass from "../passes/object.pass";
import setPass from "../passes/set.pass";
import mapPass from "../passes/map.pass";
import * as utils from './utils';

import { INLINE_SAFE_TOKENS } from "../configs";
import { isVisibleToken } from "../../../shared/helpers";

import type { JSONPipelineFlags } from "../types";
import type { Token } from "../../../../3-tokenization/types";

const JSON_INLINE_SAFE_TOKENS = new Set(INLINE_SAFE_TOKENS);

class JSONHelpers {
    /**
     * Normalization mode inherited from the renderer configuration.
     *
     * Determines whether layout-aware normalization is enabled:
     *
     * - `compact` → layout-related transformations are minimized
     * - `pretty` → layout-aware normalization is enabled
     *
     * This value influences structural decisions such as:
     *
     * - inline vs block grouping
     * - envelope formatting strategy
     * - token suppression heuristics
     *
     * @since 1.0.0
     */
    readonly #_mode: 'compact' | 'pretty';

    /**
     * Normalization execution context.
     *
     * Provides access to the mutable pipeline state during normalization:
     *
     * - token stream traversal and mutation APIs
     * - scope tracking
     * - shared normalization metadata store
     * - structural rewrite facilities
     *
     * This context is the primary interface between normalization logic
     * and the pipeline runtime.
     *
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Shared normalization state flags.
     *
     * Used to coordinate behavior across multiple normalization passes.
     *
     * These flags control:
     *
     * - group suppression / ignore decisions
     * - forced block layout promotion
     * - replacement injection behavior
     * - ANSI-aware normalization decisions (indirectly)
     *
     * Flags are mutable and evolve throughout the normalization phase.
     *
     * @since 1.0.0
     */
    readonly #_flags: JSONPipelineFlags;

    /**
     * Registry of tokens excluded from the final normalized stream.
     *
     * Tokens placed in this set will not be emitted to the rendering stage.
     *
     * This includes tokens that are:
     *
     * - consumed by structural transforms (Map / Set / Object passes)
     * - replaced by envelope injection
     * - suppressed by layout resolution logic
     *
     * This set acts as the final exclusion filter before rendering.
     *
     * @since 1.0.0
     */
    readonly #_ignoredTokens: Set<Token>;

    /**
     * Creates a JSON normalization helper instance.
     *
     * This helper operates on a mutable token stream and prepares it for
     * the rendering stage by applying structural transformations.
     *
     * @param data.ctx
     * Active normalization context for token traversal and mutation.
     *
     * @param data.flags
     * Shared pipeline flags controlling normalization behavior.
     *
     * @param data.ignoredTokens
     * Global registry of tokens excluded from final output.
     *
     * @param data.mode
     * Normalization mode derived from renderer configuration.
     *
     * @since 1.0.0
     */
    constructor(data: {
        ctx: ZexiRenderingContext,
        flags: JSONPipelineFlags,
        ignoredTokens: Set<Token>,
        mode: 'compact' | 'pretty'
    }) {
        this.#_ctx = data.ctx;
        this.#_flags = data.flags;
        this.#_mode = data.mode;
        this.#_ignoredTokens = data.ignoredTokens;
    }

    /**
     * Determines whether a token is eligible to participate in normalization.
     *
     * ---------------------------------------------------------------------
     * 🔷 VISIBILITY MODEL
     * ---------------------------------------------------------------------
     *
     * Visibility is defined at the token level, independent of rendering.
     *
     * Primitive exclusion rules:
     *
     * - `undefined` → excluded (not representable in JSON)
     * - `symbol` → excluded (non-serializable identity type)
     *
     * All other tokens remain visible and are processed by later stages.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT
     * ---------------------------------------------------------------------
     *
     * This method does NOT:
     *
     * - serialize values
     * - format output
     * - apply rendering rules
     *
     * It only determines whether a token participates in normalization.
     *
     * @since 1.0.0
     */
    isVisibleToken(token: Token): boolean {
        return isVisibleToken(token, 'json');
    }

    /**
     * Resolves the layout of the current token group.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * This method performs layout resolution in a single step:
     *
     * - creates a layout resolver
     * - executes a resolution pass immediately
     * - returns the final layout decision
     *
     * The decision determines whether a token group should be rendered as:
     *
     * - `inline` → compact single-line structure
     * - `block`  → expanded multi-line structure
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * Layout resolution is an immediate, deterministic scan over the
     * token stream for the current group.
     *
     * The resolver:
     *
     * - starts at the current `group-start` token
     * - scans forward until the matching `group-end`
     * - evaluates structural and visibility constraints
     * - escalates to `block` on the first violating condition
     *
     * ---------------------------------------------------------------------
     * 🔷 VISIBILITY AWARENESS
     * ---------------------------------------------------------------------
     *
     * The resolution process is bound to the active renderer (`json`),
     * meaning decisions are based on the *effective rendered structure*.
     *
     * Tokens that will not survive normalization are ignored when
     * evaluating layout constraints, including:
     *
     * - undefined or removed properties
     * - renderer-specific exclusions
     * - envelope or metadata-only tokens
     *
     * This ensures layout decisions match the final rendered output.
     *
     * ---------------------------------------------------------------------
     * 🔷 INLINE SAFETY RULES
     * ---------------------------------------------------------------------
     *
     * A group is eligible for `inline` rendering only if:
     *
     * - all structural tokens are inline-safe
     * - no nested structures exceed inline complexity limits
     * - no renderer-specific constraints are violated
     *
     * Otherwise, the result is escalated to `block`.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This method replaces the previous two-step flow:
     *
     * - resolver construction
     * - manual `.resolve()` invocation
     *
     * It enforces a stricter, simpler API where layout resolution is
     * always executed immediately with consistent configuration.
     *
     * @returns
     * Final layout decision for the current token group.
     *
     * @since 1.0.0
     */
    resolveLayout() {
        return utils.createResolver({
            ctx: this.#_ctx,
            inlineSafe: JSON_INLINE_SAFE_TOKENS,
            renderer: 'json'
        }).resolve();
    }

    /**
     * Aborts rendering of the current scope and rolls back layout state.
     *
     * This operation performs a structural rollback of the current rendering
     * group without making any decisions about future layout strategy.
     *
     * Unlike previous implementations, this function no longer forces a block
     * layout. It is purely responsible for restoring consistency after an
     * invalid or failed rendering attempt.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY
     * ---------------------------------------------------------------------
     *
     * This method:
     *
     * - aborts the active rendering scope
     * - restores traversal and structural state
     * - ensures the renderer can safely retry from a clean state
     *
     * It does NOT:
     *
     * - force block layout
     * - decide inline vs block rendering
     * - propagate layout changes to parent structures
     *
     * Those responsibilities are handled by higher-level helpers such as:
     *
     * - `forceBlock`
     * - `resolvePrimitiveOverflow`
     *
     * ---------------------------------------------------------------------
     * 🔷 USAGE CONTEXT
     * ---------------------------------------------------------------------
     *
     * This is typically used as a low-level recovery mechanism during:
     *
     * - overflow detection
     * - failed inline rendering attempts
     * - structural rollback before retrying layout decisions
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * After execution:
     *
     * - the current group is fully aborted
     * - rendering context is restored to a consistent state
     * - no layout assumptions are modified
     *
     * @throws Error
     * If no active group exists.
     *
     * @throws Error
     * If an abort is attempted from the root scope.
     *
     * @since 1.0.0
     */
    abortWriting() {
        utils.abortWriting(this.#_ctx);
    }

    /**
     * Forces the current rendering group into block layout mode.
     *
     * This operation explicitly marks the active group so that the next
     * rendering attempt will use block layout semantics instead of inline.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Block layout is required when inline rendering cannot safely
     * accommodate the current structure.
     *
     * This function does NOT perform rollback on its own. It only modifies
     * layout intent for the current and/or next rendering pass.
     *
     * ---------------------------------------------------------------------
     * 🔷 EFFECTS
     * ---------------------------------------------------------------------
     *
     * - marks the next group to be rendered as block
     * - participates in layout propagation when combined with overflow logic
     *
     * It does NOT:
     *
     * - abort rendering
     * - modify token state
     * - restore traversal depth
     *
     * Those responsibilities belong to `abortWriting`.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN ROLE
     * ---------------------------------------------------------------------
     *
     * This function is a pure layout directive used by higher-level helpers
     * to express structural intent without triggering rollback.
     *
     * @since 1.0.0
     */
    forceBlock() {
        utils.forceBlock({
            ctx: this.#_ctx,
            flags: this.#_flags
        });
    }

    /**
     * Resolves layout overflow caused by a primitive value exceeding
     * available inline width.
     *
     * This is the highest-level overflow handler in the JSON rendering
     * pipeline and is responsible for coordinating layout correction
     * across nested structures.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * When a primitive cannot fit in the current inline context, this
     * function determines how far layout correction must propagate.
     *
     * It may trigger:
     *
     * - abortion of the current scope
     * - promotion of the current group to block layout
     * - cascading block layout propagation through parent structures
     *
     * ---------------------------------------------------------------------
     * 🔷 STRATEGY
     * ---------------------------------------------------------------------
     *
     * The resolution process follows these rules:
     *
     * 1. Abort the current primitive scope if necessary
     * 2. Force the current group into block layout
     * 3. If the primitive is inside an array, promote the array to block
     * 4. If the primitive is inside a key-value pair, cascade block layout
     *    upward through all inline ancestors until stabilization
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY BOUNDARY
     * ---------------------------------------------------------------------
     *
     * This function:
     *
     * - orchestrates overflow recovery
     * - delegates low-level rollback to `abortWriting`
     * - delegates layout mutation to `forceBlock`
     *
     * It does NOT:
     *
     * - directly manipulate tokens
     * - directly manage traversal state
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN INTENT
     * ---------------------------------------------------------------------
     *
     * This helper exists to guarantee deterministic recovery from inline
     * overflow while preserving structural correctness across nested JSON
     * constructs.
     *
     * @since 1.0.0
     */
    resolvePrimitiveOverflow() {
        utils.resolvePrimitiveOverflow({
            mode: this.#_mode,
            ctx: this.#_ctx,
            flags: this.#_flags
        });
    }

    /**
     * Restores the traversal depth of the current rendering context
     * to the value captured at the start of the active rendering group.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * This helper is a thin delegation wrapper over `utils.restoreDepth`,
     * providing a convenience API bound to the current JSON rendering
     * context instance.
     *
     * It is used during layout rollback operations when a rendering group
     * must be aborted (e.g. switching from inline to block rendering).
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When invoked, this method:
     *
     * - reads the group-start depth snapshot from the context
     * - restores `ctx.depth` to that snapshot value
     * - removes any depth increments performed inside the group
     *
     * This ensures that retries operate on a clean and structurally
     * consistent traversal state.
     *
     * ---------------------------------------------------------------------
     * 🔷 DELEGATION MODEL
     * ---------------------------------------------------------------------
     *
     * This method does not implement rollback logic itself.
     *
     * Instead, it delegates to:
     *
     * - `utils.restoreDepth(ctx)`
     *
     * ensuring that all rollback semantics remain centralized in the
     * shared utility layer.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANTS
     * ---------------------------------------------------------------------
     *
     * - A rendering group must be active
     * - A valid `currentGroupDepth` snapshot must exist in the context
     *
     * Violations indicate incorrect usage of the rendering lifecycle.
     *
     * ---------------------------------------------------------------------
     * 🔷 SIDE EFFECTS
     * ---------------------------------------------------------------------
     *
     * - Mutates `ctx.depth` only
     * - Does not modify tokens, scopes, or writer state
     *
     * @throws Error
     * If the context does not contain a valid group depth snapshot
     * or if the depth state is inconsistent.
     *
     * @since 1.0.0
     */
    restoreDepth() {
        utils.restoreDepth(this.#_ctx);
    }

    /**
     * Removes the current token group from the normalization stream.
     *
     * This operation:
     *
     * - reverts the active group in the token stream
     * - marks the group as ignored
     * - optionally injects replacement tokens
     *
     * Ignored groups will never reach the rendering stage.
     *
     * @param replaceWith
     * Optional replacement token sequence to substitute the removed group.
     *
     * @since 1.0.0
     */
    ignoreCurrentGroup() {
        utils.ignoreCurrentGroup({
            ctx: this.#_ctx,
            flags: this.#_flags
        });
    }

    /**
     * Resolves the layout strategy for the current normalization scope.
     *
     * ---------------------------------------------------------------------
     * 🔷 LAYOUT SEMANTICS
     * ---------------------------------------------------------------------
     *
     * Layout defines structural formatting intent:
     *
     * - `inline` → compact single-line structure
     * - `block` → expanded multi-line structure
     *
     * ---------------------------------------------------------------------
     * 🔷 RESOLUTION RULES
     * ---------------------------------------------------------------------
     *
     * 1. If mode is `compact` → returns `null`
     * 2. If parent resolution is requested → uses inherited layout
     * 3. Otherwise → uses current scope layout
     * 4. Defaults to `inline`
     *
     * @param options.ofParent
     * If true, resolves layout from parent scope instead of current scope.
     *
     * @returns Layout decision or `null` in compact mode.
     *
     * @since 1.0.0
     */
    getLayout(options?: { ofParent?: boolean }) {
        return utils.getLayout({
            mode: this.#_mode,
            ctx: this.#_ctx
        }, options);
    }

    /**
     * Applies ANSI highlighting metadata to envelope-related tokens.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * This function enriches specific structural tokens inside serialized
     * envelopes (e.g. `$codec`, `$kind`) with ANSI metadata for terminal
     * rendering.
     *
     * It does NOT modify token semantics or structure.
     *
     * It only attaches visual metadata used by the rendering stage.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When `ansiEnabled` is false:
     * - this function is a no-op
     *
     * When enabled:
     * - specific primitive tokens inside envelopes are styled:
     *   - codec → cyan background + white bold text
     *   - kind  → magenta foreground
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This is a purely cosmetic enhancement pass and does not affect:
     *
     * - normalization structure
     * - token ordering
     * - rendering logic
     *
     * @param tokens
     * Token sequence representing a normalized envelope structure.
     *
     * @since 1.0.0
     */
    highlightEnvelope(tokens: readonly Token[]) {
        return utils.highlightEnvelope(this.#_flags, tokens);
    }

    /**
     * Registry of normalization transformation passes.
     *
     * Each pass is responsible for converting specific high-level structures
     * into normalized envelope representations.
     *
     * ---------------------------------------------------------------------
     * 🔷 TRANSFORMATION MODEL
     * ---------------------------------------------------------------------
     *
     * Each transformation:
     *
     * - operates on the token stream
     * - may inject or remove tokens
     * - is isolated from other passes
     * - is context-driven but stateless in interface
     *
     * ---------------------------------------------------------------------
     * 🔷 AVAILABLE PASSES
     * ---------------------------------------------------------------------
     *
     * - object → normalizes object structures into JSON envelopes
     * - set    → converts Set instances into serialized representation
     * - map    → converts Map instances into entry-based envelopes
     *
     * These passes ensure that rendering stage receives a fully normalized
     * and consistent token stream.
     *
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
            objectPass({
                ctx: this.#_ctx,
                ignoredTokens: this.#_ignoredTokens
            }, this);
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