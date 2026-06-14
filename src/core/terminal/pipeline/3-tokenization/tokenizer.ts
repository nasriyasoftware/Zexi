import TOKENS from "./tokens";
import REP_NODES from "../2-representation/nodes";
import TokensBuffer from "./container/tokens.buffer";
import TokenizationCache from "./tokens/cache/cache";
import { PropertyToken } from "./tokens/tokenization/property.token";
import type { RepresentationNode } from "../2-representation/types";

/**
 * Core semantic tokenizer that converts a `RepresentationNode` tree into
 * a linear stream of `Token` objects.
 *
 * The `Tokenizer` is the boundary between the **representation layer** and the
 * **rendering layer**, translating normalized semantic structures into a
 * renderer-agnostic token stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * Tokenization is the THIRD phase in the pipeline:
 *
 * ```text
 * JavaScript Value
 *        ↓
 * Graphing Layer
 *        ↓
 * Representation Layer
 *        ↓
 * Tokenizer (THIS LAYER)
 *        ↓
 * Rendering Layer
 *        ↓
 * Serialization
 *        ↓
 * Output String
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLE
 * ---------------------------------------------------------------------
 *
 * Tokenization is strictly semantic and layout-agnostic.
 *
 * This layer MUST NOT:
 *
 * - apply ANSI styling
 * - perform layout decisions (wrapping, alignment, width handling)
 * - produce final strings
 *
 * This layer ONLY:
 *
 * - converts representation nodes into tokens
 * - preserves structural meaning
 * - emits renderer-neutral structural hints
 * - maintains identity consistency via caching
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * The tokenizer is responsible for:
 *
 * - Traversing `RepresentationNode` trees recursively
 * - Converting nodes into semantic tokens
 * - Preserving structural boundaries (arrays, objects, maps, sets)
 * - Emitting grouping tokens (`GroupStart`, `GroupEnd`)
 * - Emitting indentation scope tokens
 * - Preserving key-value relationships
 * - Managing reference reuse via `TokenizationCache`
 * - Encoding repeated nodes as reference tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 NOT RESPONSIBLE FOR
 * ---------------------------------------------------------------------
 *
 * The tokenizer explicitly does NOT handle:
 *
 * - visual formatting decisions
 * - ANSI styling or coloring
 * - string serialization
 * - layout or wrapping logic
 * - semantic interpretation of values beyond structure
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN SEMANTIC MODEL
 * ---------------------------------------------------------------------
 *
 * The output is a **pure semantic token stream**, including:
 *
 * - structural tokens (groups, object open/close)
 * - spacing intent tokens (soft/hard space, soft line)
 * - separators (comma, semicolon)
 * - key-value relationship tokens
 * - primitive and composite value tokens
 * - reference tokens for repeated nodes
 *
 * This stream is deterministic and renderer-agnostic.
 *
 * ---------------------------------------------------------------------
 * 🔷 COLLECTION HANDLING
 * ---------------------------------------------------------------------
 *
 * Each structure type is normalized into tokens:
 *
 * - Array → sequential item stream
 * - Set → sequential unique item stream
 * - Map → key/value pairs with explicit separator (`=>`)
 * - Object/Record → property-based structure
 *
 * Each element is recursively tokenized.
 *
 * ---------------------------------------------------------------------
 * 🔷 REFERENCE & CACHING MODEL
 * ---------------------------------------------------------------------
 *
 * The tokenizer uses `TokenizationCache` to track previously seen
 * representation nodes.
 *
 * This enables:
 *
 * - identity preservation across repeated nodes
 * - structural deduplication
 * - reference emission instead of duplication
 *
 * Behavior:
 *
 * - First encounter → full token emission into cache buffer
 * - Subsequent encounters → reference wrapper tokens only
 *
 * This guarantees stable identity semantics across the token stream.
 *
* ---------------------------------------------------------------------
 * 🔷 ERROR HANDLING MODEL
 * ---------------------------------------------------------------------
 *
 * Error handling is implemented as a *structured token sequence* rather
 * than a single composite token or nested payload.
 *
 * Errors are decomposed into explicit, ordered tokens that represent
 * their full structural shape within the pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR TOKEN STRUCTURE
 * ---------------------------------------------------------------------
 *
 * A complete error is represented as a bounded token segment:
 *
 * ```
 * ErrorStartToken
 * ErrorDataToken
 * [optional cause block]
 * [optional stack trace token]
 * ErrorEndToken
 * ```
 *
 * Cause handling is expressed using explicit boundary tokens:
 *
 * ```
 * ErrorCauseStartToken
 *   ...nested token stream...
 * ErrorCauseEndToken
 * ```
 *
 * Stack traces are represented as a standalone `StackTraceToken`
 * containing normalized frame data.
 *
 * ---------------------------------------------------------------------
 * 🔷 CAUSE HANDLING MODEL
 * ---------------------------------------------------------------------
 *
 * Error causes are recursively tokenized using the same pipeline as
 * root values.
 *
 * The resulting token stream is inserted *inline* between cause boundary
 * tokens, preserving full structural order without nesting buffers or
 * composite tokens.
 *
 * This ensures:
 *
 * - full recursive composition
 * - no nested token containers
 * - consistent flat stream semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GUARANTEE
 * ---------------------------------------------------------------------
 *
 * This model guarantees:
 *
 * - fully linear token stream output
 * - no embedded token buffers inside tokens
 * - deterministic ordering of error components
 * - renderer-driven interpretation of structure
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL SHIFT
 * ---------------------------------------------------------------------
 *
 * Previous model:
 *
 * - single `ErrorToken` containing nested buffers and composite data
 *
 * Current model:
 *
 * - explicit, flat token sequence with structural boundaries
 * - recursion expressed through token emission, not containment
 *
 * This improves:
 *
 * - composability
 * - streaming compatibility
 * - renderer flexibility
 * - debugging clarity across pipeline stages
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURAL GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The tokenizer guarantees:
 *
 * - balanced `GroupStart` / `GroupEnd`
 * - balanced indentation scopes
 * - deterministic traversal order
 * - consistent identity-based reuse
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT CONTRACT
 * ---------------------------------------------------------------------
 *
 * Output is:
 *
 * - deterministic
 * - stateless after emission
 * - fully renderer-ready semantic token stream
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * A `try/finally` ensures structural integrity:
 *
 * Even if traversal fails, the tokenizer always emits:
 *
 * - `IndentEnd`
 * - `ObjectClose`
 * - `GroupEnd`
 *
 * preventing broken structural streams.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class Tokenizer {
    /**
     * Tokenization cache used to track previously visited representation nodes.
     *
     * This cache is the backbone of identity preservation in the tokenizer.
     *
     * It ensures that:
     *
     * - repeated nodes are not re-tokenized
     * - structural identity is preserved across the output stream
     * - reference tokens can be emitted instead of duplication
     *
     * The cache maps:
     *
     * ```text
     * RepRefNode → TokenizationCacheEntry
     * ```
     *
     * Each entry holds:
     *
     * - the initial `TokensBuffer` produced for the node
     * - a usage counter for reference indexing
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_cache = new TokenizationCache()

    /**
     * Recursively processes a `RepresentationNode` and appends
     * its tokenized form into the target buffer.
     *
     * This method is the **core traversal engine** of the tokenizer.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Dispatches based on concrete `RepresentationNode` type
     * - Uses structural caching for identity preservation
     * - Writes directly into shared or cached buffers
     * - Emits reference wrappers for repeated nodes
     *
     * ---------------------------------------------------------------------
     * 🔷 SPECIAL HANDLING RULES
     * ---------------------------------------------------------------------
     *
     * - Dates → direct token conversion
     * - Primitives → direct token conversion
     * - RegExp → direct token conversion
     * - Functions → cached + reference-aware emission
     * - Errors → structured token creation + optional nested cause buffer
     * - Collections → recursive traversal with grouping semantics
     *
     * ---------------------------------------------------------------------
     * 🔷 REFERENCE MODEL
     * ---------------------------------------------------------------------
     *
     * If a node has been seen before:
     *
     * - A `ReferenceStartToken` is emitted
     * - The cached buffer is reused (not recomputed)
     * - A `ReferenceEndToken` is emitted
     *
     * If first encounter:
     *
     * - The node is fully expanded into its cached buffer
     * - That buffer is later reused for all references
     *
     * ---------------------------------------------------------------------
     * 🔷 ERROR NODE BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * Error nodes are special because they may contain:
     *
     * - structured stack traces
     * - optional causal chains (`cause`)
     *
     * When processing:
     *
     * - `cause` is recursively tokenized into a **nested TokensBuffer**
     * - this buffer is embedded into `ErrorTokenData`
     * - ensures full structural fidelity across tokenization
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * A `try/finally` block ensures structural integrity:
     *
     * Even if traversal fails, the following are always emitted:
     *
     * - `IndentEnd`
     * - `ObjectClose`
     * - `GroupEnd`
     *
     * preventing malformed token streams.
     *
     * @param node - Representation node to process
     * @param target - Output buffer receiving tokens
     * @internal
     */
    #_process(node: RepresentationNode, target: TokensBuffer) {

        if (node instanceof REP_NODES.Date) {
            target.add(TOKENS.Date.from(node));
            return;
        }

        if (node instanceof REP_NODES.Error) {
            const entry = this.#_cache.check(node);

            if (entry.firstSeen) {
                const startGroup = new TOKENS.GroupStart;
                const endGroup = new TOKENS.GroupEnd(startGroup.id);

                const errorStart = new TOKENS.ErrorStart;
                const errorEnd = new TOKENS.ErrorEnd(errorStart);

                try {
                    entry.buffer.add(startGroup);
                    entry.buffer.add(errorStart);

                    entry.buffer.add(new TOKENS.ErrorData(errorStart, node.data.name, node.data.message));

                    if (node.data.cause) {
                        const causeStart = new TOKENS.ErrorCauseStart(errorStart);
                        const causeEnd = new TOKENS.ErrorCauseEnd(errorStart, causeStart);

                        entry.buffer.add(causeStart);
                        this.#_process(node.data.cause, entry.buffer);
                        entry.buffer.add(causeEnd);
                    }

                    if (node.data.stack.length > 0) {
                        const stack = node.data.stack
                        entry.buffer.add(new TOKENS.StackTrace(stack, errorStart));
                    }
                } finally {
                    entry.buffer.add(errorEnd);
                    entry.buffer.add(endGroup);
                }

                target.consume(entry.buffer);
                return;
            }

            const buffer = new TokensBuffer();

            buffer.add(TOKENS.ReferenceStart.create(node, entry.count));
            buffer.consume(entry.buffer);
            buffer.add(TOKENS.ReferenceEnd.create());

            target.consume(buffer);
            return;
        }

        if (node instanceof REP_NODES.Function) {
            const entry = this.#_cache.check(node);

            if (entry.firstSeen) {
                const token = TOKENS.Function.from(node);
                entry.buffer.add(token);

                target.consume(entry.buffer);
                return;
            }

            const buffer = new TokensBuffer();

            buffer.add(TOKENS.ReferenceStart.create(node, entry.count));
            buffer.consume(entry.buffer);
            buffer.add(TOKENS.ReferenceEnd.create());

            target.consume(buffer);
            return;
        }

        if (node instanceof REP_NODES.Primitive) {
            target.add(TOKENS.Primitive.from(node));
            return;
        }

        if (node instanceof REP_NODES.RegExp) {
            target.add(TOKENS.RegExp.from(node));
            return;
        }

        if (
            node instanceof REP_NODES.Array ||
            node instanceof REP_NODES.Set ||
            node instanceof REP_NODES.Object ||
            node instanceof REP_NODES.Map
        ) {
            const entry = this.#_cache.check(node);

            if (entry.firstSeen) {
                const objGroupStart = new TOKENS.GroupStart;

                entry.buffer
                    .add(objGroupStart)
                    .add(new TOKENS.ObjectName(node.name))
                    .add(new TOKENS.ObjectOpen(node.openToken))
                    .add(new TOKENS.SoftLine)
                    .add(new TOKENS.IndentStart);
                try {
                    switch (node.type) {
                        case 'array': {
                            const array = node as InstanceType<typeof REP_NODES.Array>;


                            for (let i = 0; i < array.items.length; i++) {
                                const item = array.items[i];
                                const hasMore = i < array.items.length - 1;

                                this.#_process(item, entry.buffer);
                                if (hasMore) {
                                    entry.buffer.add(new TOKENS.Separator).add(new TOKENS.SoftLine);
                                }
                            }

                            break;
                        }

                        case 'set': {
                            const set = node as InstanceType<typeof REP_NODES.Set>;

                            for (let i = 0; i < set.items.length; i++) {
                                const item = set.items[i];
                                const hasMore = i < set.items.length - 1;

                                this.#_process(item, entry.buffer);
                                if (hasMore) {
                                    entry.buffer.add(new TOKENS.Separator).add(new TOKENS.SoftLine);
                                }
                            }
                            break;
                        }

                        case 'map': {
                            const map = node as InstanceType<typeof REP_NODES.Map>;

                            const entries = Array.from(map.entries);
                            for (let i = 0; i < map.entries.size; i++) {
                                const [key, value] = entries[i];
                                const hasMore = i < map.entries.size - 1;

                                const startToken = new TOKENS.GroupStart;

                                entry.buffer.add(startToken);
                                this.#_process(key, entry.buffer);
                                entry.buffer
                                    .add(new TOKENS.HardSpace)
                                    .add(new TOKENS.KeyValueSeparator('=>'))
                                    .add(new TOKENS.HardSpace);

                                this.#_process(value, entry.buffer);
                                if (hasMore) {
                                    entry.buffer.add(new TOKENS.Separator(';')).add(new TOKENS.SoftLine);
                                }

                                entry.buffer.add(new TOKENS.GroupEnd(startToken.id));
                            }
                            break;
                        }

                        case 'record':
                        case 'object': {
                            const object = node as InstanceType<typeof REP_NODES.Object>;

                            const entries = Array.from(object.entries);
                            for (let i = 0; i < object.entries.size; i++) {
                                const [prop, value] = entries[i];
                                const hasMore = i < object.entries.size - 1;

                                const startToken = new TOKENS.GroupStart;

                                entry.buffer
                                    .add(startToken)
                                    .add(PropertyToken.from(prop))
                                    .add(new TOKENS.KeyValueSeparator)
                                    .add(new TOKENS.SoftSpace);

                                this.#_process(value, entry.buffer);
                                if (hasMore) {
                                    entry.buffer.add(new TOKENS.Separator).add(new TOKENS.SoftLine);
                                }

                                entry.buffer.add(new TOKENS.GroupEnd(startToken.id));
                            }

                            break;
                        }
                    }
                } finally {
                    entry.buffer
                        .add(new TOKENS.IndentEnd)
                        .add(new TOKENS.SoftLine)
                        .add(new TOKENS.ObjectClose(node.closeToken))
                        .add(new TOKENS.GroupEnd(objGroupStart.id));
                }

                target.consume(entry.buffer);
                return;
            }

            const buffer = new TokensBuffer();

            buffer.add(TOKENS.ReferenceStart.create(node, entry.count));
            buffer.consume(entry.buffer);
            buffer.add(TOKENS.ReferenceEnd.create());

            target.consume(buffer);
        }
    }

    /**
     * ---------------------------------------------------------------------
     * 🔷 PUBLIC ENTRY POINT
     * ---------------------------------------------------------------------
     *
     * Tokenizes a full `RepresentationNode` tree into a `TokensBuffer`.
     *
     * This is the ONLY public API for generating token streams from
     * the representation layer.
     *
     * ---------------------------------------------------------------------
     * 🔷 LIFECYCLE MODEL
     * ---------------------------------------------------------------------
     *
     * The returned buffer follows a strict lifecycle:
     *
     * ```text
     * creation → mutation (internal only) → finalize → immutable artifact
     * ```
     *
     * Once finalized:
     *
     * - no tokens can be added
     * - no tokens can be consumed
     * - internal mutation APIs are disabled
     *
     * This ensures the buffer becomes a **stable snapshot** of the
     * tokenization result.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY CONTRACT
     * ---------------------------------------------------------------------
     *
     * After calling `finalize()`:
     *
     * - the buffer becomes read-only
     * - its internal state is frozen
     * - it can be safely shared across renderers
     *
     * This guarantees deterministic output reuse across:
     *
     * - multiple renderers
     * - parallel rendering pipelines
     * - caching layers
     *
     * ---------------------------------------------------------------------
     * 🔷 CLONING MODEL
     * ---------------------------------------------------------------------
     *
     * If a renderer needs to reuse or mutate the buffer, it must clone it:
     *
     * ```ts
     * TokensBuffer.from(buffer)
     * ```
     *
     * This produces a **new independent buffer instance** while preserving
     * the original finalized token stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN BENEFITS
     * ---------------------------------------------------------------------
     *
     * This model enables:
     *
     * - zero-copy reuse of tokenized results
     * - safe multi-renderer execution
     * - deterministic replay of token streams
     * - separation between generation and consumption phases
     *
     * ---------------------------------------------------------------------
     * @param node - Root representation node
     * @returns A finalized immutable `TokensBuffer` snapshot
     */
    tokenize(node: RepresentationNode): TokensBuffer {
        const buffer = new TokensBuffer();
        this.#_process(node, buffer);

        buffer.finalize(); // transitions buffer into immutable snapshot state
        return buffer;
    }

    /**
     * Convenience static wrapper for tokenization.
     *
     * Creates a fresh `Tokenizer` instance and tokenizes the input node.
     *
     * This is a stateless entry point intended for simple usage:
     *
     * ```ts
     * Tokenizer.tokenize(node)
     * ```
     *
     * @param node - Root representation node
     * @returns Tokenized buffer
     */
    static tokenize(node: RepresentationNode): TokensBuffer {
        return new Tokenizer().tokenize(node);
    }
}

export default Tokenizer;