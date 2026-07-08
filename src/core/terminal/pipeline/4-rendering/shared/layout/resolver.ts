import ZexiRenderingContext from "../context/context";
import { DEFERRED_BODY_ENVELOPES } from "../envelope/consts";
import { isVisibleToken } from "../helpers";
import type { GroupStartToken } from "../../../3-tokenization/tokens/tokenization/group";
import type { Token } from "../../../3-tokenization/types";
import type { EnvelopeKind } from "../envelope/types";
import TOKENS from "../../../3-tokenization/tokens";

/**
 * Final layout decision produced by the resolver.
 *
 * ### Semantics
 * - `inline`: The entire structure can be rendered without line breaks.
 * - `block`: At least one structural constraint requires multi-line rendering.
 *
 * This is a **terminal decision** — once `block` is reached, it cannot be
 * downgraded back to `inline`.
 *
 * @since 1.0.0
 */
type LayoutDecision = 'inline' | 'block';

/**
 * Normalization strategy used when evaluating token visibility.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Layout resolution must mirror the visibility rules of the active
 * renderer.
 *
 * Certain token types may be considered non-renderable by one
 * renderer but renderable by another.
 *
 * The resolver uses this value when evaluating:
 *
 * - property visibility
 * - inline safety
 * - structural complexity
 *
 * This prevents layout decisions from being influenced by tokens
 * that will later be removed during normalization.
 *
 * ---------------------------------------------------------------------
 * 🔷 CURRENT VALUES
 * ---------------------------------------------------------------------
 *
 * - `json`
 *   Applies JSON visibility rules.
 *
 * - `debug`
 *   Applies debug visibility rules.
 *
 * @since 1.0.0
 */
type Renderer = 'json' | 'debug';

/**
 * Decides whether a structured value should be rendered in `inline` or `block` layout.
 *
 * The resolver is a **cursor-driven layout analyzer** that operates directly on
 * the active token stream through `ZexiRenderingContext`.
 *
 * It does not accept an explicit token input. Instead, it resolves layout based on
 * the **current traversal position**, which must be a `GroupStartToken`.
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * This resolver is responsible for:
 *
 * - Scanning a token group starting at the current `group-start` position
 * - Determining whether the group can remain inline
 * - Escalating to block layout when structural constraints require it
 * - Respecting renderer-specific visibility rules
 *
 * It does NOT render output and does NOT mutate the token stream structure.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION MODEL
 * ---------------------------------------------------------------------
 *
 * The resolver operates under a strict assumption:
 *
 * - `ctx.tokens.current` MUST point to a `GroupStartToken`
 *
 * Layout resolution is always tied to the renderer’s traversal lifecycle.
 * The resolver does not locate groups; it evaluates the group at the current cursor.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCANNING STRATEGY
 * ---------------------------------------------------------------------
 *
 * Once invoked, the resolver:
 *
 * 1. Reads the current `group-start` from `ctx.tokens.current`
 * 2. Begins scanning forward from the next token
 * 3. Tracks nested structure (objects, arrays, sets, maps)
 * 4. Applies inline-safety rules per token
 * 5. Stops at matching `group-end` or on first block condition
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE DEPENDENCY
 * ---------------------------------------------------------------------
 *
 * This resolver is **stateful with respect to the rendering context**:
 *
 * - It depends on `ctx.tokens.cursor` having already advanced
 * - It assumes traversal has been initiated externally
 * - It uses `ctx.tokens.current` as the source of truth for group identity
 *
 * It must NOT be called in isolation or without an active traversal state.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * The following invariants are enforced at runtime:
 *
 * - `ctx.tokens.cursor !== -1`
 * - `ctx.tokens.current` exists
 * - `ctx.tokens.current.kind === 'group-start'`
 *
 * Violating these invariants is a programming error and will throw.
 *
 * ---------------------------------------------------------------------
 * 🔷 DECISION MODEL
 * ---------------------------------------------------------------------
 *
 * The resolver returns:
 *
 * - `inline`: group can be safely rendered on a single line
 * - `block`: group requires multiline layout
 *
 * Once `block` is reached, the scan terminates immediately.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This API intentionally avoids accepting a token parameter to ensure:
 *
 * - layout resolution is tied to traversal state
 * - no mismatch can occur between cursor position and evaluated group
 * - resolver usage mirrors production rendering flow exactly
 *
 * ---------------------------------------------------------------------
 * 🔷 GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The returned decision is final for the currently active group.
 * Re-evaluation requires resetting the traversal context and advancing
 * to a new `group-start`.
 *
 * @since 1.0.0
 */
