import keys from "./keys";
import TOKENS from "../../3-tokenization/tokens";
import ZexiRenderingContext from "./context/context";
import LayoutResolver from "./layout/resolver";
import { ANSI } from "../../../styling/ansi";
import type { Token } from "../../3-tokenization/types";
import type { JSONPipelineFlags } from "../renderers/json/types";
import type { DebugPipelineFlags } from "../renderers/debug/types";

type PipelineFlags = JSONPipelineFlags | DebugPipelineFlags;

/**
 * Creates a layout resolver for the current pipeline execution.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Layout resolution determines whether a structural group should be
 * represented as:
 *
 * - `inline`
 * - `block`
 *
 * based on:
 *
 * - structural complexity
 * - token visibility
 * - inline-safety constraints
 * - active normalization rules
 *
 * ---------------------------------------------------------------------
 * 🔷 NORMALIZATION ROLE
 * ---------------------------------------------------------------------
 *
 * The resolver operates during normalization and evaluates groups
 * before rendering begins.
 *
 * The resulting decision may influence:
 *
 * - group rewriting
 * - layout token generation
 * - structural collapsing
 * - renderer preparation
 *
 * ---------------------------------------------------------------------
 * 🔷 renderer AWARENESS
 * ---------------------------------------------------------------------
 *
 * Layout decisions are performed using the visibility rules of the
 * supplied renderer.
 *
 * This allows the resolver to ignore tokens that will be removed
 * during normalization and prevents false block-layout decisions
 * caused by non-renderable values.
 *
 * Examples include:
 *
 * - undefined object properties
 * - symbol-valued properties
 * - renderer-specific exclusions
 *
 * As a result, layout resolution reflects the structure that will
 * actually survive normalization.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * Inline safety is renderer-specific.
 *
 * Different renderers may permit different token kinds to
 * participate in inline rendering, therefore the inline-safe
 * registry must be supplied by the caller.
 *
 * ---------------------------------------------------------------------
 * @param resources
 * Resolver dependencies.
 *
 * @param resources.ctx
 * Active normalization context used for token traversal and
 * structural analysis.
 *
 * @param resources.inlineSafe
 * Set of token kinds that are considered safe for inline rendering.
 *
 * @param resources.renderer
 * Visibility strategy used during layout resolution.
 *
 * Determines which tokens are considered renderable when evaluating:
 *
 * - property visibility
 * - inline safety
 * - structural complexity
 *
 * @returns
 * Configured layout resolver instance.
 *
 * @internal
 * @since 1.0.0
 */
export function createResolver(resources: {
    ctx: ZexiRenderingContext,
    inlineSafe: Set<Token['kind']>,
    renderer: 'json' | 'debug'
}) {
    const { ctx, inlineSafe, renderer } = resources;
    return new LayoutResolver(ctx, inlineSafe, renderer);
}

/**
 * Aborts rendering of the current group and restores the rendering
 * context to the state captured when that group began.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Rendering groups are processed optimistically, allowing the renderer
 * to begin emitting output before all layout decisions have been fully
 * resolved.
 *
 * When rendering of the current group must be abandoned, this function
 * performs the structural rollback required to safely retry or continue
 * rendering from the group's entry point.
 *
 * Unlike higher-level layout helpers, this function performs only the
 * rollback itself. It does not decide how rendering should proceed
 * afterward.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLLBACK BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * Aborting a group restores the rendering context to the exact snapshot
 * captured when the active group was entered.
 *
 * The rollback consists of two coordinated operations:
 *
 * ### 1. Depth restoration
 * - restores the traversal depth to the group's recorded entry depth
 * - removes any depth increments performed while rendering the group
 * - guarantees structural consistency for subsequent rendering
 *
 * ### 2. Scope rollback
 * - aborts the current rendering scope
 * - rewinds any state managed by the scope system
 * - restores traversal to the group's entry position
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ROLE
 * ---------------------------------------------------------------------
 *
 * This function is the low-level rollback primitive used throughout the
 * rendering pipeline whenever the current group can no longer continue
 * rendering under its current execution path.
 *
 * It intentionally performs no layout decisions, allowing callers to
 * choose the appropriate recovery strategy after the rollback completes.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITY BOUNDARY
 * ---------------------------------------------------------------------
 *
 * This function does NOT:
 *
 * - force inline rendering
 * - force block rendering
 * - modify rendering layout metadata
 * - alter pipeline rendering flags
 *
 * It is solely responsible for restoring rendering state.
 *
 * Higher-level helpers may build additional behavior on top of this
 * primitive (for example, retrying the group using block layout).
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - A rendering group must currently be active.
 * - The active scope must not be the root scope.
 * - Group depth metadata must exist and be internally consistent.
 *
 * Violating any of these conditions indicates an invalid rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * After execution:
 *
 * - traversal depth matches the group's entry snapshot
 * - the active rendering scope has been aborted
 * - rendering may safely resume from the restored state
 *
 * @param ctx
 * Active rendering context whose current group should be aborted.
 *
 * @throws Error
 * If no active rendering group exists.
 *
 * @throws Error
 * If attempting to abort the root scope.
 *
 * @throws Error
 * If the stored group depth is missing or inconsistent.
 *
 * @internal
 * @since 1.0.0
 */
