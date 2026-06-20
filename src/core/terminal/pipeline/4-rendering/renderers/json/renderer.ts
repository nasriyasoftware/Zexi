import ZexiRenderingContext from "../../shared/context/context";
import { resolveRendererConfig } from "../../shared/helpers";
import { hasOwnProp } from "../../../../../../utils/utils";

import keys from "./helpers/keys";
import TOKENS from "../../../3-tokenization/tokens";
import DataEnvelope from "../../shared/envelope/data.envelope";
import JSONTokenizer from "./helpers/tokenizer";
import JSONHelpers from "./helpers/helpers";

import ErrorCache from "./assets/error.cache";
import ObjectCache from "./assets/object.cache";

import type { JSONConfig, JSONRendererFlags } from "./types";
import type { JsonOptions } from "../../../types";
import type { Token } from "../../../3-tokenization/types";

/**
 * JSONRenderer
 * ------------
 *
 * A deterministic, token-driven execution engine that converts a Zexi
 * token stream into a final JSON string representation.
 *
 * This renderer operates strictly on the output of the Zexi pipeline:
 *
 *    GraphBuilder
 *        ↓
 *    RepresentationBuilder
 *        ↓
 *    Tokenizer
 *        ↓
 *    TokensBuffer
 *        ↓
 *    JSONRenderer
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * The JSONRenderer is NOT a serializer in the traditional sense.
 *
 * It is a **token execution engine** that:
 *
 * - consumes immutable token streams
 * - executes structural rendering logic
 * - applies layout decisions (inline vs block)
 * - coordinates multi-pass transformations (object / set / map / error)
 * - produces a final string output
 *
 * It explicitly avoids:
 *
 * ❌ direct object traversal
 * ❌ runtime reflection-based serialization
 * ❌ mutation of input values
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * The renderer is the *final stage of a multi-phase pipeline*, and is
 * responsible for:
 *
 * - interpreting structural tokens
 * - delegating specialized structures to helpers/passes
 * - resolving layout at render-time (not build-time)
 * - enforcing deterministic output rules
 *
 * It is tightly coupled with:
 *
 * - JSONHelpers (pass orchestration + utilities)
 * - LayoutResolver (inline/block decision system)
 * - ErrorCache / ObjectCache (cross-pass state coordination)
 * - DataEnvelope (structured injection system)
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLES
 * ---------------------------------------------------------------------
 *
 * 1. **Deterministic Execution**
 *    - Same token stream ALWAYS produces identical output
 *
 * 2. **Single-Pass Traversal with Controlled Rewrites**
 *    - Token stream is consumed linearly
 *    - Structural injections occur via anchors (not mutation hacks)
 *
 * 3. **Multi-Pass Structural Expansion**
 *    - Complex types are expanded via envelopes:
 *        - Map
 *        - Set
 *        - Error
 *        - RegExp
 *        - Function metadata
 *
 * 4. **Layout Decoupling**
 *    - Layout decisions are made at render-time
 *    - Controlled by LayoutResolver + context inheritance
 *
 * 5. **Strict Scope Integrity**
 *    - Every group-start MUST eventually resolve to group-end
 *    - Rendering failure = structural inconsistency
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STATE MODEL
 * ---------------------------------------------------------------------
 *
 * ### #_ctx (ZexiRenderingContext)
 * Central execution context containing:
 *
 * - token cursor
 * - scope stack (group tracking)
 * - writer buffer
 * - shared renderer data (caches, metadata)
 *
 * ### #_ignoredTokens
 * A transient skip-set used to avoid double processing of injected tokens.
 *
 * ### #_flags (JSONRendererFlags)
 * Ephemeral execution controls:
 *
 * - ignoreCurrentGroup
 * - skipNextSeparator
 * - skipNextSoftLine
 * - forceNextGroupAsBlock
 *
 * ### #_helpers
 * JSONHelpers instance providing:
 *
 * - layout resolution
 * - pass execution (object/map/set)
 * - abort control
 * - structural utilities
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Rendering is performed via a **token execution loop**, where each token
 * is interpreted according to its kind.
 *
 * The renderer may:
 *
 * - write directly to output buffer
 * - inject new tokens into stream (envelopes)
 * - delegate to structural passes
 * - modify layout state
 * - skip tokens via ignored set
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL PASSES
 * ---------------------------------------------------------------------
 *
 * Some token groups are not rendered directly but delegated:
 *
 * - objectLiteral → objectPass (via JSONHelpers)
 * - Set → setPass (envelope + size computation)
 * - Map → mapPass (entry framing + envelope construction)
 * - Error → ErrorCache + envelope reconstruction
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR MODEL
 * ---------------------------------------------------------------------
 *
 * Errors are treated as **structured envelopes**, not plain strings.
 *
 * - Error data is accumulated in ErrorCache
 * - cause/stack/name/message are resolved separately
 * - final emission happens at `error-end`
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY GUARANTEES
 * ---------------------------------------------------------------------
 *
 * ✔ No mutation of input values
 * ✔ No execution of user-provided code (except explicit callback tokens)
 * ✔ Deterministic output
 * ✔ Strict scope validation
 * ✔ Controlled token injection only via anchors
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class JSONRenderer {
    /**
     * Rendering mode selector.
     *
     * ---------------------------------------------------------------------
     * 🔷 MODES
     * ---------------------------------------------------------------------
     *
     * - `compact`
     *   Produces minimal output with reduced whitespace and inline formatting.
     *
     * - `pretty`
     *   Produces human-readable output with layout-aware spacing and line breaks.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This value is immutable after construction and determines:
     *
     * - layout resolution strategy
     * - whitespace normalization behavior
     * - inline vs block rendering decisions
     *
     * @since 1.0.0
     */
    readonly #_mode: 'compact' | 'pretty' = 'compact';

    /**
     * Normalized renderer configuration.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY
     * ---------------------------------------------------------------------
     *
     * Derived from:
     * - user-provided options
     * - renderer preset system (`resolveRendererConfig`)
     *
     * Controls formatting rules applied during rendering:
     *
     * - indentation size (spaces)
     * - line break strategy (soft / strict / preserve)
     * - whitespace normalization mode
     * - layout constraints
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * This object is computed once at construction time and is never mutated
     * during rendering execution.
     *
     * @since 1.0.0
     */
    readonly #_config: JSONConfig;

    /**
     * Shared rendering execution context.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE
     * ---------------------------------------------------------------------
     *
     * Central state container for the entire rendering pipeline.
     *
     * Provides:
     *
     * - token stream traversal (peek / next / inject)
     * - scope tracking (group nesting, commits)
     * - writer buffer (final output assembly)
     * - cross-pass metadata storage (`ctx.data`)
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN PRINCIPLE
     * ---------------------------------------------------------------------
     *
     * The renderer is strictly token-driven; this context is the ONLY
     * mutable runtime state used during rendering.
     *
     * It is shared across:
     *
     * - JSONHelpers
     * - object/map/set/error passes
     * - layout resolution system
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY MODEL
     * ---------------------------------------------------------------------
     *
     * - No direct mutation of token values
     * - Only controlled structural mutation via `inject`
     * - Scope integrity enforced via `scopes`
     *
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Transient skip registry for token suppression.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Tracks tokens that must be ignored exactly once during traversal.
     *
     * Used for:
     *
     * - anchor-based injection cleanup
     * - structural pass transformations
     * - preventing double-processing of injected tokens
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR MODEL
     * ---------------------------------------------------------------------
     *
     * - Tokens are added before injection or transformation
     * - When encountered in the main loop, they are skipped and removed
     * - Guarantees single-pass suppression semantics
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This mechanism is critical for safe mid-stream mutation of the
     * token graph without invalidating traversal order.
     *
     * @since 1.0.0
     */
    readonly #_ignoredTokens = new Set<Token>();

    /**
     * Shared helper utility layer for rendering operations.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY
     * ---------------------------------------------------------------------
     *
     * Provides high-level rendering utilities including:
     *
     * - visibility rules (`isVisibleToken`)
     * - layout resolution (`getLayout`)
     * - structural transforms (object / map / set passes)
     * - rendering control actions (abort, ignore group)
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This abstraction exists to:
     *
     * - isolate structural rendering logic from main loop
     * - reuse pass logic across object/map/set rendering
     * - reduce complexity in `#_render`
     *
     * @since 1.0.0
     */
    readonly #_helpers: JSONHelpers;

    /**
     * Ephemeral rendering control flags.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Controls short-lived rendering behaviors during traversal.
     *
     * ---------------------------------------------------------------------
     * 🔷 FLAGS
     * ---------------------------------------------------------------------
     *
     * - `ignoreCurrentGroup`
     *   Skips rendering of the current structural group entirely.
     *
     * - `skipNextSeparator`
     *   Suppresses the next separator token (e.g. trailing commas).
     *
     * - `skipNextSoftLine`
     *   Suppresses the next soft-line token (formatting cleanup).
     *
     * - `forceNextGroupAsBlock`
     *   Forces the next detected group to be rendered in block layout.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * These flags are:
     *
     * - temporary (often set and cleared within a single pass)
     * - mutation-heavy by design
     * - NOT part of long-term renderer state
     *
     * @since 1.0.0
     */
    readonly #_flags: JSONRendererFlags = {
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    }

    /**
     * Constructs a new JSONRenderer instance.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION FLOW
     * ---------------------------------------------------------------------
     *
     * 1. Resolve rendering mode (`compact | pretty`)
     * 2. Build normalized configuration via preset system
     * 3. Validate and override spacing rules (if provided)
     * 4. Initialize rendering context
     * 5. Create shared helper layer (`JSONHelpers`)
     *
     * ---------------------------------------------------------------------
     * 🔷 CONFIG VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * - `spaces` must be a number
     * - Must be in range [0, 8]
     * - Invalid values throw immediately
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN GUARANTEE
     * ---------------------------------------------------------------------
     *
     * After construction:
     *
     * - configuration is immutable
     * - context is fully initialized
     * - helper layer is bound to shared state
     *
     * @param tokens
     * Immutable token stream from Zexi pipeline.
     *
     * @param options
     * Rendering configuration (layout, spacing, maxWidth).
     *
     * @throws {TypeError}
     * If `spaces` is not a number.
     *
     * @throws {RangeError}
     * If `spaces` is outside [0, 8].
     *
     * @since 1.0.0
     */
    constructor(
        tokens: readonly Token[],
        options: JsonOptions
    ) {
        this.#_mode = options?.mode ?? 'compact';
        this.#_config = resolveRendererConfig('json', this.#_mode);

        if (this.#_mode === 'compact' && options) {
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
            {
                spaces: this.#_config.spaces,
                maxWidth: this.#_mode === 'pretty' ? options.maxWidth : undefined
            }
        );

        this.#_helpers = new JSONHelpers({
            ctx: this.#_ctx,
            flags: this.#_flags,
            ignoredTokens: this.#_ignoredTokens,
            mode: this.#_mode
        })
    }

    /**
     * Executes the full token rendering pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * The renderer operates as a single deterministic pass over the token stream:
     *
     * 1. Sequential token traversal
     * 2. Scope tracking (group nesting)
     * 3. Layout resolution (inline vs block)
     * 4. Structural delegation (object / map / set / error)
     * 5. Controlled injection via anchors
     *
     * ---------------------------------------------------------------------
     * 🔷 CORE PRINCIPLES
     * ---------------------------------------------------------------------
     *
     * 1. **Determinism**
     *    - Same input tokens always produce same output
     *
     * 2. **No Token Mutation**
     *    - Input stream is never modified in-place
     *
     * 3. **Injection Safety**
     *    - All structural transformations are anchor-based
     *
     * 4. **Single-Pass Semantics**
     *    - Each token is processed at most once unless re-injected
     *
     * ---------------------------------------------------------------------
     * 🔷 CONTROL FLOW RULES
     * ---------------------------------------------------------------------
     *
     * - `ignoredTokens` take highest priority
     * - `ignoreCurrentGroup` overrides all rendering output
     * - layout resolution can force fallback to block rendering
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURAL DELEGATION
     * ---------------------------------------------------------------------
     *
     * Specialized token types are delegated to:
     *
     * - ObjectPass → object structures
     * - MapPass → Map serialization
     * - SetPass → Set serialization
     * - ErrorCache → error envelopes
     * - DataEnvelope → function/regex/date wrapping
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEES
     * ---------------------------------------------------------------------
     *
     * - Never executes user code (except explicit callback tokens)
     * - Never mutates input token objects
     * - Never writes outside controlled writer buffer
     *
     * ---------------------------------------------------------------------
     * 🔷 FAILURE MODES
     * ---------------------------------------------------------------------
     *
     * Rendering is considered invalid if:
     *
     * - scope stack is not empty at end
     * - unknown token type is encountered
     *
     * @returns
     * Fully serialized JSON string.
     *
     * @throws {Error}
     * If rendering ends outside root scope.
     *
     * @since 1.0.0
     */
    #_render() {
        const tokens = this.#_ctx.tokens;

        rendering: while (tokens.hasNext()) {
            const token = tokens.next()!;

            if (this.#_ignoredTokens.has(token)) {
                this.#_ignoredTokens.delete(token);
                continue rendering;
            }

            if (this.#_flags.ignoreCurrentGroup) {
                const currentGroup = this.#_ctx.data.get<symbol>('currentGroup');

                if (token.kind === 'group-end' && token.groupId === currentGroup) {
                    this.#_flags.ignoreCurrentGroup = false;
                    this.#_ctx.scopes.commit();
                }

                continue rendering;
            }

            switch (token.kind) {
                case 'group-start': {
                    this.#_ctx.scopes.begin({ id: token.id });

                    if (this.#_flags.forceNextGroupAsBlock) {
                        this.#_ctx.data.set(keys.RENDERING_LAYOUT_KEY, 'block', { overwrite: true });

                        this.#_flags.forceNextGroupAsBlock = false;
                    } else {
                        if (!this.#_ctx.data.hasOwn(keys.RENDERING_LAYOUT_KEY)) {
                            const layout = this.#_helpers.createResolver().resolve(token);
                            this.#_ctx.data.set(keys.RENDERING_LAYOUT_KEY, layout);
                        }
                    }

                    this.#_ctx.data.set('currentGroup', token.id);
                    continue rendering;
                }

                case 'group-end': {
                    this.#_ctx.scopes.commit();
                    continue rendering;
                }

                case 'anchor':
                case 'ansi':
                case 'reference-start':
                case 'reference-end': continue rendering;

                case 'date': {
                    const valueToWrite = this.#_ctx.scopes.isRoot
                        ? token.value.toISOString()
                        : `"${token.value.toISOString()}"`;

                    const layout = this.#_helpers.getLayout();
                    if (layout && layout === 'inline') {
                        if (!this.#_ctx.writer.canFitInline(valueToWrite)) {
                            this.#_helpers.abortWriting();
                            continue rendering;
                        }
                    }

                    this.#_ctx.writer.write(valueToWrite);
                    continue rendering;
                }

                case 'function': {
                    const funcName = token.value.name ?? 'anonymous';
                    const envelope = new DataEnvelope('function', { name: funcName });

                    const result = envelope.tokenize(JSONTokenizer);
                    this.#_ctx.tokens.inject(result.tokens);
                    continue rendering;
                }

                case 'indent-start': {
                    this.#_ctx.depth.increase();
                    continue rendering;
                }

                case 'indent-end': {
                    this.#_ctx.depth.decrease()
                    continue rendering;
                }

                case 'primitive': {
                    const contentToWrite = (() => {
                        switch (token.type) {
                            case 'boolean':
                            case 'null':
                            case 'number':
                            case 'undefined':
                            case 'bigint': {
                                return String(token.value);
                            }

                            case 'string': {
                                const valueToWrite = this.#_ctx.scopes.isRoot
                                    ? token.value as string
                                    : JSON.stringify(token.value);

                                return valueToWrite;
                            }

                            case 'symbol': {
                                return (
                                    this.#_ctx.scopes.isRoot
                                        ? (token.value as symbol).toString()
                                        : JSON.stringify(token.value)
                                );
                            }
                        }
                    })();

                    if (!contentToWrite) {
                        continue rendering;
                    }

                    const layout = this.#_helpers.getLayout();
                    if (layout && layout === 'inline') {
                        if (!this.#_ctx.writer.canFitInline(contentToWrite)) {
                            this.#_helpers.abortWriting();
                            continue rendering;
                        }
                    }

                    this.#_ctx.writer.write(contentToWrite);
                    continue rendering;
                }

                case 'separator': {
                    if (this.#_flags.skipNextSeparator) {
                        this.#_flags.skipNextSeparator = false;
                        continue rendering;
                    }

                    this.#_ctx.writer.write(token.value);
                    continue rendering;
                }

                case 'hard-line': {
                    this.#_ctx.writer.newLine();
                    continue rendering;
                }

                case 'soft-line': {
                    if (this.#_flags.skipNextSoftLine) {
                        this.#_flags.skipNextSoftLine = false;
                        continue rendering;
                    }

                    const isArrayElement = this.#_ctx.data.hasInherited(keys.ARRAY_RENDERING_KEY, 2);

                    const layout = this.#_helpers.getLayout({ ofParent: !isArrayElement });
                    if (layout && layout === 'inline') {
                        this.#_ctx.writer.write(' ');
                    } else {
                        if (
                            this.#_config.layout.lineBreaks === 'soft' ||
                            this.#_config.layout.lineBreaks === 'strict'
                        ) {
                            this.#_ctx.writer.newLine();
                        }
                    }

                    continue rendering;
                }

                case 'hard-space': {
                    if (this.#_mode === 'compact') {
                        this.#_ctx.writer.write(' ');
                    }

                    continue rendering;
                }

                case 'soft-space': {
                    if (
                        this.#_config.layout.spaces === 'preserve' ||
                        this.#_config.layout.spaces === 'normalize'
                    ) {
                        this.#_ctx.writer.write(' ');
                    }
                    continue rendering;
                }

                case 'key-value-separator': {
                    this.#_ctx.writer.write(token.value);
                    continue rendering;
                }

                case 'soft-wrap': {
                    if (this.#_config.layout.lineBreaks === 'soft') {
                        this.#_ctx.writer.newLine();
                    }
                    continue rendering;
                }

                case 'regex': {
                    const regex = token.value;
                    const envelope = new DataEnvelope('regex', {
                        pattern: regex.source,
                        flags: regex.flags
                    });

                    const result = envelope.tokenize(JSONTokenizer);
                    this.#_ctx.tokens.inject(result.tokens);
                    continue rendering;
                }

                case 'property': {
                    if (token.type !== 'property') {
                        this.#_helpers.ignoreCurrentGroup();
                        continue rendering;
                    }

                    const objectCache = this.#_ctx.data.get<ObjectCache>(keys.OBJECT_CACHE_KEY);
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
                                    if (!item) { break scanning; }

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
                        continue rendering;
                    }

                    this.#_ctx.writer.write(JSON.stringify(token.value));
                    continue rendering;
                }

                case 'object-name': {
                    const is = {
                        set: token.className === 'Set',
                        map: token.className === 'Map',
                        array: token.className === 'Array',
                        literal: !token.className,
                        get custom(): boolean {
                            return (
                                !this.literal &&
                                !(
                                    this.set ||
                                    this.map ||
                                    this.array
                                )
                            )
                        }
                    }

                    // handle objects (literals)
                    if (is.literal || is.custom) {
                        if (is.literal) {
                            this.#_helpers.transforms.object();
                        } else {
                            this.#_helpers.ignoreCurrentGroup();
                            this.#_ctx.writer.write('{}');
                        }

                        continue rendering;
                    }

                    if (is.array) {
                        this.#_ctx.data.set(keys.ARRAY_RENDERING_KEY, true);
                        continue rendering;
                    }

                    if (is.set || is.map) {
                        if (is.set) {
                            this.#_helpers.transforms.set();
                        } else if (is.map) {
                            this.#_helpers.transforms.map();
                        }

                        continue rendering;
                    }

                    continue rendering;
                }

                case 'object-open':
                case 'object-close': {
                    this.#_ctx.writer.write(token.token)
                    continue rendering;
                }

                case 'error-start': {
                    this.#_ctx.data.set(keys.RENDERING_LAYOUT_KEY, 'block', { overwrite: true });
                    this.#_ctx.scopes.begin({ id: token.id });

                    const envelop = new DataEnvelope('error', {});
                    const result = envelop.tokenize(JSONTokenizer);

                    // Set the scope type
                    this.#_ctx.data.set('type', 'error');
                    this.#_ctx.data.set(keys.ERROR_CACHE_KEY, new ErrorCache(token, result));

                    continue rendering;
                }

                case 'error-data': {
                    if (!this.#_ctx.data.hasResolvable(keys.ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    // Set the error name
                    error.set('name', token.name);

                    if (token.message) {
                        // Set the error message
                        error.set('message', token.message);
                    }

                    continue rendering;
                }

                case 'error-cause-start': {
                    if (!this.#_ctx.data.hasResolvable(keys.ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const causeTokens: Token[] = (() => {
                        const output: Token[] = [];
                        let index = 0;

                        const hasNext = () => {
                            const item = tokens.peek(index + 1);
                            if (!item) { return false }

                            this.#_ignoredTokens.add(item);
                            if (
                                item.kind === 'error-cause-end' &&
                                item.errorId === token.errorId &&
                                item.causeId === token.id
                            ) {
                                return false;
                            }

                            return true;
                        }

                        const next = () => {
                            if (!hasNext()) {
                                return null;
                            }

                            return tokens.peek(++index)!;
                        }

                        while (hasNext()) {
                            output.push(next()!);
                        }

                        return output;
                    })();

                    // Set the error cause
                    error.set('cause', causeTokens);

                    continue rendering;
                }

                case 'error-cause-end': {
                    // Handled in error-cause-start
                    continue rendering;
                }

                case 'stack-trace': {
                    if (token.ownership === 'error') {
                        if (!this.#_ctx.data.hasResolvable(keys.ERROR_CACHE_KEY)) {
                            throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                        }

                        const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE_KEY)!;
                        if (error.errorId !== token.errorId) {
                            throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                        }

                        // Set the error stack trace
                        error.set('stack', token.lines);
                    }

                    continue rendering;
                }

                case 'error-end': {
                    if (!this.#_ctx.data.hasResolvable(keys.ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    // Closing the error scope
                    this.#_ctx.scopes.commit();

                    const generated = error.generateTokens(JSONTokenizer);

                    // Inject error tokens
                    this.#_ctx.tokens.inject(generated);

                    continue rendering;
                }

                case 'callback': {
                    token.run();
                    continue rendering;
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
     * Public JSON rendering entry point.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Provides a simple functional API over the class-based renderer:
     *
     * - constructs renderer instance
     * - executes full rendering pipeline
     * - returns final JSON string
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN NOTE
     * ---------------------------------------------------------------------
     *
     * This is the only intended external entry point for consumers.
     * Direct instantiation of `JSONRenderer` is discouraged unless
     * advanced control is required.
     *
     * @param tokens
     * Pre-tokenized Zexi representation.
     *
     * @param options
     * Rendering configuration (layout, spacing rules).
     *
     * @returns
     * Final serialized JSON output.
     *
     * @since 1.0.0
     */
    static render(tokens: readonly Token[], options: JsonOptions) {
        return new JSONRenderer(tokens, options).#_render();
    }
}

export default JSONRenderer;