import TOKENS from "../../../3-tokenization/tokens";
import { DEFERRED_BODY_ENVELOPES } from "./consts";
import { isRecord } from "../../../../../../utils/utils";
import type { Token } from "../../../3-tokenization/types";
import type {
    EnvelopeTokenizationResult,
    Envelope,
    EnvelopeCompleteTokens,
    EnvelopeDeferredTokens,
    EnvelopeKind,
    EnvelopeMap,
} from "./types";

import path from 'path';
import fs from 'fs';

const stableVersion = (() => {
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');

        const pkgStr = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgStr);

        const versionSegments = (pkg?.version || "0.0.0").split(".");
        return `${versionSegments[0]}.${versionSegments[1]}`;
    } catch (err) {
        return "0.0";
    }
})();

/**
 * DataEnvelope
 * ------------
 *
 * A strongly-typed immutable wrapper around token-derived data
 * used for structured serialization.
 *
 * This class transforms internal token data into a standardized
 * JSON-safe envelope format suitable for internal debugging,
 * inspection, and renderer-side structural transformations.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Immutability (Internal Safety)**
 *    - The envelope is frozen at construction time
 *    - This primarily prevents accidental mutation inside the renderer
 *    - It does NOT imply external transport or persistence guarantees
 *
 * 2. **Versioned Serialization**
 *    - Every envelope carries a codec version (`$codec`)
 *    - This ensures structural compatibility between internal systems
 *
 * 3. **Token Awareness**
 *    - `$kind` identifies the semantic origin of the envelope
 *    - Used for routing during tokenization, not external consumption
 *
 * 4. **Canonical Envelope Representation**
 *    - Internal payloads are normalized into a deterministic shape
 *    - Deferred body data is excluded from stored envelope state
 *    - The envelope can expose its normalized representation for
 *      debugging and inspection purposes
 *
 * ---------------------------------------------------------------------
 * 🔷 PAYLOAD NORMALIZATION
 * ---------------------------------------------------------------------
 *
 * - If payload is not a plain object (`isRecord` check), it is replaced
 *   with `{}`.
 * - The payload is shallow-frozen to prevent accidental mutation during
 *   renderer-side processing.
 * - Nested structures are not deeply frozen.
 *
 * ---------------------------------------------------------------------
 * @template K
 * A discriminated envelope kind derived from `EnvelopeKind`.
 *
 * @since 1.0.0
 */
class DataEnvelope<K extends EnvelopeKind> {
    /**
     * Internal immutable envelope representation.
     *
     * This is frozen at construction time and returned directly
     * by `toObject()` to guarantee stable serialization output.
     * 
     * @readonly
     * @since 1.0.0
     */
    readonly #_envelope: Readonly<Envelope<K>>;