export function abortWriting(ctx: ZexiRenderingContext) {
    const currentGroup = ctx.data.get<symbol>(keys.GROUP);
    if (!currentGroup) {
        throw new Error(`Invariant violation: Aborting a scope without a current group identifier.`);
    }

    if (ctx.scopes.isRoot) {
        throw new Error(`Invariant violation: Aborting the root scope.`);
    }

    restoreDepth(ctx);  // Restoring the depth must occur before aborting the group
    ctx.scopes.abort();
}

/**
 * Aborts the current rendering group and requests that its next
 * rendering attempt use block layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This helper combines two operations commonly performed together when
 * inline rendering cannot continue:
 *
 * 1. abort the current rendering group
 * 2. request that the group be re-rendered using block layout
 *
 * This provides a convenient high-level operation for layout recovery
 * while keeping rollback mechanics independent from layout policy.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION MODEL
 * ---------------------------------------------------------------------
 *
 * The function first delegates to `abortWriting(ctx)`, restoring the
 * rendering context to the group's entry state.
 *
 * Once rollback has completed successfully, it marks the pipeline so
 * that the next rendering attempt for the same group is forced to use
 * block layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 LAYOUT TRANSITION
 * ---------------------------------------------------------------------
 *
 * Setting `forceNextGroupAsBlock` does not immediately modify the
 * current group's layout.
 *
 * Instead, the flag is consumed when the renderer re-enters the group,
 * ensuring that layout selection occurs through the normal rendering
 * lifecycle.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ROLE
 * ---------------------------------------------------------------------
 *
 * This function implements the renderer's inline-to-block fallback
 * strategy.
 *
 * It is typically invoked when:
 *
 * - inline width constraints are exceeded
 * - structural constraints prohibit inline rendering
 * - renderer-specific rules require expansion into block layout
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITY BOUNDARY
 * ---------------------------------------------------------------------
 *
 * This helper determines *how* rendering should continue after an
 * aborted group.
 *
 * The rollback itself is entirely delegated to `abortWriting()`.
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * After execution:
 *
 * - the current rendering group has been aborted
 * - traversal state has been restored
 * - the next rendering attempt for that group will use block layout
 *
 * @param resources
 * Runtime resources required for rollback and layout transition.
 *
 * @param resources.ctx
 * Active rendering context.
 *
 * @param resources.flags
 * Mutable pipeline flags controlling rendering behavior.
 *
 * @throws Error
 * Propagates any error thrown by `abortWriting()`.
 *
 * @internal
 * @since 1.0.0
 */
export function forceBlock(
    resources: {
        ctx: ZexiRenderingContext,
        flags: PipelineFlags
    }
) {
    abortWriting(resources.ctx);
    resources.flags.forceNextGroupAsBlock = true;
}

