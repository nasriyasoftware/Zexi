import ZexiRenderingContext from "../../shared/context/context";
import { INLINE_SAFE_TOKENS } from "./configs";
import { isVisibleToken } from "../../shared/helpers";
import * as utils from '../../shared/utils';
import type { DebugPipelineFlags } from "./types";
import type { Token } from "../../../3-tokenization/types";

const DEBUG_INLINE_SAFE_TOKENS = new Set(INLINE_SAFE_TOKENS)

class DebugHelpers {
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
    readonly #_flags: DebugPipelineFlags;

    constructor(data: {
        ctx: ZexiRenderingContext,
        flags: DebugPipelineFlags,
        mode: 'compact' | 'pretty'
    }) {
        this.#_ctx = data.ctx;
        this.#_flags = data.flags;
        this.#_mode = data.mode;
    }

    /**
     * Determines whether a token is visible in debug output.
     *
     * Visibility is delegated to the shared token-visibility rules using
     * the `debug` renderer profile.
     *
     * Invisible tokens are excluded from debug rendering while visible
     * tokens remain available to subsequent layout and rendering stages.
     *
     * @param token
     * Token whose debug visibility should be evaluated.
     *
     * @returns
     * `true` if the token should participate in debug rendering,
     * otherwise `false`.
     *
     * @since 1.0.0
     */
    isVisibleToken(token: Token): boolean {
        return isVisibleToken(token, 'debug');
    }

    /**
     * Resolves the layout strategy for the current debug rendering context.
     *
     * The resolver evaluates the current rendering state against the set of
     * token kinds that are safe to render inline.
     *
     * Layout resolution is delegated to the shared layout resolver and does
     * not mutate the rendering context.
     *
     * @returns
     * The resolved layout strategy for the current rendering scope.
     *
     * @since 1.0.0
     */
    resolveLayout() {
        return utils.createResolver({
            ctx: this.#_ctx,
            inlineSafe: DEBUG_INLINE_SAFE_TOKENS,
            renderer: 'debug'
        }).resolve();
    }

    /**
     * Aborts rendering of the current scope.
     *
     * The operation rolls back the active rendering group to its entry state
     * without changing the layout strategy for the subsequent rendering
     * attempt.
     *
     * Unlike {@link forceBlock}, this method does not request block layout.
     * It is responsible only for aborting the current group and restoring
     * the rendering context.
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
     * Aborts the current group and forces its next rendering attempt
     * to use block layout.
     *
     * This is the high-level layout fallback operation used when the
     * current group cannot safely remain in inline layout.
     *
     * The underlying group rollback is delegated to {@link abortWriting},
     * while the block-layout request is recorded in the pipeline flags.
     *
     * @throws Error
     * If no active group exists.
     *
     * @throws Error
     * If an abort is attempted from the root scope.
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
     * Resolves an overflow encountered while rendering a primitive.
     *
     * When a primitive cannot fit within the available inline width, this
     * operation determines the required layout fallback for the primitive's
     * surrounding rendering groups.
     *
     * In pretty mode, the operation may:
     *
     * - force the primitive's current group into block layout
     * - promote an inline array to block layout when the primitive is an
     *   array element
     * - cascade block layout through enclosing inline key-value groups
     *
     * In compact mode, no layout fallback is performed.
     *
     * The actual overflow decision is made by the renderer before invoking
     * this method. This method is responsible only for resolving the
     * resulting layout transition.
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
     * Restores the rendering depth to the depth recorded for the current
     * rendering group.
     *
     * This operation delegates depth restoration to the shared rendering
     * utilities and is used when rendering control flow requires the current
     * traversal state to be synchronized with its group snapshot.
     *
     * @throws Error
     * If the current group does not contain a valid depth snapshot.
     *
     * @throws Error
     * If the recorded depth is inconsistent with the current traversal depth.
     *
     * @since 1.0.0
     */
    restoreDepth() {
        utils.restoreDepth(this.#_ctx);
    }

    /**
     * Marks the current rendering group to be ignored.
     *
     * Ignoring a group prevents it from participating in the subsequent
     * rendering flow while preserving the surrounding rendering context.
     *
     * This operation affects pipeline control state through the shared
     * normalization flags.
     *
     * @throws Error
     * If no active group exists.
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
     * Returns the layout assigned to the current rendering scope.
     *
     * In compact mode, layout information is not applicable and `null`
     * is returned. In pretty mode, the current scope's layout is resolved
     * from the rendering context.
     *
     * When `ofParent` is enabled, the layout of the parent scope is returned
     * instead of the current scope.
     *
     * @param options
     * Optional layout lookup options.
     *
     * @param options.ofParent
     * When `true`, resolves the layout of the parent rendering scope.
     * When omitted or `false`, resolves the current scope's layout.
     *
     * @returns
     * The current or parent layout strategy, or `null` when layout is not
     * applicable to the current rendering mode.
     *
     * @since 1.0.0
     */
    getLayout(options?: { ofParent?: boolean }) {
        return utils.getLayout({
            mode: this.#_mode,
            ctx: this.#_ctx
        }, options);
    }
}

export default DebugHelpers;