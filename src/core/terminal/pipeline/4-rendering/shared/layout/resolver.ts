import type ZexiRenderingContext from "../context/context";
import type { GroupStartToken } from "../../../3-tokenization/tokens/tokenization/group";
import type { Token } from "../../../3-tokenization/types";
import type { EnvelopeKind } from "../envelope/types";

import { DEFERRED_BODY_ENVELOPES } from "../envelope/consts";

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
 * Decides whether a structured value should be rendered in `inline` or `block` layout.
 *
 * The resolver performs a **forward scan over the token stream** starting from a
 * `GroupStartToken` and inspects the upcoming structure to determine whether the
 * current value can safely remain inline or must be expanded into a block layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * This class is responsible for:
 *
 * - Inspecting a token group without mutating it
 * - Detecting structural complexity that forces block rendering
 * - Understanding nested scopes (objects, arrays, sets, maps)
 * - Coordinating envelope-aware layout decisions (e.g. errors, deferred bodies)
 *
 * It does NOT render anything — it only produces a layout decision.
 *
 * ---------------------------------------------------------------------
 * 🔷 DECISION MODEL
 * ---------------------------------------------------------------------
 *
 * The resolver returns one of:
 *
 * - `inline`: The value is safe to render on a single line
 * - `block`: The value requires multi-line rendering
 *
 * Once the decision becomes `block`, scanning stops immediately.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCANNING STRATEGY
 * ---------------------------------------------------------------------
 *
 * The resolver:
 *
 * 1. Starts from the token after the group start
 * 2. Iterates forward using a controlled index (`#_data.index`)
 * 3. Peeks ahead/backward for contextual tokens
 * 4. Tracks nested object scopes (`object-open` / `object-close`)
 * 5. Stops when:
 *    - matching `group-end` is found
 *    - or a blocking condition is detected
 *
 * ---------------------------------------------------------------------
 * 🔷 SCOPE MODEL
 * ---------------------------------------------------------------------
 *
 * The resolver maintains a lightweight scope counter:
 *
 * - `opened`: number of object opens encountered
 * - `closed`: number of object closes encountered
 *
 * A "same scope" condition is considered active when:
 *
 * - scanning has just started, OR
 * - `closed + 1 === opened`
 *
 * This ensures property-level decisions only apply within the correct object depth.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLASS CONTEXT TRACKING
 * ---------------------------------------------------------------------
 *
 * The resolver dynamically tracks container types via `object-name` tokens:
 *
 * - `Array`
 * - `Set`
 * - `Map`
 * - fallback: `Record`
 *
 * This affects how separators and values are interpreted.
 *
 * For example:
 * - Arrays/Set: separators do not imply object key/value structure
 * - Objects: key/value separators influence inline decision
 * - Map: always treated as block (currently hard constraint)
 *
 * ---------------------------------------------------------------------
 * 🔷 INLINE SAFETY RULES
 * ---------------------------------------------------------------------
 *
 * A value remains inline only if all inspected tokens are present in the
 * `inlineSafe` set.
 *
 * If a non-inline-safe token is encountered in a relevant position,
 * the resolver switches to `block` mode immediately.
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE AWARENESS
 * ---------------------------------------------------------------------
 *
 * Certain envelope types force block layout regardless of structure:
 *
 * - Error envelopes (`error-start`, `error-data`, etc.)
 * - Deferred envelope bodies (`DEFERRED_BODY_ENVELOPES`)
 *
 * These are treated as inherently multi-line structures.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN PEAKING BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * The resolver uses a custom `_peek()` implementation that skips:
 *
 * - `anchor`
 * - `callback`
 *
 * This ensures layout decisions are based only on structural tokens,
 * not runtime markers or injected metadata.
 *
 * ---------------------------------------------------------------------
 * 🔷 PERFORMANCE CHARACTERISTICS
 * ---------------------------------------------------------------------
 *
 * - Single forward scan per group
 * - Early exit on first block condition
 * - O(n) over token group size
 *
 * ---------------------------------------------------------------------
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
    }

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
     * Rendering context providing token stream and scope metadata.
     *
     * @param inlineSafe
     * Set of token kinds that are considered safe for inline rendering.
     *
     * @since 1.0.0
     */
    constructor(
        context: ZexiRenderingContext,
        inlineSafe: Set<Token['kind']>
    ) {
        this.#_ctx = context;
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
     * - `anchor`   → structural marker only
     * - `callback`  → runtime execution hook
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
                token.kind === 'callback'
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
         * - token.kind === 'property'
         * - token.type === 'property'
         *
         * ### Behavior
         * Inspects the value token of a property:
         *
         * - If value is a function → ignored (no layout impact)
         * - If value is not inline-safe → forces `block`
         *
         * ### Key invariant
         * Objects are only inline if ALL properties have inline-safe values.
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

            if (valueToken.kind === 'function') {
                return;
            }

            if (!this.#_inlineSafe.has(valueToken.kind)) {
                this.#_decision = 'block';
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
                this.#_decision = 'block';
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
            this.#_decision = 'block';
        },

        /**
         * Array resolver.
         *
         * ### Behavior
         * Evaluates array separators to determine whether elements
         * can remain inline.
         *
         * ### Rule
         * If any array element is not inline-safe → layout becomes `block`
         *
         * @since 1.0.0
         */
        array: (token: Token) => {
            if (token.kind !== 'separator') { return; }

            const valueToken = this.#_peek(this.#_data.index - 1);
            if (!valueToken) {
                throw new Error(`Invariant violation: Array value token was expected before the separator token but was not found.`);
            }

            if (!this.#_inlineSafe.has(valueToken.kind)) {
                this.#_decision = 'block';
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
     * Executes layout resolution for a token group.
     *
     * ---------------------------------------------------------------------
     * ALGORITHM OVERVIEW
     * ---------------------------------------------------------------------
     *
     * 1. Start at first token after group start
     * 2. Iterate forward sequentially
     * 3. Track:
     *    - scope depth
     *    - container type
     *    - inline safety of values
     * 4. Escalate to `block` on first violation
     * 5. Stop at matching group-end or early termination
     *
     * ---------------------------------------------------------------------
     * TERMINATION CONDITIONS
     * ---------------------------------------------------------------------
     *
     * Scanning stops when:
     * - matching group-end is reached
     * - scope becomes invalid for inline rendering
     * - nested object depth exceeds allowed inline complexity
     * - a resolver forces block mode
     *
     * ---------------------------------------------------------------------
     * GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Once returned, the decision is final for this group and
     * cannot be recomputed without re-scanning.
     *
     * @param token
     * Root token group to analyze.
     *
     * @returns
     * Final layout decision.
     *
     * @since 1.0.0
     */
    resolve(token: GroupStartToken): LayoutDecision {
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
                            this.#_decision = 'block';
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
                            this.#_decision = 'block';
                            break scanning;
                        }

                        case 'object-name': {
                            this.#_className = item.className;

                            if (DEFERRED_BODY_ENVELOPES.has(this.#_className?.toLowerCase() as EnvelopeKind)) {
                                this.#_decision = 'block';
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
                                this.#_decision = 'block';
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

                                if (valueToken.kind === 'function') {
                                    continue scanning;
                                }

                                if (!this.#_inlineSafe.has(valueToken.kind)) {
                                    this.#_decision = 'block';
                                    break scanning;
                                }
                            }

                            continue scanning;
                        }

                        case 'separator': {
                            if (
                                this.#_className === 'Array' ||
                                this.#_className === 'Set'
                            ) {
                                continue scanning;
                            }

                            const valueToken = this.#_peek(data.index - 1);
                            if (!valueToken) {
                                throw new Error(`Invariant violation: Value token was expected before the separator token but was not found.`);
                            }

                            if (!this.#_inlineSafe.has(valueToken.kind)) {
                                this.#_decision = 'block';
                                break scanning;
                            }

                            continue scanning;
                        }

                        default: {
                            this.#_getResolver()?.(item);
                        }
                    }
                } else {
                    if (item.kind === 'object-name' && !this.#_className) {
                        this.#_decision = 'block';
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
     * Convenience entry point for layout resolution.
     *
     * Creates a fresh resolver instance and immediately executes
     * a layout scan.
     *
     * @param token
     * Root group token.
     *
     * @param config
     * - context: active rendering context
     * - inlineSafe: inline-safe token registry
     *
     * @returns
     * Layout decision for the group.
     *
     * @since 1.0.0
     */
    static resolve(
        token: GroupStartToken,
        config: {
            context: ZexiRenderingContext,
            inlineSafe: Set<Token['kind']>
        }
    ): LayoutDecision {
        return new LayoutResolver(
            config.context,
            config.inlineSafe
        ).resolve(token);
    }
}

export default LayoutResolver;