/**
 * Restores the traversal depth of the rendering context to the value
 * recorded at the start of the current rendering group.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * During rendering, nested structures may increase traversal depth
 * (e.g. entering blocks, scopes, or grouped constructs).
 *
 * If rendering must be aborted and retried (e.g. switching from inline
 * to block layout), the depth must be restored to its original value
 * to ensure structural consistency.
 *
 * This function enforces that invariant.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESTORE SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The function reads the snapshot depth stored under:
 *
 * - `ctx.data[keys.GROUP_DEPTH]`
 *
 * and restores `ctx.depth.value` back to that value by decrementing
 * the depth step-by-step.
 *
 * This guarantees:
 *
 * - no residual depth leakage between retry attempts
 * - consistent indentation and structural alignment
 * - deterministic re-execution of the same group
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - A group depth snapshot must exist in `ctx.data`
 * - The snapshot depth must never exceed the current depth
 *
 * Violations indicate corrupted or invalid rendering state.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTATION MODEL
 * ---------------------------------------------------------------------
 *
 * This function only mutates:
 *
 * - `ctx.depth` (by decrementing it until the snapshot is reached)
 *
 * It does NOT:
 *
 * - modify tokens
 * - modify scopes
 * - modify writer state
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLE IN PIPELINE
 * ---------------------------------------------------------------------
 *
 * This function is used as part of the group-abort rollback sequence,
 * ensuring that rendering retries start from a clean structural state.
 *
 * @param ctx
 * The active rendering context whose traversal depth will be restored.
 *
 * @throws Error
 * If no `currentGroupDepth` snapshot exists in the context.
 *
 * @throws Error
 * If the stored group depth is greater than the current depth,
 * indicating an inconsistent or corrupted traversal state.
 *
 * @internal
 * @since 1.0.0
 */
export function restoreDepth(ctx: ZexiRenderingContext) {
    if (!ctx.data.hasOwn(keys.GROUP_DEPTH)) {
        throw new Error(`Invariant violation: Attempting to ignore a group that does not have a depth.`);
    }

    const groupDepth = ctx.data.get<number>(keys.GROUP_DEPTH)!;

    if (groupDepth !== ctx.depth.value) {
        if (groupDepth > ctx.depth.value) {
            throw new Error(`Invariant violation: Attempting to ignore a group that has an initial depth greater than the current depth.`);
        }

        const difference = ctx.depth.value - groupDepth;
        let decreased = 0;
        for (let i = 1; i <= difference; i++) {
            ctx.depth.decrease();
            decreased++;
        }
    }
}

/**
 * Removes the current group from normalization output.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Certain semantic structures require replacement during normalization.
 *
 * Examples include:
 *
 * - envelope expansion
 * - structural rewriting
 * - renderer-specific substitutions
 *
 * Rather than emitting the original group, normalization may choose
 * to suppress it entirely and optionally replace it with another
 * token sequence.
 *
 * ---------------------------------------------------------------------
 * 🔷 NORMALIZATION ROLE
 * ---------------------------------------------------------------------
 *
 * This function marks the active group as ignored and rewinds all
 * tokens emitted by that group.
 *
 * Optional replacement tokens may then be injected into the output
 * stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This operation is available only during normalization because
 * rendering is not permitted to mutate token structure.
 *
 * @param resources - Normalization resources
 * @param replaceWith - Optional replacement token sequence
 *
 * @internal
 * @since 1.0.0
 */
export function ignoreCurrentGroup(
    resources: {
        ctx: ZexiRenderingContext,
        flags: PipelineFlags,
    },
) {
    const { ctx, flags } = resources;

    const currentGroup = ctx.data.get<symbol>(keys.GROUP);
    if (!currentGroup) {
        throw new Error(`Invariant violation: no active group to ignore.`);
    }

    flags.ignoreCurrentGroup = true;
}