    /**
     * Creates a new immutable DataEnvelope instance.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * The constructor normalizes raw token-derived data into a strictly typed
     * envelope structure used by the renderer pipeline.
     *
     * This ensures that:
     *
     * - the envelope always carries a valid `$kind` discriminator
     * - payload shape is validated against the selected envelope kind
     * - envelope metadata is normalized into a canonical form
     * - deferred body content is excluded from stored payload state
     *
     * ---------------------------------------------------------------------
     * 🔷 TYPE SAFETY
     * ---------------------------------------------------------------------
     *
     * The `kind` parameter is constrained to `EnvelopeKind`, ensuring:
     *
     * - only supported envelope categories can be constructed
     * - payload type is automatically inferred from `EnvelopeMap`
     *
     * ---------------------------------------------------------------------
     * 🔷 PAYLOAD VALIDATION & NORMALIZATION
     * ---------------------------------------------------------------------
     *
     * A payload is required for every envelope instance.
     *
     * Before envelope-specific normalization occurs:
     *
     * - `undefined` payloads are rejected
     * - non-record values are rejected
     * - arrays are rejected
     * - `null` values are rejected
     *
     * Once basic validation succeeds, the payload is normalized into the
     * canonical schema associated with the selected envelope kind.
     *
     * Deferred-body envelopes (`set` and `map`) retain only structural
     * metadata while body content is intentionally omitted and injected
     * later by the renderer.
     *
     * The resulting normalized payload is shallow-frozen before being
     * stored in the envelope.
     *
     * ---------------------------------------------------------------------
     *
     * @param kind
     * The envelope discriminator. Must be one of `EnvelopeKind`
     * (e.g. `"error" | "set" | "map" | "regex" | "function"`).
     *
     * @param payload
     * Structured payload associated with the envelope kind.
     *
     * The payload must be a plain object matching the schema defined by
     * `EnvelopeMap[K]`.
     * 
     * Passing `undefined`, `null`, arrays, or other non-record values is
     * considered a programming error and will cause construction to fail.
     *
     * @since 1.0.0
     */
    constructor(kind: K, payload: EnvelopeMap[K]) {
        if (payload === undefined) {
            throw new SyntaxError(`${kind} envelope requires a payload and is missing.`);
        }

        if (!isRecord(payload)) {
            throw new TypeError(`${kind} envelope payload must be an object, but got ${typeof payload}`);
        }

        const _payload = this.#_createPayload(kind, payload);

        this.#_envelope = Object.freeze({
            $kind: kind,
            $codec: `zexi@${stableVersion}`,
            $payload: Object.isFrozen(_payload) ? _payload : Object.freeze(_payload),
        } as Envelope<K>);
    }

    /**
     * Creates a normalized envelope payload for a specific envelope kind.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * This method is responsible for converting user-provided envelope data
     * into the canonical payload shape stored inside the envelope.
     *
     * It acts as the single normalization boundary for all envelope kinds.
     *
     * Every payload produced by this method is guaranteed to:
     *
     * - conform to the schema defined by `EnvelopeMap[K]`
     * - contain all required metadata fields
     * - exclude renderer-managed body data when applicable
     * - satisfy runtime validation requirements
     *
     * ---------------------------------------------------------------------
     * 🔷 DEFERRED PAYLOAD NORMALIZATION
     * ---------------------------------------------------------------------
     *
     * Certain envelope kinds contain body content that is injected later by
     * the renderer rather than serialized directly inside the envelope.
     *
     * These include:
     *
     * - `set`
     * - `map`
     *
     * For these envelope kinds:
     *
     * - metadata is preserved (`size`)
     * - body containers are initialized as empty collections
     * - provided entries/values are intentionally discarded
     *
     * This allows tokenization to identify a deterministic payload boundary
     * that can later be populated by renderer-generated content.
     *
     * ---------------------------------------------------------------------
     * 🔷 COMPLETE PAYLOAD NORMALIZATION
     * ---------------------------------------------------------------------
     *
     * Envelope kinds whose payload is fully known at construction time are
     * normalized into a complete serializable representation.
     *
     * Examples:
     *
     * - `regex`
     * - `function`
     * - `error`
     *
     * These payloads do not participate in deferred body injection and are
     * tokenized exactly as stored.
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION
     * ---------------------------------------------------------------------
     *
     * Runtime validation is performed for all envelope-specific fields.
     *
     * Invalid values result in:
     *
     * - `TypeError` for type mismatches
     * - `RangeError` for invalid numeric ranges
     *
     * Missing required properties also result in a thrown error.
     *
     * ---------------------------------------------------------------------
     *
     * @param kind
     * The envelope kind being normalized.
     *
     * @param input
     * Raw payload supplied to the envelope constructor.
     *
     * @returns
     * A normalized payload matching the schema of `EnvelopeMap[K]`.
     *
     * @throws {TypeError}
     * Thrown when required properties are missing or have invalid types.
     *
     * @throws {RangeError}
     * Thrown when numeric metadata violates envelope constraints.
     *
     * @since 1.0.0
     */
    #_createPayload<K extends EnvelopeKind>(
        kind: K,
        input: EnvelopeMap[K]
    ): EnvelopeMap[K] {
        switch (kind) {
            case 'set': {
                const payload: EnvelopeMap['set'] = {
                    size: 0,
                    values: []
                }

                if ('size' in input) {
                    if (typeof input.size !== 'number') {
                        throw new TypeError(`Expected "size" to be a number, but got ${typeof input.size}`);
                    }

                    if (input.size < 0) {
                        throw new RangeError(`Expected "size" to be a non-negative number, but got ${input.size}`);
                    }

                    payload.size = input.size;
                } else {
                    throw new TypeError(`Expected "size" to be provided in the "${kind}" envelope payload.`);
                }

                return payload as EnvelopeMap[K];
            }

            case 'map': {
                const payload: EnvelopeMap['map'] = {
                    size: 0,
                    entries: []
                };

                if ('size' in input) {
                    if (typeof input.size !== 'number') {
                        throw new TypeError(`Expected "size" to be a number, but got ${typeof input.size}`);
                    }

                    if (input.size < 0) {
                        throw new RangeError(`Expected "size" to be a non-negative number, but got ${input.size}`);
                    }

                    payload.size = input.size;
                } else {
                    throw new TypeError(`Expected "size" to be provided in the "${kind}" envelope payload.`);
                }

                return payload as EnvelopeMap[K];
            }

            case 'regex': {
                const payload: EnvelopeMap['regex'] = {
                    pattern: '',
                    flags: ''
                };

                if ('pattern' in input) {
                    if (typeof input.pattern !== 'string') {
                        throw new TypeError(`Expected "pattern" to be a string, but got ${typeof input.pattern}`);
                    }

                    payload.pattern = input.pattern;
                } else {
                    throw new TypeError(`Expected "pattern" to be provided in the "${kind}" envelope payload.`);
                }

                if ('flags' in input) {
                    if (typeof input.flags !== 'string') {
                        throw new TypeError(`Expected "flags" to be a string, but got ${typeof input.flags}`);
                    }

                    payload.flags = input.flags;
                }

                return payload as EnvelopeMap[K];
            }

            case 'error': {
                return {} as EnvelopeMap[K];
            }

            case 'function': {
                const payload: EnvelopeMap['function'] = {
                    name: '',
                }

                if ('name' in input) {
                    if (typeof input.name !== 'string') {
                        throw new TypeError(`Expected "name" to be a string, but got ${typeof input.name}`);
                    }

                    payload.name = input.name;
                } else {
                    throw new TypeError(`Expected "name" to be provided in the "${kind}" envelope payload.`);
                }

                return payload as EnvelopeMap[K];
            }

            default: {
                throw new TypeError(`Unsupported envelope kind: ${kind}`);
            }
        }
    }

    /**
     * Finds the boundary index between the envelope metadata section
     * and the dynamic body section within a tokenized envelope stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * The envelope token stream contains a structured prefix followed by
     * a dynamic body region.
     *
     * This method identifies the exact transition point where:
     *
     * - envelope structural tokens end
     * - renderer-injected body content begins
     *
     * ---------------------------------------------------------------------
     * 🔷 DETECTION STRATEGY
     * ---------------------------------------------------------------------
     *
     * The boundary is defined by detecting the first occurrence of:
     *
     * ```
     * IndentStart → IndentEnd
     * ```
     *
     * When this pattern is found, the method returns the index of the
     * `IndentStart` token.
     *
     * This represents the last structural token before the body section.
     *
     * ---------------------------------------------------------------------
     * 🔷 RETURN VALUE SEMANTICS
     * ---------------------------------------------------------------------
     *
     * - Returns the index of the `IndentStart` token that precedes the body
     *   region.
     *
     * - Returns `-1` if no valid body boundary is found.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANTS
     * ---------------------------------------------------------------------
     *
     * - The token stream must contain exactly one valid body boundary
     * - The boundary must appear after the envelope header section
     * - Indentation markers are assumed to be structurally well-formed
     *
     * If these invariants are violated, the envelope is considered invalid
     * for token-level rendering.
     *
     * ---------------------------------------------------------------------
     * 🔷 RENDERING ROLE
     * ---------------------------------------------------------------------
     *
     * This method is critical for:
     *
     * - splitting envelope structure from dynamic payload injection
     * - placing anchors at correct insertion points
     * - ensuring deterministic rendering boundaries
     *
     * ---------------------------------------------------------------------
     *
     * @param tokens
     * The flattened envelope token stream excluding outer group tokens.
     *
     * @returns
     * Index of the `IndentStart` token marking the boundary, or `-1`
     * if no valid boundary exists.
     *
     * @since 1.0.0
     */
    #_findBodyBoundary(tokens: readonly Token[]) {
        let prevToken: Token | undefined;
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];

            try {
                if (
                    prevToken &&
                    prevToken instanceof TOKENS.IndentStart &&
                    current instanceof TOKENS.IndentEnd
                ) {
                    return i - 1; // index of IndentStart
                }
            } finally {
                prevToken = current;
            }
        }

        return -1;
    }

    /**
     * Constructs a deferred tokenization result for envelopes that require
     * runtime body injection.
     *
     * This method transforms a flattened token stream into a structured
     * split-boundary representation that enables renderer-controlled
     * insertion of dynamic payload content.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Some envelope types (e.g. `set`, `map`) do not fully materialize
     * their payload during initial tokenization.
     *
     * Instead, they expose a *deferred body region* where the renderer
     * is responsible for injecting runtime-generated tokens.
     *
     * This method:
     *
     * - detects the boundary between envelope structure and body region
     * - splits the token stream into immutable segments
     * - injects deterministic anchors for runtime insertion
     * - validates structural invariants of the resulting layout
     *
     * ---------------------------------------------------------------------
     * 🔷 BOUNDARY DETECTION
     * ---------------------------------------------------------------------
     *
     * The body boundary is identified via `#_findBodyBoundary()`, which
     * locates the first structural transition:
     *
     * ```
     * IndentStart → IndentEnd
     * ```
     *
     * The index of `IndentStart` is treated as the last token of the
     * structural prefix.
     *
     * If no valid boundary is found, the envelope is considered invalid
     * and an error is thrown.
     *
     * ---------------------------------------------------------------------
     * 🔷 OUTPUT STRUCTURE
     * ---------------------------------------------------------------------
     *
     * The resulting token structure is split into two immutable segments:
     *
     * - `tokens.start`
     *   Contains all structural tokens up to and including the boundary,
     *   followed by the `anchors.start` token.
     *
     * - `tokens.trailing`
     *   Contains the `anchors.end` token followed by all remaining
     *   structural tokens.
     *
     * Between these two segments lies the *deferred body region* where
     * renderer-injected tokens will be inserted.
     *
     * ---------------------------------------------------------------------
     * 🔷 ANCHOR SEMANTICS
     * ---------------------------------------------------------------------
     *
     * - `anchors.start`
     *   Marks the exact insertion point where dynamic body tokens begin.
     *   All injected tokens must appear after this anchor.
     *
     * - `anchors.end`
     *   Marks the termination boundary for dynamic injection.
     *   All injected tokens must appear before this anchor.
     *
     * Anchors guarantee stable insertion points independent of stream
     * mutation or index shifts.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY CONTRACT
     * ---------------------------------------------------------------------
     *
     * - `tokens.start` is frozen to prevent structural mutation
     * - `tokens.trailing` is frozen to prevent structural mutation
     * - anchors are stable reference tokens used for injection only
     *
     * Consumers must not mutate any part of this structure.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANTS
     * ---------------------------------------------------------------------
     *
     * The method enforces strict structural correctness:
     *
     * - a valid body boundary must exist
     * - token count must remain consistent after splitting
     * - exactly one pair of anchors must be introduced
     *
     * Any violation indicates a corrupted or invalid envelope stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 RENDERING ROLE
     * ---------------------------------------------------------------------
     *
     * This structure is consumed exclusively by renderer systems to:
     *
     * - inject dynamic payload content into envelopes
     * - preserve deterministic structural boundaries
     * - support speculative rendering and rollback safety
     *
     * It is not intended for external serialization or transport.
     *
     * ---------------------------------------------------------------------
     *
     * @param finalTokens
     * Flattened token stream representing the envelope after removing
     * outer grouping tokens.
     *
     * @returns
     * A `EnvelopeDeferredTokens` structure containing:
     *
     * - split immutable token segments (`start` / `trailing`)
     * - injection anchors for runtime body insertion
     *
     * @throws {Error}
     * If no valid body boundary is found or structural invariants are violated.
     *
     * @since 1.0.0
     */
    #_buildDeferredTokenization(finalTokens: readonly Token[]): EnvelopeDeferredTokens {
        const bodyBoundary = this.#_findBodyBoundary(finalTokens);
        if (bodyBoundary === -1) {
            throw new Error(
                'Invariant violation: Failed to find envelope body boundary.'
            );
        }

        const anchors = {
            start: new TOKENS.Anchor(`envelope:${this.#_envelope.$kind}:data-start`),
            end: new TOKENS.Anchor(`envelope:${this.#_envelope.$kind}:data-end`)
        }

        const outputTokens = {
            start: Object.freeze([
                ...finalTokens.slice(0, bodyBoundary + 1),
                anchors.start
            ]),
            trailing: Object.freeze([
                anchors.end,
                ...finalTokens.slice(bodyBoundary + 1)
            ])
        };

        const totalOutputTokens = outputTokens.start.length + outputTokens.trailing.length;
        const expected = finalTokens.length + 2;
        if (totalOutputTokens !== expected) {
            throw new Error(
                `Invariant violation: Expected ${finalTokens.length + 2} tokens, but found ${outputTokens.start.length + outputTokens.trailing.length}.`
            );
        }

        const result: EnvelopeDeferredTokens = {
            deferred: true,
            tokens: outputTokens,
            anchors
        }

        return result;
    }

    /**
     * Tokenizes this envelope using a renderer-provided tokenizer.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY BOUNDARY
     * ---------------------------------------------------------------------
     *
     * The envelope does not implement tokenization itself.
     *
     * Instead, it delegates serialization to a renderer-owned tokenizer and
     * then post-processes the resulting token stream according to the
     * envelope kind.
     *
     * This keeps envelope logic independent from rendering concerns while
     * still allowing envelope-specific token handling.
     *
     * ---------------------------------------------------------------------
     * 🔷 TOKENIZATION MODES
     * ---------------------------------------------------------------------
     *
     * Envelope tokenization operates in one of two modes:
     *
     * ### Deferred Tokenization
     *
     * Used by envelope kinds whose body content is rendered later:
     *
     * - `set`
     * - `map`
     *
     * These envelopes produce an `EnvelopeDeferredTokens` result.
     *
     * The token stream is split into:
     *
     * - structural prefix (`tokens.start`)
     * - structural suffix (`tokens.trailing`)
     *
     * Injection anchors are inserted between these regions so renderer
     * systems can later populate the envelope body.
     *
     * ### Complete Tokenization
     *
     * Used by envelope kinds whose payload is fully known during
     * construction:
     *
     * - `regex`
     * - `function`
     * - `error`
     *
     * These envelopes produce an `EnvelopeCompleteTokens` result containing
     * the finalized token stream without anchor generation.
     *
     * ---------------------------------------------------------------------
     * 🔷 GROUP TOKEN REMOVAL
     * ---------------------------------------------------------------------
     *
     * The tokenizer is expected to produce an outer group wrapper.
     *
     * Before any envelope-specific processing occurs, the envelope removes:
     *
     * - leading `group-start`
     * - trailing `group-end`
     *
     * Only the inner envelope token stream participates in subsequent
     * processing.
     *
     * ---------------------------------------------------------------------
     * 🔷 RETURN TYPE
     * ---------------------------------------------------------------------
     *
     * The returned structure depends on the envelope kind:
     *
     * - deferred envelopes → `EnvelopeDeferredTokens`
     * - complete envelopes → `EnvelopeCompleteTokens`
     *
     * This relationship is enforced by
     * `EnvelopeTokenizationResult<K>`.
     *
     * ---------------------------------------------------------------------
     *
     * @param tokenizer
     * Renderer-owned tokenizer used to convert the envelope object into a
     * token stream.
     *
     * @returns
     * A tokenization result whose shape depends on the envelope kind.
     *
     * @since 1.0.0
     */
    tokenize(
        tokenizer: (value: unknown) => readonly Token[]
    ): EnvelopeTokenizationResult<K> {
        const tokenized = tokenizer(this.#_envelope);

        // Remove the `group-start` and `group-end` tokens
        const finalTokens = tokenized.slice(1, tokenized.length - 1);

        const requiresBodyInjection = DEFERRED_BODY_ENVELOPES.has(this.#_envelope.$kind);

        if (requiresBodyInjection) {
            return this.#_buildDeferredTokenization(finalTokens) as EnvelopeTokenizationResult<K>;
        }

        const result: EnvelopeCompleteTokens = {
            deferred: false,
            tokens: Object.freeze(finalTokens),
        }

        return result as EnvelopeTokenizationResult<K>;
    }

    /**
     * Returns the internal envelope object for debugging purposes only.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT
     * ---------------------------------------------------------------------
     *
     * This method is strictly for inspection and debugging.
     *
     * It MUST NOT be used for:
     *
     * - tokenization
     * - rendering
     * - serialization pipelines
     *
     * The renderer is the only component allowed to tokenize envelopes,
     * using its own tokenizer implementation.
     *
     * ---------------------------------------------------------------------
     * 🔷 LIFECYCLE NOTE
     * ---------------------------------------------------------------------
     *
     * The envelope object is immediately consumed by the rendering pipeline
     * after creation and does not represent a transport or persistence model.
     *
     * ---------------------------------------------------------------------
     *
     * @internal
     * @returns Frozen internal envelope object
     * @since 1.0.0
     */
    get debug(): Readonly<Envelope<K>> {
        return this.#_envelope;
    }
}

export default DataEnvelope;