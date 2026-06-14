import ZexiRenderingContext from "../../shared/context/context";
import { resolveRendererConfig } from "../../shared/helpers";
import { hasOwnProp } from "../../../../../../utils/utils";

import GraphBuilder from "../../../1-graphing/builder";
import PropertyNode from "../../../1-graphing/nodes/assets/property.node";
import RepresentationBuilder from "../../../2-representation/builder";
import Tokenizer from "../../../3-tokenization/tokenizer";
import TokensBuffer from "../../../3-tokenization/container/tokens.buffer";
import TOKENS from "../../../3-tokenization/tokens";
import DataEnvelope from "../../shared/envelope/data.envelope";
import { PropertyToken } from "../../../3-tokenization/tokens/tokenization/property.token";

import ErrorCache, { ERROR_SECTIONS } from "./assets/error.cache";
import ObjectCache from "./assets/object.cache";
import MapEntryFrame from "./assets/map.entry.frame";

import type { JSONConfig } from "./types";
import type { JsonOptions } from "../../../types";
import type { Token } from "../../../3-tokenization/types";

const ERROR_CACHE_KEY = Symbol.for('error_cache');
const OBJECT_CACHE_KEY = Symbol.for('object_cache');

/**
 * JSONRenderer
 * ------------
 *
 * A deterministic token-stream renderer that converts Zexi token graphs
 * into a structured JSON-compatible output.
 *
 * This renderer does NOT operate on raw JavaScript objects directly.
 * Instead, it consumes a pre-tokenized representation produced by the
 * Zexi pipeline:
 *
 *    GraphBuilder → RepresentationBuilder → Tokenizer → TokensBuffer → JSONRenderer
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Token-Driven Rendering**
 *    - Rendering is fully driven by immutable token streams
 *    - No structural introspection of runtime JS objects occurs here
 *    - Ensures deterministic output across all environments
 *
 * 2. **Layout-Aware Serialization**
 *    - Supports compact and formatted layouts via renderer config
 *    - Layout decisions are applied at render-time, not tokenization-time
 *
 * 3. **Behavior-Aware Exclusion Rules**
 *    - Certain JS constructs are intentionally NOT serialized:
 *
 *      ❌ Methods (function-valued properties)
 *      ❌ Getters / setters (accessor side effects risk)
 *      ❌ Symbols (non-serializable identity values)
 *      ❌ Undefined values (omitted from JSON output)
 *
 *    - Reason:
 *      JSONRenderer is strictly a *data representation layer*, not a
 *      behavior-preserving serializer.
 *
 * 4. **Side-Effect Safety Model**
 *    - The renderer must never invoke user code
 *    - Avoids accidental execution of:
 *        - getters
 *        - methods
 *        - computed properties
 *    - Guarantees serialization is PURE and OBSERVATION-ONLY
 *
 * 5. **Anchor-Based Structural Injection**
 *    - Uses `Anchor` tokens to inject envelopes and structured segments
 *    - Enables late-stage composition of nested structures (Map, Set, Error)
 *    - Prevents reliance on fragile index arithmetic
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STATE MODEL
 * ---------------------------------------------------------------------
 *
 * - `#_ctx`
 *   Rendering context holding:
 *   - token cursor state
 *   - scope stack
 *   - writer buffer
 *   - shared renderer data (caches)
 *
 * - `#_ignoredTokens`
 *   Tokens explicitly skipped during rendering traversal
 *
 * - `#_flags`
 *   Controls rendering behavior:
 *   - `ignoreCurrentGroup`: skip entire group subtree
 *   - `skipNextSeparator`: suppress trailing commas
 *   - `skipNextSoftLine`: suppress formatting line breaks
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class JSONRenderer {
    /**
     * Immutable renderer configuration derived from user options
     * and resolved through the JSON rendering preset system.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Controls all formatting decisions during rendering:
     *
     * - layout mode (compact / pretty / strict)
     * - indentation size (spaces)
     * - whitespace normalization rules
     * - line-break strategy
     *
     * This value is computed once at construction time and never mutated.
     *
     * @since 1.0.0
     */
    readonly #_config: JSONConfig;

    /**
     * Core rendering execution context.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE
     * ---------------------------------------------------------------------
     *
     * Acts as the central state container for the renderer pipeline:
     *
     * - token stream traversal state (cursor, peek, next)
     * - scope stack tracking (group nesting)
     * - writer buffer (final output accumulation)
     * - shared cross-renderer metadata storage
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This object is intentionally shared across all render helpers
     * (object / map / set / error / regex) to maintain:
     *
     * - deterministic traversal order
     * - consistent scope resolution
     * - unified output stream
     *
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Mutable rendering control flags used to influence
     * local traversal behavior during token processing.
     *
     * ---------------------------------------------------------------------
     * 🔷 FLAG SEMANTICS
     * ---------------------------------------------------------------------
     *
     * - ignoreCurrentGroup
     *   Skips rendering of the current structural group.
     *   Used when an object/map/set is collapsed or replaced.
     *
     * - skipNextSeparator
     *   Prevents the next separator token from being written.
     *   Used for trailing comma suppression in object-like structures.
     *
     * - skipNextSoftLine
     *   Suppresses the next soft-line token.
     *   Used to avoid orphaned formatting after structural removals.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * These flags are *ephemeral control signals*, not state.
     * They are expected to flip frequently during rendering.
     *
     * @since 1.0.0
     */
    readonly #_flags = {
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false
    }

    /**
     * A transient registry of tokens that must be skipped
     * during the rendering pass.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Allows structural renderers (Map, Set, Object, Error)
     * to inject tokens into the stream without them being processed
     * by the main rendering loop.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Tokens added here are skipped exactly once
     * - After skipping, they are automatically removed
     * - Prevents double-processing during injection-based rendering
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This set is critical for supporting:
     * - anchor-based injection
     * - deferred envelope composition
     * - safe mid-stream token mutation
     *
     * @since 1.0.0
     */
    readonly #_ignoredTokens = new Set<Token>();

    /**
     * Creates a new JSONRenderer instance.
     *
     * The constructor initializes:
     * - Renderer configuration (layout + spacing rules)
     * - Rendering context bound to the provided token stream
     *
     * It also validates and normalizes user-provided formatting options,
     * ensuring safe constraints for indentation.
     *
     * ---------------------------------------------------------------------
     * 🔷 OPTION VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * - `spaces` must be a number in range [0, 8]
     * - Invalid values result in immediate exceptions
     *
     * @param tokens
     * The immutable token stream produced by the Zexi pipeline.
     *
     * @param options
     * Rendering configuration controlling formatting and layout behavior.
     *
     * @throws {TypeError}
     * If `spaces` is not a number.
     *
     * @throws {RangeError}
     * If `spaces` is outside the allowed range.
     *
     * @since 1.0.0
     */
    constructor(
        tokens: readonly Token[],
        options: JsonOptions
    ) {
        this.#_config = resolveRendererConfig('json', options?.mode ?? 'compact');

        if (options) {
            if (hasOwnProp(options, 'spaces')) {
                if (typeof options.spaces !== 'number') {
                    throw new TypeError('Spaces must be a number');
                }

                if (options.spaces < 0) {
                    throw new RangeError('Spaces must be greater than or equal to 0');
                }

                if (options.spaces > 8) {
                    throw new RangeError(`Spaces must be less than or equal to 8, got ${options.spaces}`);
                }

                this.#_config.spaces = options.spaces!;
            }

        }

        this.#_ctx = new ZexiRenderingContext(
            tokens,
            { spaces: this.#_config.spaces }
        );
    }

    /**
     * Internal helper collection used during rendering traversal.
     *
     * These helpers provide:
     * - Token visibility filtering
     * - Controlled skipping of token groups
     * - Delegation into structural renderers (Map / Set / Object)
     *
     * @since 1.0.0
     */
    readonly #_helpers = {
        /**
         * Determines whether a token should be included in JSON output.
         *
         * ---------------------------------------------------------------------
         * 🔷 VISIBILITY RULES
         * ---------------------------------------------------------------------
         *
         * A token is considered invisible if:
         *
         * - It is a `symbol`
         * - It is `undefined`
         *
         * All other tokens are considered renderable.
         *
         * @param token
         * Token to evaluate.
         *
         * @returns
         * `true` if token should be rendered, otherwise `false`.
         *
         * @since 1.0.0
         */
        isVisibleToken: (token: Token): boolean => {
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
        },

        /**
         * Marks the current token group as ignored for rendering.
         *
         * This prevents further processing of the group in the rendering loop,
         * effectively skipping its entire subtree.
         *
         * @since 1.0.0
         */
        ignoreCurrentGroup: () => {
            this.#_flags.ignoreCurrentGroup = true;
        },

        skipNext: {
            /**
             * Advances the token cursor by a fixed number of steps.
             *
             * Used primarily to bypass structural tokens that are already
             * handled by higher-level renderers (e.g., object/map/set wrappers).
             *
             * @param count
             * Number of tokens to skip.
             *
             * @since 1.0.0
             */
            tokens: (count: number) => {
                let skipped = 0;
                while (
                    this.#_ctx.tokens.hasNext() &&
                    skipped < count
                ) {
                    this.#_ctx.tokens.next();
                    skipped++;
                }
            }
        },

        render: {
            /**
             * Renders a plain object literal from the token stream.
             *
             * ---------------------------------------------------------------------
             * 🔷 RESPONSIBILITIES
             * ---------------------------------------------------------------------
             *
             * - Detects visible properties
             * - Filters out non-serializable properties:
             *     - methods
             *     - getters/setters
             *     - symbols
             *     - undefined values
             *
             * - Tracks ignored properties for structural optimization
             * - Determines whether object should render as `{}` or full structure
             *
             * ---------------------------------------------------------------------
             * 🔷 TRAILING BEHAVIOR
             * ---------------------------------------------------------------------
             *
             * - If all properties are ignored, the object is collapsed into `{}`.
             * - If only trailing properties are ignored, the final separator is suppressed.
             *
             * @since 1.0.0
             */
            objectLiteral: () => {
                const ignoredProps = new Set<PropertyToken>();
                const cache = new ObjectCache(ignoredProps);

                // Store the cache in the context
                this.#_ctx.data.set(OBJECT_CACHE_KEY, cache);

                let index = 0;
                let item = this.#_ctx.tokens.peek(++index);
                const scopes = { opened: 0, closed: 0 }

                const props = new Set<PropertyToken>();

                do {
                    try {
                        if (!item) { break; }
                        if (item.kind === 'object-close') {
                            scopes.closed++;
                            if (scopes.opened === scopes.closed) {
                                break;
                            }

                            continue;
                        }

                        if (item.kind === 'object-open') {
                            scopes.opened++;
                            continue;
                        }

                        // Checking if we're in the correct scope
                        if (scopes.closed + 1 !== scopes.opened) { continue; }

                        if (
                            item.kind === 'property' && // The token kind is a property
                            item.type === 'property'    // The token type is a property, not a method, getter, etc.
                        ) {
                            props.add(item);

                            const valueToken = this.#_ctx.tokens.peek(index + 3);

                            const isVisible = valueToken && this.#_helpers.isVisibleToken(valueToken);
                            if (!isVisible) {
                                ignoredProps.add(item);
                            }
                        }
                    } finally {
                        index++;
                        item = this.#_ctx.tokens.peek(index);
                    }
                } while (item);

                if (props.size === 0) {
                    return;
                }

                if (props.size === ignoredProps.size) {
                    this.#_helpers.ignoreCurrentGroup();
                    this.#_ctx.writer.write('{}');
                }

                // Detect if the last property is ignored
                const allProps = Array.from(props);
                const ignored = Array.from(ignoredProps);

                const lastProp = allProps[allProps.length - 1];
                const lastIgnoredProp = ignored[ignored.length - 1];

                if (lastProp === lastIgnoredProp) {
                    // Mark the last visible property to ignore its separator
                    const visibleProps = allProps.filter(prop => !ignored.includes(prop));
                    const lastVisibleProp = visibleProps[visibleProps.length - 1];
                    cache.suppressTrailingOf(lastVisibleProp);
                }
            },

            /**
             * Renders a Set structure into a JSON-compatible envelope.
             *
             * ---------------------------------------------------------------------
             * 🔷 SERIALIZATION FORMAT
             * ---------------------------------------------------------------------
             *
             * Sets are serialized as:
             *
             * {
             *   "$codec": "zexi@1.0",
             *   "$kind": "set",
             *   "$payload": {
             *     "size": number,
             *     "values": [...]
             *   }
             * }
             *
             * ---------------------------------------------------------------------
             * 🔷 IMPLEMENTATION DETAILS
             * ---------------------------------------------------------------------
             *
             * - Uses token skipping to bypass structural wrappers
             * - Injects envelope boundaries using anchor tokens
             * - Computes size by counting separator tokens
             * - Defers payload injection until token resolution phase
             *
             * @since 1.0.0
             */
            set: () => {
                const initialCursor = this.#_ctx.tokens.cursor;

                // Skipping set tokens
                let skipped = 0;
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `object-open`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `soft-line`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `indent-start`

                const envelopeStartAnchor = new TOKENS.Anchor('set:envelope-start');
                const dataEndAnchor = new TOKENS.Anchor('set:data-end');
                this.#_ctx.tokens.inject(envelopeStartAnchor, { at: initialCursor + skipped + 1 });

                const size = (() => {
                    let separators = 0;
                    let scanned = skipped; // The skipped tokens

                    let item = this.#_ctx.tokens.peek(++scanned);
                    const scopes = { opened: 1, closed: 0 }

                    do {
                        try {
                            if (!item) { break; }
                            if (item.kind === 'object-close') {
                                scopes.closed++;
                                if (scopes.opened === scopes.closed) {
                                    const closeIndex = initialCursor + scanned;
                                    this.#_ctx.tokens.inject(dataEndAnchor, {
                                        // The index of the closing token - 2 tokens (`soft-line` and `indent-end`)
                                        at: closeIndex - 2
                                    });
                                    break;
                                }

                                continue;
                            }

                            if (item.kind === 'object-open') {
                                scopes.opened++;
                                continue;
                            }

                            // Checking if we're in the correct scope
                            if (scopes.closed + 1 !== scopes.opened) { continue; }

                            if (item.kind === 'separator') {
                                separators++;
                            }
                        } finally {
                            scanned++;
                            item = this.#_ctx.tokens.peek(scanned);
                        }
                    } while (item);

                    return separators + 1;
                })();

                const envelop = new DataEnvelope('set', { size, values: [] });
                const result = envelop.tokenize(this.#_tokenize);

                // Add the envelope data to the stream
                this.#_ctx.tokens.inject(result.tokens.start, { at: envelopeStartAnchor });

                this.#_ctx.tokens.inject([
                    ...result.tokens.trailing,
                    new TOKENS.Callback(() => {
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(1)!); // Ignoring `indent-end`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(2)!); // Ignoring `soft-line`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(3)!); // Ignoring `object-close`
                    })
                ], { at: dataEndAnchor });
            },

            /**
             * Renders a Map structure into a JSON-compatible envelope.
             *
             * ---------------------------------------------------------------------
             * 🔷 SERIALIZATION FORMAT
             * ---------------------------------------------------------------------
             *
             * {
             *   "$codec": "zexi@1.0",
             *   "$kind": "map",
             *   "$payload": {
             *     "entries": [
             *       { "key": ..., "value": ... }
             *     ],
             *     "size": number
             *   }
             * }
             *
             * ---------------------------------------------------------------------
             * 🔷 ENTRY MODEL
             * ---------------------------------------------------------------------
             *
             * - Each Map entry is processed through a MapEntryFrame
             * - Entry frames ensure correct key/value anchoring
             * - Frames are only committed when fully closed (group-balanced)
             *
             * ---------------------------------------------------------------------
             * 🔷 DESIGN CONSTRAINTS
             * ---------------------------------------------------------------------
             *
             * - Entries MUST NOT be emitted before group closure
             * - Frames enforce structural correctness via group counters
             * - Anchors are used instead of index arithmetic for safety
             *
             * @since 1.0.0
             */
            map: () => {
                const initialCursor = this.#_ctx.tokens.cursor;

                // Skipping set tokens
                let skipped = 0;
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `object-open`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `soft-line`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `indent-start`

                const envelopeStartAnchor = new TOKENS.Anchor('map:envelope-start');
                const dataEndAnchor = new TOKENS.Anchor('map:data-end');
                this.#_ctx.tokens.inject(envelopeStartAnchor, { at: initialCursor + skipped + 1 });

                const metadata = (() => {
                    let separators = 0;
                    let scanned = skipped; // The skipped tokens

                    let item = this.#_ctx.tokens.peek(++scanned);
                    const objects = { opened: 1, closed: 0 }
                    const groups = { opened: 0, closed: 0 }

                    const sameObject = () => objects.closed + 1 === objects.opened;

                    let entry: MapEntryFrame | undefined;
                    const entries: (readonly Token[])[] = [];

                    scanning: do {
                        try {
                            if (!item) { break; }
                            this.#_ignoredTokens.add(item);

                            if (item.kind === 'object-close') {
                                objects.closed++;

                                // Inject the data anchor
                                if (objects.opened === objects.closed) {
                                    const closeIndex = initialCursor + scanned;

                                    this.#_ctx.tokens.inject(dataEndAnchor, {
                                        // The index of the closing token - 2 tokens (`soft-line` and `indent-end`)
                                        at: closeIndex - 2
                                    });

                                    break;
                                }

                                entry!.add(item);

                                continue;
                            } else if (item.kind === 'object-open') {
                                objects.opened++;

                                entry!.add(item);

                                continue;
                            }

                            // Checking if we're in the correct scope
                            if (!sameObject()) {
                                entry!.add(item);
                                continue;
                            }

                            // We're in the same object
                            switch (item.kind) {
                                case 'group-start': {
                                    groups.opened++;

                                    if (groups.closed + 1 === groups.opened) {
                                        entry = new MapEntryFrame(this.#_tokenize);
                                    }

                                    continue scanning;
                                }

                                case 'group-end': {
                                    groups.closed++;

                                    if (groups.opened === groups.closed) {
                                        if (!entry) {
                                            throw new Error('Invariant violation: Group end without group start.');
                                        }

                                        entry.apply();

                                        if (!entry.isComplete) {
                                            throw new Error('Invariant violation: attempting to close an entry before streaming its "end" tokens.')
                                        }

                                        entries.push(entry.getTokens());
                                        entry = undefined;
                                    }

                                    continue scanning;
                                }

                                case 'key-value-separator': {
                                    entry?.apply();

                                    continue scanning;
                                }

                                case 'separator': {
                                    separators++;
                                    continue scanning;
                                }
                            }

                            if (entry && item.kind === 'primitive') {
                                entry.add(item);
                            }
                        } finally {
                            scanned++;
                            item = this.#_ctx.tokens.peek(scanned);
                        }
                    } while (item);

                    const mapDataTokens: Token[] = [];
                    for (let i = 0; i < entries.length; i++) {
                        const entryTokens = entries[i];
                        const hasMore = i < entries.length - 1;

                        mapDataTokens.push(new TOKENS.Anchor(`entry-${i}`));
                        mapDataTokens.push(...entryTokens);

                        if (hasMore) {
                            // The group-end token of the entry object
                            const groupEnd = mapDataTokens.pop()! as InstanceType<typeof TOKENS.GroupEnd>;
                            console.assert(groupEnd.kind === 'group-end'), `Invariant violation: Expected 'group-end' token, but got '${groupEnd.kind}' instead.`;

                            mapDataTokens.push(
                                new TOKENS.Separator,
                                new TOKENS.SoftLine,
                                groupEnd
                            )
                        }
                    }

                    return {
                        size: separators + 1,
                        entriesTokens: mapDataTokens,
                    }
                })();

                const envelop = new DataEnvelope('map', { size: metadata.size, entries: [] });
                const result = envelop.tokenize(this.#_tokenize);

                // Add the envelope data to the stream
                this.#_ctx.tokens.inject(result.tokens.start, { at: envelopeStartAnchor });

                // this.#_helpers.skipNext.tokens(metadata.skipCount);

                this.#_ctx.tokens.inject([
                    ...metadata.entriesTokens,
                    ...result.tokens.trailing,
                    new TOKENS.Callback(() => {
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(1)!); // Ignoring `indent-end`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(2)!); // Ignoring `soft-line`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(3)!); // Ignoring `object-close`
                    })
                ], { at: dataEndAnchor });
            }
        }
    }

    /**
     * Converts a runtime value into a deterministic token stream.
     *
     * This is the ONLY entry point into the Graph → Representation → Token pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 PIPELINE STEPS
     * ---------------------------------------------------------------------
     *
     * 1. GraphBuilder builds structural graph
     * 2. RepresentationBuilder converts graph into intermediate model
     * 3. Tokenizer produces raw token stream
     * 4. TokensBuffer materializes final immutable array
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This function enforces canonical serialization:
     * - cycles are always thrown (strict mode)
     * - output is deterministic
     *
     * @param value
     * Arbitrary JS value to serialize.
     *
     * @returns
     * Immutable token stream representing the value.
     *
     * @since 1.0.0
     */
    #_tokenize(value: unknown): readonly Token[] {
        const graph = GraphBuilder.build(value, { cycles: 'throw', canonical: true });
        const rep = RepresentationBuilder.build(graph);
        const buffer = Tokenizer.tokenize(rep);
        return TokensBuffer.toArray(buffer);
    }

    /**
     * Executes the full token rendering pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * - Iterates sequentially through token stream
     * - Maintains scope stack for nested structures
     * - Applies layout rules (spaces, line breaks)
     * - Delegates structured types to specialized renderers:
     *     - object
     *     - map
     *     - set
     *     - error
     *     - regex
     *     - function envelope
     *
     * ---------------------------------------------------------------------
     * 🔷 SIDE-EFFECT GUARANTEE
     * ---------------------------------------------------------------------
     *
     * - Does NOT mutate input tokens
     * - Only mutates internal ignored-token tracking set
     * - Uses controlled injection via anchors
     *
     * ---------------------------------------------------------------------
     * 🔷 OUTPUT GUARANTEE
     * ---------------------------------------------------------------------
     *
     * - Must end at root scope
     * - Otherwise rendering is considered structurally invalid
     *
     * @returns
     * Final serialized JSON string output.
     *
     * @throws {Error}
     * If rendering ends outside root scope.
     *
     * @since 1.0.0
     */
    #_render() {
        const tokens = this.#_ctx.tokens;

        while (tokens.hasNext()) {
            const token = tokens.next()!;
            const ignore = this.#_ignoredTokens.has(token);

            // console.debug(`[${logNow ? 'Set_' : ''}Token:${token.kind}]${ignore ? ' (Ignored)' : ''}`);

            if (ignore) {
                this.#_ignoredTokens.delete(token);
                continue;
            }

            if (this.#_flags.ignoreCurrentGroup) {
                const currentGroup = this.#_ctx.data.get<symbol>('currentGroup');

                if (token.kind === 'group-end' && token.groupId === currentGroup) {
                    this.#_flags.ignoreCurrentGroup = false;
                    this.#_ctx.scopes.commit();
                }

                continue;
            }

            switch (token.kind) {
                case 'group-start': {
                    this.#_ctx.scopes.begin({ id: token.id });
                    this.#_ctx.data.set('currentGroup', token.id);
                    continue;
                }

                case 'group-end': {
                    this.#_ctx.scopes.commit();
                    continue;
                }

                case 'anchor':
                case 'ansi':
                case 'reference-start':
                case 'reference-end': continue;

                case 'date': {
                    this.#_ctx.writer.write(`"${token.value.toISOString()}"`);
                    continue;
                }

                case 'function': {
                    const funcName = token.value.name ?? 'anonymous';
                    const envelope = new DataEnvelope('function', { name: funcName });

                    const result = envelope.tokenize(this.#_tokenize);
                    this.#_ctx.tokens.inject(result.tokens);
                    continue;
                }

                case 'indent-start': {
                    this.#_ctx.depth.increase();
                    continue;
                }

                case 'indent-end': {
                    this.#_ctx.depth.decrease()
                    continue;
                }

                case 'primitive': {
                    primitive: switch (token.type) {
                        case 'boolean':
                        case 'null':
                        case 'number':
                        case 'undefined':
                        case 'bigint': {
                            this.#_ctx.writer.write(String(token.value));
                            break primitive;
                        }

                        case 'string': {
                            this.#_ctx.writer.write(JSON.stringify(token.value));
                            break primitive;
                        }

                        case 'symbol': {
                            break primitive;
                        }
                    }
                    continue;
                }

                case 'separator': {
                    if (this.#_flags.skipNextSeparator) {
                        this.#_flags.skipNextSeparator = false;
                        continue;
                    }

                    this.#_ctx.writer.write(token.value);
                    continue;
                }

                case 'hard-line': {
                    this.#_ctx.writer.newLine();
                    continue;
                }

                case 'soft-line': {
                    if (this.#_flags.skipNextSoftLine) {
                        this.#_flags.skipNextSoftLine = false;
                        continue;
                    }

                    if (
                        this.#_config.layout.lineBreaks === 'soft' ||
                        this.#_config.layout.lineBreaks === 'strict'
                    ) {
                        this.#_ctx.writer.newLine();
                    }
                    continue;
                }

                case 'hard-space': {
                    this.#_ctx.writer.write(' ');
                    continue;
                }

                case 'soft-space': {
                    if (
                        this.#_config.layout.spaces === 'preserve' ||
                        this.#_config.layout.spaces === 'normalize'
                    ) {
                        this.#_ctx.writer.write(' ');
                    }
                    continue;
                }

                case 'key-value-separator': {
                    this.#_ctx.writer.write(token.value);
                    continue;
                }

                case 'soft-wrap': {
                    if (this.#_config.layout.lineBreaks === 'soft') {
                        this.#_ctx.writer.newLine();
                    }
                    continue;
                }

                case 'regex': {
                    const regex = token.value;
                    const envelope = new DataEnvelope('regex', {
                        pattern: regex.source,
                        flags: regex.flags
                    });

                    const result = envelope.tokenize(this.#_tokenize);
                    this.#_ctx.tokens.inject(result.tokens);
                    continue;
                }

                case 'property': {
                    if (token.type !== 'property') {
                        this.#_helpers.ignoreCurrentGroup();
                        continue;
                    }

                    const objectCache = this.#_ctx.data.get<ObjectCache>(OBJECT_CACHE_KEY);
                    if (!objectCache) {
                        throw new Error(`Invariant violation: Attempting to render a property without an object cache`);
                    }

                    if (objectCache.shouldRemoveTrailing(token)) {
                        const anchor = new TOKENS.Anchor('remove-trailing');
                        const cb = new TOKENS.Callback(() => {
                            this.#_flags.skipNextSeparator = true;
                            this.#_flags.skipNextSoftLine = true;
                        });

                        // Find the index of the closing group token
                        // and insert the callback 2 tokens before that index

                        const injectAnchor = () => {
                            const cursor = this.#_ctx.tokens.cursor;
                            const groups = { opened: 1, closed: 0 };
                            let scanned = 0;

                            let item = this.#_ctx.tokens.peek(++scanned);

                            scanning: do {
                                try {
                                    if (!item) { break; }

                                    switch (item.kind) {
                                        case 'group-start': {
                                            groups.opened++;
                                            continue scanning;
                                        }

                                        case 'group-end': {
                                            groups.closed++;
                                            if (groups.opened === groups.closed) {
                                                const closingIndex = cursor + scanned;

                                                tokens.inject(anchor, { at: closingIndex - 2 });
                                                break scanning;
                                            }

                                            continue scanning;
                                        }
                                    }
                                } finally {
                                    scanned++;
                                    item = this.#_ctx.tokens.peek(scanned);
                                }
                            } while (item);
                        }

                        injectAnchor();
                        tokens.inject(cb, { at: anchor });
                    }

                    if (objectCache.isIgnored(token)) {
                        this.#_helpers.ignoreCurrentGroup();
                        continue;
                    }

                    this.#_ctx.writer.write(JSON.stringify(token.value));
                    continue;
                }

                case 'object-name': {
                    if (token.className && token.className !== 'Array') {

                        switch (token.className) {
                            case 'Set': {
                                this.#_helpers.render.set();
                                continue;
                            }

                            case 'Map': {
                                this.#_helpers.render.map();
                                continue;
                            }
                        }

                        this.#_helpers.ignoreCurrentGroup();
                        this.#_ctx.writer.write('{}');
                    }

                    // handle objects (literals and classes)
                    if (!token.className) {
                        this.#_helpers.render.objectLiteral();
                    }

                    continue;
                }

                case 'object-open':
                case 'object-close': {
                    this.#_ctx.writer.write(token.token)
                    continue;
                }

                case 'error-start': {
                    this.#_ctx.scopes.begin({ id: token.id });
                    const envelop = new DataEnvelope('error', {});
                    const result = envelop.tokenize(this.#_tokenize);

                    this.#_ctx.tokens.inject([
                        ...result.tokens.start,
                        new TOKENS.IndentStart
                    ]);

                    // Set the scope type
                    this.#_ctx.data.set('type', 'error');
                    this.#_ctx.data.set(ERROR_CACHE_KEY, new ErrorCache(token, [...result.tokens.trailing]));
                    continue;
                }

                case 'error-data': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const nameStart = new TOKENS.GroupStart;
                    error.track('name', nameStart.id);

                    const errData: Token[] = [];

                    errData.push(
                        nameStart,
                        PropertyToken.from(PropertyNode.create('name', 'property')),
                        new TOKENS.KeyValueSeparator,
                        new TOKENS.SoftSpace,
                        new TOKENS.Primitive('string', token.name)
                    );

                    if (token.message !== undefined) {
                        if (!error.isConsumed('name')) {
                            errData.push(
                                new TOKENS.Separator,
                                new TOKENS.SoftLine,
                                new TOKENS.GroupEnd(error.consume('name')!),
                            )
                        }

                        const msgStart = new TOKENS.GroupStart;
                        error.track('message', msgStart.id);

                        errData.push(
                            msgStart,
                            PropertyToken.from(PropertyNode.create('message', 'property')),
                            new TOKENS.KeyValueSeparator,
                            new TOKENS.SoftSpace,
                            new TOKENS.Primitive('string', token.message),
                        );
                    }

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'error-cause-start': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [];
                    for (const segmentName of ERROR_SECTIONS.filter(s => s === 'name' || s === 'message')) {
                        if (!error.isRegistered(segmentName) || error.isConsumed(segmentName)) {
                            continue;
                        }

                        errData.push(
                            new TOKENS.Separator,
                            new TOKENS.SoftLine,
                            new TOKENS.GroupEnd(error.consume(segmentName)!),
                        );
                    }

                    const causeStart = new TOKENS.GroupStart;
                    error.track('cause', causeStart.id);

                    errData.push(
                        causeStart,
                        PropertyToken.from(PropertyNode.create('cause', 'property')),
                        new TOKENS.KeyValueSeparator,
                        new TOKENS.SoftSpace,
                    );

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'error-cause-end': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [
                        new TOKENS.Separator,
                        new TOKENS.SoftLine,
                        new TOKENS.GroupEnd(error.consume('cause')!)
                    ];

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'stack-trace': {
                    if (token.ownership === 'error') {
                        if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                            throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                        }

                        const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                        if (error.errorId !== token.errorId) {
                            throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                        }

                        const errData: Token[] = [];
                        for (const segmentName of ERROR_SECTIONS.filter(s => s === 'name' || s === 'message')) {
                            if (!error.isRegistered(segmentName) || error.isConsumed(segmentName)) {
                                continue;
                            }

                            errData.push(
                                new TOKENS.Separator,
                                new TOKENS.SoftLine,
                                new TOKENS.GroupEnd(error.consume(segmentName)!),
                            );
                        }

                        const traceStart = new TOKENS.GroupStart;
                        error.track('stack', traceStart.id);

                        errData.push(
                            traceStart,
                            PropertyToken.from(PropertyNode.create('stack', 'property')),
                            new TOKENS.KeyValueSeparator,
                            new TOKENS.SoftSpace,
                            ...this.#_tokenize(token.lines)
                        );

                        this.#_ctx.tokens.inject(errData);
                    }

                    continue;
                }

                case 'error-end': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [];
                    const segments = (ERROR_SECTIONS).map(sName => {
                        if (!error.isRegistered(sName) || error.isConsumed(sName)) {
                            return undefined
                        }

                        return { name: sName }
                    }).filter(s => s !== undefined);

                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i];
                        const hasMore = i < segments.length - 1;

                        if (hasMore) {
                            errData.push(new TOKENS.Separator);
                        }

                        errData.push(
                            new TOKENS.SoftLine,
                            new TOKENS.GroupEnd(error.consume(segment!.name)!),
                        );
                    }

                    errData.push(
                        new TOKENS.IndentEnd,
                        ...error.closeTokens,
                        new TOKENS.Callback(() => this.#_ctx.scopes.commit())
                    );

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'callback': {
                    token.run();
                    continue;
                }

                default: {
                    throw new Error(`Invariant violation: Unknown token type: ${(token as any).kind}`);
                }
            }
        }

        if (!this.#_ctx.scopes.isRoot) {
            throw new Error('Invariant violation: Rendering ended at non-root scope. Rendering must end at the root scope.');
        }

        return this.#_ctx.writer.toString();
    }

    /**
     * Static entry point for JSON rendering.
     *
     * Creates a new renderer instance and executes the full rendering pipeline.
     *
     * This is the primary API surface for consumers.
     *
     * @param tokens
     * Pre-tokenized Zexi representation.
     *
     * @param options
     * Rendering configuration (layout, spacing, etc).
     *
     * @returns
     * Fully serialized JSON string.
     *
     * @since 1.0.0
     */
    static render(tokens: readonly Token[], options: JsonOptions) {
        return new JSONRenderer(tokens, options).#_render();
    }
}

export default JSONRenderer;