/**
 * Resolves the active layout mode for the current scope.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Structural groups may be rendered using one of two layouts:
 *
 * - `inline`
 * - `block`
 *
 * This function retrieves the resolved layout assigned during
 * normalization.
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPACT MODE
 * ---------------------------------------------------------------------
 *
 * Compact rendering does not support layout selection.
 *
 * In compact mode this function always returns `null`.
 *
 * ---------------------------------------------------------------------
 * 🔷 PARENT LOOKUP
 * ---------------------------------------------------------------------
 *
 * When requested, layout may be inherited from the nearest ancestor
 * scope instead of the current scope.
 *
 * This is useful when rendering decisions depend on parent structure.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * Layout is determined during normalization and consumed during
 * rendering.
 *
 * This function never performs layout resolution itself.
 *
 * @param resources - Runtime resources
 * @param options - Layout lookup options
 *
 * @returns
 * - `'inline'`
 * - `'block'`
 * - `null` when layout is not applicable
 *
 * @internal
 * @since 1.0.0
 */
export function getLayout(
    resources: {
        mode: 'pretty' | 'compact',
        ctx: ZexiRenderingContext
    },
    options?: {
        ofParent?: boolean
    }
): 'inline' | 'block' | null {
    const { mode, ctx } = resources;
    if (mode !== 'pretty') { return null; }

    if (
        options?.ofParent === true &&
        ctx.data.hasInherited(keys.RENDERING_LAYOUT)
    ) {
        return ctx.data.getInherited<'inline' | 'block'>(keys.RENDERING_LAYOUT)!;
    }

    if (ctx.data.hasOwn(keys.RENDERING_LAYOUT)) {
        return ctx.data.get<'inline' | 'block'>(keys.RENDERING_LAYOUT)!;
    }

    return 'inline';
}

/**
 * Applies ANSI highlighting to envelope metadata fields.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Envelopes are synthetic structures used to represent values that
 * cannot be expressed directly in JSON.
 *
 * Examples include:
 *
 * - errors
 * - maps
 * - sets
 * - functions
 * - regular expressions
 *
 * To improve readability during terminal rendering, certain envelope
 * fields receive semantic ANSI styling.
 *
 * ---------------------------------------------------------------------
 * 🔷 HIGHLIGHTED FIELDS
 * ---------------------------------------------------------------------
 *
 * The following envelope properties are recognized:
 *
 * - `$codec`
 * - `$kind`
 *
 * Each field receives renderer-defined styling intended to visually
 * distinguish envelope metadata from user data.
 *
 * ---------------------------------------------------------------------
 * 🔷 NORMALIZATION ROLE
 * ---------------------------------------------------------------------
 *
 * This function executes during normalization.
 *
 * It does not inject ANSI escape sequences.
 *
 * Instead it enriches tokens with ANSI metadata that may later be
 * consumed by ANSI-aware renderers.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * ANSI metadata assignment follows first-write-wins semantics.
 *
 * Existing styling applied by higher-priority normalization rules is
 * preserved.
 *
 * ---------------------------------------------------------------------
 * 🔷 NO-OP BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * When ANSI rendering is disabled, this function performs no work.
 *
 * @param flags - Renderer normalization flags
 * @param tokens - Token sequence representing an envelope structure
 *
 * @internal
 * @since 1.0.0
 */
export function highlightEnvelope(
    flags: PipelineFlags,
    tokens: readonly Token[]
) {
    if (!flags.ansiEnabled) { return }

    const mark = {
        codec: (token: InstanceType<typeof TOKENS.Primitive>) => {
            token.ansi.assign('bgColor', ANSI.color.bg.normal.cyan);
            token.ansi.assign('color', ANSI.color.fg.normal.white);
            token.ansi.assign('styles', ANSI.style.bold);
        },
        kind: (token: InstanceType<typeof TOKENS.Primitive>) => {
            token.ansi.assign('color', ANSI.color.fg.normal.magenta);
        }
    }

    const track = { codec: false, kind: false };
    const isDone = () => track.codec && track.kind;

    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (isDone()) { break; }
        if (!(t.kind === 'property' && t.type === 'property')) { continue; }

        if (t.value === '$codec') {
            const target = tokens[i + 3] as InstanceType<typeof TOKENS.Primitive>;
            if (target.kind !== 'primitive') {
                throw new Error(`Invariant violation: expected "$codec" primitive value token but got ${target.kind}`);
            }

            mark.codec(target);
            continue;
        }

        if (t.value === '$kind') {
            const target = tokens[i + 3] as InstanceType<typeof TOKENS.Primitive>;
            if (target.kind !== 'primitive') {
                throw new Error(`Invariant violation: expected "$kind" primitive value token but got ${target.kind}`);
            }

            mark.kind(target);
            continue;
        }
    }
}