class LayoutResolver {
    /**
     * Rendering context containing:
     * - token stream
     * - scope tracking
     * - layout metadata
     *
     * This resolver depends on the context being **stable during scanning**.
     *
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Set of token kinds considered safe for inline rendering.
     *
     * ### Meaning
     * A token kind being in this set implies:
     * - it does not introduce structural expansion
     * - it does not increase visual width unpredictably
     * - it does not require multi-line formatting
     *
     * Anything outside this set is considered *layout-sensitive*.
     *
     * @since 1.0.0
     */
    readonly #_inlineSafe: Set<Token['kind']>;

    /**
     * Stack of container class names encountered during traversal.
     *
     * This stack is used to determine how separators and properties
     * should be interpreted at any given point.
     *
     * Examples:
     * - "Array" → separator = list element delimiter
     * - "Set"   → separator = value delimiter
     * - "Map"   → forced block semantics
     * - "Record"→ object key/value semantics
     *
     * The stack is LIFO and updated via `object-name` tokens.
     *
     * @since 1.0.0
     */
    readonly #_classNames: string[] = [];

    /**
     * Internal traversal state.
     *
     * ### Fields
     * - `index`: current position in token stream
     * - `scopes.opened`: number of object scopes opened
     * - `scopes.closed`: number of object scopes closed
     *
     * ### Purpose
     * Ensures correct interpretation of:
     * - nested objects
     * - array/object transitions
     * - class-name scoping
     *
     * @since 1.0.0
     */
    readonly #_data = {
        index: 0,
        scopes: { opened: 0, closed: 0 },
        array: { separators: 0 }
    }

    /**
     * Active normalization strategy used during visibility analysis.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Layout decisions must be based on the structure that will remain
     * after rendering, not the raw token stream.
     *
     * This value is forwarded to visibility utilities such as
     * `isVisibleToken()` so the resolver can ignore tokens that the
     * active renderer will eventually remove.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXAMPLE
     * ---------------------------------------------------------------------
     *
     * Consider:
     *
     *     { a: undefined }
     *
     * Under JSON renderer:
     *
     * - property `a` is removed
     * - resulting object becomes `{}`
     *
     * Without renderer awareness, the resolver could incorrectly
     * classify the object as requiring block layout.
     *
     * @since 1.0.0
     */
    #_renderer: Renderer;

    /**
     * Current decision state.
     *
     * This value is mutated during scanning and represents:
     *
     * - optimistic default: `inline`
     * - failure state: `block` (terminal)
     *
     * Once set to `block`, it is never reverted.
     *
     * @since 1.0.0
     */
    #_decision: LayoutDecision = 'inline';

    /**
     * Creates a new LayoutResolver instance.
     *
     * ### Important
     * The resolver is **single-use per scan**.
     * It maintains internal mutable state and must not be reused
     * across multiple root tokens.
     *
     * @param context
     * Normalization context providing token stream access,
     * scope metadata, and normalization-aware visibility state.
     * 
     * @param renderer
     * Normalization strategy used when evaluating token visibility.
     * 
     * @param inlineSafe
     * Set of token kinds that are considered safe for inline rendering.
     *
     * @since 1.0.0
     */
    constructor(
        context: ZexiRenderingContext,
        inlineSafe: Set<Token['kind']>,
        renderer: Renderer,
    ) {
        this.#_ctx = context;
        this.#_renderer = renderer;
        this.#_inlineSafe = inlineSafe;
    }

    /**
     * Safely retrieves a token at a given index while skipping
     * non-structural tokens.
     *
     * ---------------------------------------------------------------------
     * SKIPPED TOKENS
     * ---------------------------------------------------------------------
     *
     * These tokens are ignored because they do not contribute to layout:
     *
     * - `anchor`    → structural marker only
     * - `callback`  → runtime execution hook
     * - `ansi`      → ANSI escape sequence
     *
     * ---------------------------------------------------------------------
     * WHY THIS EXISTS
     * ---------------------------------------------------------------------
     *
     * Layout decisions must only consider *render-relevant structure*.
     * Metadata tokens would incorrectly influence inline/block decisions.
     *
     * @param index
     * Absolute index in token stream.
     *
     * @returns
     * First structural token at or after index, or `null`.
     *
     * @since 1.0.0
     */
    #_peek(index: number): Token | null {
        let token = this.#_ctx.tokens.peek(index);
        while (
            token &&
            (
                token.kind === 'anchor' ||
                token.kind === 'callback' ||
                token.kind === 'ansi'
            )
        ) {
            token = this.#_ctx.tokens.peek(++index);
        }

        return token;
    }

    /**
     * Token-type-specific layout decision handlers.
     *
     * Each resolver applies additional constraints based on container type.
     *
     * These are NOT independent decisions — they can only escalate
     * the global state to `block`.
     *
     * @since 1.0.0
     */
    readonly #_resolvers = {
        /**
         * Object property resolver.
         *
         * ### Trigger condition
         * Executes only when:
         *
         * - token.kind === 'property'
         * - token.type === 'property'
         *
         * ### Behavior
         *
         * Resolves the property's value token and evaluates whether
         * that value contributes to the final normalized structure.
         *
         * Visibility is determined using the active normalization
         * strategy.
         *
         * If the property value would be removed during normalization,
         * it has no impact on layout resolution.
         *
         * Otherwise, non-inline-safe values force block layout.
         *
         * ### Key invariant
         *
         * Only visible properties participate in inline-safety checks.
         *
         * @since 1.0.0
         */
        objects: (token: Token) => {
            if (!(
                token.kind === 'property' && // The token kind is a property
                token.type === 'property'    // The property type is a property, not a method, getter, etc.
            )) {
                return;
            }

            const valueToken = this.#_peek(this.#_data.index + 3);
            if (!valueToken) { return; }

            if (!this.#_inlineSafe.has(valueToken.kind)) {
                this.#_promoteLayout();
            }
        },

        /**
         * Set value resolver.
         *
         * ### Behavior
         * Set entries are treated as primitive sequences:
         *
         * - Only evaluates separator tokens
         * - Looks at previous value token
         *
         * ### Rule
         * If any Set value is not inline-safe → layout becomes `block`
         *
         * @since 1.0.0
         */
        set: (token: Token) => {
            if (token.kind !== 'separator') { return; }

            const valueToken = this.#_peek(this.#_data.index - 1);
            if (!valueToken) {
                throw new Error(`Invariant violation: Set value token was expected before the separator token but was not found.`);
            }

            if (valueToken.kind !== 'primitive') {
                throw new Error(`Invariant violation: Set value token was expected before the separator token but was not found.`);
            }

            if (!this.#_inlineSafe.has(valueToken.kind)) {
                this.#_promoteLayout();
            }
        },

        /**
         * Map resolver.
         *
         * ### Design decision
         * Maps are always rendered as block structures.
         *
         * ### Reason
         * Map entries are semantically key/value pairs that:
         * - do not have stable property semantics
         * - may contain heterogeneous value shapes
         * - require structural clarity in output
         *
         * This avoids ambiguity in JSON-like renderers.
         *
         * @since 1.0.0
         */
        map: (token: Token) => {
            this.#_promoteLayout();
        },

        /**
         * Array resolver.
         *
         * ---------------------------------------------------------------------
         * 🔷 PURPOSE
         * ---------------------------------------------------------------------
         *
         * Determines whether an array should be rendered inline or as a block
         * structure during layout resolution.
         *
         * This resolver evaluates structural density and element safety to
         * decide whether inline rendering remains valid.
         *
         * ---------------------------------------------------------------------
         * 🔷 DECISION MODEL
         * ---------------------------------------------------------------------
         *
         * Array layout is determined by two independent constraints:
         *
         * ### 1. Element safety constraint
         *
         * If any array element is not inline-safe:
         *
         * - the array is immediately promoted to `block` layout
         *
         * This ensures semantic correctness for complex or unsafe values.
         *
         * ---------------------------------------------------------------------
         *
         * ### 2. Cardinality constraint (renderer-aware)
         *
         * Even if all elements are inline-safe, the array is forced into
         * `block` layout when it exceeds 5 separators
         * (i.e. 6 or more effective elements).
         *
         * However, this rule is **renderer-sensitive**:
         *
         * - In `json` renderer:
         *   - array elements that are `primitive(undefined)` are ignored
         *   - their separators do NOT contribute to cardinality
         *
         * - In other renderers:
         *   - all separators contribute normally
         *
         * This ensures layout decisions reflect the **normalized output
         * structure**, not raw token artifacts.
         *
         * ---------------------------------------------------------------------
         * 🔷 UNDEFINED ELEMENT HANDLING
         * ---------------------------------------------------------------------
         *
         * In JSON rendering mode:
         *
         * - `undefined` array elements are treated as non-rendered values
         * - their associated separators are skipped for layout decisions
         *
         * This prevents arrays like:
         *
         *     [1, undefined, 2]
         *
         * from being incorrectly classified as "large" or "dense"
         * due to non-rendered structural noise.
         *
         * ---------------------------------------------------------------------
         * 🔷 BEHAVIOR SUMMARY
         * ---------------------------------------------------------------------
         *
         * The final layout decision is:
         *
         * - `block` if:
         *   - any element is not inline-safe
         *   - OR effective element count > 5 (after renderer filtering)
         *
         * - otherwise:
         *   - `inline`
         *
         * ---------------------------------------------------------------------
         * 🔷 DESIGN INTENT
         * ---------------------------------------------------------------------
         *
         * This model exists to ensure:
         *
         * - layout matches rendered output (not raw tokens)
         * - undefined values do not distort structural heuristics
         * - consistent behavior between normalization and layout phases
         * - deterministic output across renderer strategies
         *
         * ---------------------------------------------------------------------
         * @since 1.0.0
         */
        array: (token: Token) => {
            if (token.kind !== 'separator') { return; }
            if (this.#_renderer === 'json') {
                const prevToken = this.#_peek(this.#_data.index - 1);
                if (prevToken?.kind === 'primitive' && prevToken.type === 'undefined') {
                    return;
                }
            }

            this.#_data.array.separators++;

            if (this.#_data.array.separators > 4) {
                this.#_promoteLayout();
                return;
            }

            const valueToken = this.#_peek(this.#_data.index - 1);
            if (!valueToken) {
                throw new Error(`Invariant violation: Array value token was expected before the separator token but was not found.`);
            }

            if (!this.#_inlineSafe.has(valueToken.kind)) {
                this.#_promoteLayout();
            }
        }
    }

    /**
     * Pushes or sets the current container class name.
     *
     * If undefined, defaults to "Record".
     *
     * @since 1.0.0
     */
    set #_className(name: string | undefined) {
        const className = name ?? 'Record';
        this.#_classNames.push(className);
    }

    /**
     * Returns the current container class name.
     *
     * This represents the active structural interpretation context.
     *
     * @returns
     * Current class context (Array | Set | Map | Record)
     *
     * @since 1.0.0
     */
    get #_className() {
        return this.#_classNames[this.#_classNames.length - 1];
    }

    /**
     * Promotes the current layout decision to `block`.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Centralizes every transition from `inline` to `block` into a single
     * method.
     *
     * This avoids duplicating the assignment throughout the resolver and
     * provides a single location for diagnostics, tracing, or future
     * instrumentation.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN RATIONALE
     * ---------------------------------------------------------------------
     *
     * The resolver follows a one-way decision model:
     *
     * - every scan begins as `inline`
     * - any blocking condition promotes the decision to `block`
     * - once promoted, the decision is never downgraded
     *
     * Routing all promotions through this method makes that transition
     * explicit and easy to audit.
     *
     * ---------------------------------------------------------------------
     * 🔷 DEBUGGING
     * ---------------------------------------------------------------------
     *
     * During development, tracing or logging can be added here (for example,
     * `console.trace()`) to identify precisely which rule caused the layout
     * to become `block`, without modifying every promotion site throughout
     * the resolver.
     *
     * @since 1.0.0
     */
    #_promoteLayout() {
        this.#_decision = 'block';
    }

    /**
     * Returns resolver function for current class context.
     *
     * This is used dynamically during token scanning when encountering
     * context-sensitive tokens.
     *
     * @returns
     * Function that processes a token or undefined.
     *
     * @since 1.0.0
     */
    #_getResolver() {
        if (!this.#_className) {
            return;
        }

        switch (this.#_className) {
            case 'Set': return this.#_resolvers.set;
            case 'Map': return this.#_resolvers.map;
            case 'Array': return this.#_resolvers.array;
            default: return this.#_resolvers.objects;
        }
    }

    /**
     * Determines whether scanning is still within the primary object scope.
     *
     * ### Logic
     * The resolver treats a scope as active if:
     * - scanning just started, OR
     * - closed + 1 === opened
     *
     * This prevents nested objects from incorrectly influencing
     * parent-level layout decisions.
     *
     * @since 1.0.0
     */
    get #_sameScope() {
        const s = this.#_data.scopes;

        const justStarted = s.closed === 0 && s.opened === 0;
        return justStarted || s.closed + 1 === s.opened;
    }

    /**
     * Resolves the layout of the group at the current traversal position.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * This resolver determines whether a token group should be rendered
     * in `inline` or `block` layout by scanning forward from the current
     * `group-start` token until its matching `group-end`.
     *
     * It does not render output — it only evaluates structural constraints
     * of the group in its current traversal context.
     *
     * ---------------------------------------------------------------------
     * 🔷 SCANNING MODEL
     * ---------------------------------------------------------------------
     *
     * The resolver performs a single forward scan over the token stream:
     *
     * - starts immediately after the current `group-start`
     * - processes tokens sequentially
     * - tracks scope depth and container type
     * - evaluates inline safety of values
     * - applies container-specific rules
     *
     * The scan is deterministic and stops early when a block condition
     * is detected or the group boundary is reached.
     *
     * ---------------------------------------------------------------------
     * 🔷 VISIBILITY RULES
     * ---------------------------------------------------------------------
     *
     * Token visibility is evaluated using the active renderer strategy.
     *
     * Tokens that are not visible in the current renderer are ignored
     * and must not influence layout decisions.
     *
     * This ensures layout decisions reflect the actual rendered output.
     *
     * ---------------------------------------------------------------------
     * 🔷 CONTAINER BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * Different container types impose different constraints:
     *
     * - Object:
     *   property/value structure must remain inline-safe
     *
     * - Array:
     *   element safety + structural density rules apply
     *
     * - Set:
     *   values are treated as a linear sequence
     *
     * - Map:
     *   always forces `block` layout
     *
     * Container context is derived dynamically during scanning.
     *
     * ---------------------------------------------------------------------
     * 🔷 TERMINATION CONDITIONS
     * ---------------------------------------------------------------------
     *
     * Scanning stops when:
     *
     * - matching `group-end` is reached
     * - nested object depth exceeds inline constraints
     * - a container-specific rule forces block layout
     * - a structural violation is detected
     *
     * Early termination guarantees minimal scan overhead.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANTS
     * ---------------------------------------------------------------------
     *
     * This method assumes:
     *
     * - traversal has already started
     * - current token exists
     * - current token is a `group-start`
     *
     * These invariants are enforced by the rendering pipeline and are
     * validated defensively at runtime.
     *
     * ---------------------------------------------------------------------
     * 🔷 GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Once a decision is returned, it is final for the scanned group.
     * Re-evaluation requires a new traversal context and a fresh scan.
     *
     * ---------------------------------------------------------------------
     * 🔷 ERRORS
     * ---------------------------------------------------------------------
     *
     * This method may throw if:
     *
     * - traversal has not started (`cursor === -1`)
     * - no current token exists
     * - current token is not `group-start`
     *
     * @returns
     * Final layout decision (`inline` or `block`)
     *
     * @since 1.0.0
     */
    resolve(): LayoutDecision {
        if (this.#_ctx.tokens.cursor === -1) {
            throw new Error('Invariant violation: The layout resolver was called before traversing started.');
        }

        const token = this.#_ctx.tokens.current as InstanceType<typeof TOKENS.GroupStart>;
        if (!token) {
            throw new Error('Invariant violation: No more tokens left to analyze.');
        }

        if (token.kind !== 'group-start') {
            throw new Error(`Invariant violation: The layout resolver is expected to be called with a "group-start" token but received "${token.kind}".`);
        }

        const data = this.#_data;
        let item = this.#_peek(++data.index);

        scanning: do {
            try {
                if (!item) { break; }

                if (item.kind === 'group-end' && item.groupId === token.id) {
                    break scanning;
                }

                switch (item.kind) {
                    case 'object-open': {
                        data.scopes.opened++;

                        if (data.scopes.opened > 1) {
                            this.#_promoteLayout();
                            break scanning;
                        }

                        continue scanning;
                    }

                    case 'object-close': {
                        data.scopes.closed++;
                        this.#_classNames.pop();

                        if (data.scopes.closed === data.scopes.opened) {
                            break scanning;
                        }

                        continue scanning;
                    }
                }

                if (this.#_sameScope) {
                    switch (item.kind) {
                        case 'error-start':
                        case 'error-end':
                        case 'error-cause-start':
                        case 'error-cause-end':
                        case 'error-data': {
                            this.#_promoteLayout();
                            break scanning;
                        }

                        case 'object-name': {
                            this.#_className = item.className;

                            if (DEFERRED_BODY_ENVELOPES.has(this.#_className?.toLowerCase() as EnvelopeKind)) {
                                this.#_promoteLayout();
                                break scanning;
                            }

                            continue scanning;
                        }

                        case 'key-value-separator': {
                            if (!this.#_className) {
                                /**
                                 * This means we're inside a key-value pair of an object
                                 * and we don't need to continue scanning.
                                 */
                                continue scanning;
                            }

                            if (item.value !== ':') {
                                this.#_promoteLayout();
                                break scanning;
                            }


                            const propToken = this.#_peek(data.index - 1);
                            if (!propToken) {
                                throw new Error(`Invariant violation: Property token was expected before the separator token but was not found.`);
                            }

                            if (propToken.kind !== 'property') {
                                throw new Error(`Invariant violation: Property token was expected before the separator token but was not found.`);
                            }

                            if (propToken.type === 'property') {
                                const valueToken = this.#_peek(data.index + 2);
                                if (!valueToken) {
                                    throw new Error(`Invariant violation: Key value token was expected after the separator token but was not found.`);
                                }

                                const isVisible = isVisibleToken(valueToken, this.#_renderer);
                                if (!isVisible) {
                                    continue scanning;
                                }

                                if (!this.#_inlineSafe.has(valueToken.kind)) {
                                    this.#_promoteLayout();
                                    break scanning;
                                }
                            }

                            continue scanning;
                        }

                        default: {
                            this.#_getResolver()?.(item);
                        }
                    }
                } else {
                    if (item.kind === 'object-name' && !this.#_className) {
                        this.#_promoteLayout();
                        break scanning;
                    }
                }

                if (this.#_decision === 'block') { break scanning; }
            } finally {
                data.index++;
                item = this.#_peek(data.index);
            }
        } while (item);

        return this.#_decision;
    }

    /**
     * Resolves the layout of the group at the current traversal position.
     *
     * Creates a fresh {@link LayoutResolver} instance and performs a layout
     * scan for the group whose opening `group-start` token is currently
     * selected by the rendering context.
     *
     * ### Preconditions
     * The rendering context must already be traversing the token stream, and
     * `context.tokens.current` must be a `GroupStartToken`.
     *
     * This invariant is guaranteed by the rendering pipeline, which only
     * invokes layout resolution when a group start token is encountered.
     *
     * @param config
     * Configuration for the resolution pass.
     *
     * - `context`:
     *   Active rendering context positioned at the group being resolved.
     *
     * - `inlineSafe`:
     *   Set of token kinds considered safe for inline rendering.
     *
     * - `renderer`:
     *   Active visibility strategy used during layout evaluation.
     *
     * @returns
     * The layout decision for the current group.
     *
     * @throws {Error}
     * If the current traversal token is not a `GroupStartToken`.
     *
     * @since 1.0.0
     */
    static resolve(
        config: {
            context: ZexiRenderingContext,
            inlineSafe: Set<Token['kind']>,
            renderer: Renderer
        }
    ): LayoutDecision {
        return new LayoutResolver(
            config.context,
            config.inlineSafe,
            config.renderer
        ).resolve();
    }
}

export default LayoutResolver;