/**
 * Aborts rendering of the current primitive and propagates block layout
 * to enclosing structures when required.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Primitive values are rendered optimistically under the assumption that
 * they will fit within the remaining width of the current inline line.
 *
 * When a primitive exceeds the available width, simply retrying its own
 * group in block layout is often insufficient. Parent structures may
 * also need to abandon inline rendering in order to preserve structural
 * consistency.
 *
 * This helper performs the necessary rollback and propagates block-layout
 * requests through the surrounding structure according to the primitive's
 * position within the rendered hierarchy.
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPACT MODE
 * ---------------------------------------------------------------------
 *
 * Compact rendering does not perform adaptive layout decisions.
 *
 * When the active rendering mode is `compact`, this function performs no
 * work and returns immediately.
 *
 * ---------------------------------------------------------------------
 * 🔷 PROPAGATION RULES
 * ---------------------------------------------------------------------
 *
 * Depending on where the primitive appears, block layout is propagated
 * differently.
 *
 * ### 1. Current primitive group
 *
 * The primitive's own rendering group is always aborted first and marked
 * for block layout.
 *
 * ### 2. Array elements
 *
 * If the primitive belongs directly to an array whose layout is currently
 * inline, the enclosing array group is also forced into block layout.
 *
 * This prevents an oversized element from remaining inside an inline
 * array after retry.
 *
 * ### 3. Object property values
 *
 * If the primitive represents the value of a key-value pair, block layout
 * is propagated upward through every consecutive inline parent group until
 * a block-layout ancestor (or the root) is reached.
 *
 * This cascading behavior guarantees that parent object layouts remain
 * structurally coherent after an oversized property forces expansion.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ROLE
 * ---------------------------------------------------------------------
 *
 * This helper forms part of the adaptive layout retry mechanism.
 *
 * It coordinates:
 *
 * - rollback of the current rendering group
 * - layout promotion from inline to block
 * - propagation of block layout to affected parent structures
 *
 * By performing these operations before rendering resumes, subsequent
 * rendering attempts begin from a structurally consistent state.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * Layout propagation is intentionally structure-aware.
 *
 * Arrays require propagation only to their immediate container, whereas
 * object property values may require cascading through multiple nested
 * inline groups until a suitable block-layout boundary is reached.
 *
 * ---------------------------------------------------------------------
 * @param resources
 * Runtime resources used during adaptive layout handling.
 *
 * @param resources.mode
 * Active renderer mode.
 *
 * When the mode is `compact`, no adaptive layout is performed.
 *
 * @param resources.ctx
 * Active rendering context containing traversal state, scope metadata,
 * and token stream information.
 *
 * @param resources.flags
 * Pipeline flags controlling layout retries.
 *
 * @internal
 * @since 1.0.0
 */
export function resolvePrimitiveOverflow(
    resources: {
        mode: 'pretty' | 'compact',
        ctx: ZexiRenderingContext,
        flags: PipelineFlags
    }
) {
    const { mode, ctx, flags } = resources;
    if (mode !== 'pretty') { return; }

    const isKeyValuePairValue = ctx.tokens.peek(-3)?.kind === 'property';

    // Abort the current key-value pair group
    forceBlock({ ctx, flags });

    if (
        ctx.data.getInherited(keys.OBJECT) === 'Array' &&
        getLayout({ mode, ctx }) === 'inline'
    ) {
        forceBlock({ ctx, flags });
        return;
    }

    if (isKeyValuePairValue) {
        // Cascading all consecutive key-value pair groups all the way up
        while (
            !ctx.scopes.isRoot &&
            getLayout({ mode, ctx }) === 'inline'
        ) {
            forceBlock({ ctx, flags });
        }
    }
}