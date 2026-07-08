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
 * A strongly-typed immutable wrapper around token-derived data used for
 * structured serialization inside the Zexi rendering pipeline.
 *
 * This class transforms raw token data into a canonical, JSON-safe envelope
 * representation for internal rendering, debugging, and structural analysis.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Immutability (Internal Safety)**
 *    - The envelope is frozen at construction time
 *    - Prevents accidental mutation during rendering
 *
 * 2. **Versioned Serialization**
 *    - Each envelope carries a `$codec` version
 *    - Ensures structural compatibility across pipeline versions
 *
 * 3. **Token Awareness**
 *    - `$kind` defines the semantic category of the envelope
 *    - Used for routing inside tokenization/render phases
 *
 * 4. **Canonical Representation**
 *    - All payloads are normalized into deterministic structures
 *    - Special values (NaN, Infinity) are encoded safely
 *    - Deferred body content is excluded from envelope state
 *
 * ---------------------------------------------------------------------
 * 🔷 PAYLOAD NORMALIZATION RULES
 * ---------------------------------------------------------------------
 *
 * - Non-object payloads are rejected at construction time
 * - Payloads are normalized per envelope kind via a strict schema
 * - Resulting payload is shallow-frozen
 * - Nested structures remain mutable unless explicitly wrapped
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE CATEGORIES
 * ---------------------------------------------------------------------
 *
 * ### Deferred-body envelopes
 * These are partially constructed and completed during rendering:
 *
 * - `set`
 * - `map`
 *
 * ### Fully-materialized envelopes
 * These are completely resolved at construction time:
 *
 * - `error`
 * - `regex`
 * - `function`
 * - `number`
 *
 * The `number` envelope encodes non-JSON numeric states such as
 * `NaN`, `Infinity`, and `-Infinity` using a safe string-backed format.
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
     * This is the canonical normalized form produced during construction
     * and used as the single source of truth for all downstream operations.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE IN PIPELINE
     * ---------------------------------------------------------------------
     *
     * This value is used internally by:
     *
     * - tokenization (`tokenize`)
     * - envelope inspection (`inspect`)
     * - renderer-side structural analysis
     *
     * It is never mutated after construction.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY GUARANTEE
     * ---------------------------------------------------------------------
     *
     * The envelope is deeply frozen at the top level:
     *
     * - `$kind` is immutable
     * - `$codec` is immutable
     * - `$payload` is shallow-frozen (not deep-frozen)
     *
     * This ensures structural stability while allowing controlled mutation
     * of nested payload objects when explicitly designed.
     *
     * ---------------------------------------------------------------------
     * 🔷 PUBLIC ACCESS POLICY
     * ---------------------------------------------------------------------
     *
     * This field is private and must not be accessed outside this class.
     *
     * External access is only permitted via:
     *
     * - `DataEnvelope.inspect()`
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
     * - `null` values are rejected
     * - arrays are rejected
     * - non-record values are rejected
     *
     * Once basic validation succeeds, the payload is normalized into the
     * canonical schema associated with the selected envelope kind.
     *
     * ---------------------------------------------------------------------
     * 🔷 ENVELOPE KINDS
     * ---------------------------------------------------------------------
     *
     * Supported envelope categories include:
     *
     * - `error`     → structured error representation
     * - `map`       → key/value map structure
     * - `set`       → unique collection structure
     * - `regex`     → regular expression representation
     * - `function`  → function identity metadata
     * - `number`    → numeric special-value envelope (Infinity, NaN, etc.)
     *
     * ---------------------------------------------------------------------
     * 🔷 DEFERRED-BODY ENVELOPES
     * ---------------------------------------------------------------------
     *
     * Some envelope kinds separate metadata from body content:
     *
     * - `set`
     * - `map`
     *
     * These retain only structural metadata at construction time.
     * Their contents are injected later by the renderer pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * ---------------------------------------------------------------------
     *
     * The resulting normalized payload is shallow-frozen before being
     * stored in the envelope to guarantee runtime consistency.
     *
     * ---------------------------------------------------------------------
     *
     * @param kind
     * The envelope discriminator. Must be one of `EnvelopeKind`
     * (e.g. `"error" | "set" | "map" | "regex" | "function" | "number"`).
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
     * This method is the canonical normalization boundary for all envelope
     * payload construction in the rendering pipeline.
     *
     * It transforms raw user-provided input into a validated, deterministic
     * payload shape defined by `EnvelopeMap[K]`.
     *
     * ---------------------------------------------------------------------
     * 🔷 NORMALIZATION MODEL
     * ---------------------------------------------------------------------
     *
     * Each envelope kind is normalized according to its structural role:
     *
     * ### Deferred-body envelopes
     * (structure finalized later during rendering)
     *
     * - `set`
     * - `map`
     *
     * These retain metadata only (e.g. `size`) and initialize empty containers
     * for later population by the renderer.
     *
     * ### Fully-materialized envelopes
     * (fully resolved at construction time)
     *
     * - `error`
     * - `regex`
     * - `function`
     * - `number`
     *
     * These are completely normalized during construction and do not
     * participate in later body injection phases.
     *
     * ---------------------------------------------------------------------
     * 🔷 NUMBER ENVELOPE RULES
     * ---------------------------------------------------------------------
     *
     * The `number` envelope encodes numeric values that may not be valid JSON:
     *
     * Supported values:
     *
     * - finite numbers
     * - `Infinity`
     * - `-Infinity`
     * - `NaN`
     * - string equivalents of the above
     *
     * Normalization:
     *
     * - all values are validated against allowed numeric states
     * - all stored values are serialized as strings
     *   to ensure JSON compatibility
     *
     * ---------------------------------------------------------------------
     * 🔷 VALIDATION RULES
     * ---------------------------------------------------------------------
     *
     * Per-envelope validation rules:
     *
     * - missing required fields → `TypeError`
     * - incorrect field types → `TypeError`
     * - invalid numeric constraints → `RangeError`
     *
     * ---------------------------------------------------------------------
     *
     * @param kind
     * Envelope discriminator (`EnvelopeKind`).
     *
     * @param input
     * Raw payload matching `EnvelopeMap[K]`.
     *
     * @returns
     * Normalized payload matching `EnvelopeMap[K]`.
     *
     * @throws {TypeError}
     * Invalid or missing required fields.
     *
     * @throws {RangeError}
     * Numeric constraint violations (e.g. invalid special numeric values).
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

            case 'number': {
                const payload: EnvelopeMap['number'] = {
                    value: ''
                }

                if ('value' in input) {
                    if (typeof input.value === 'string') {
                        const allowed = ['Infinity', '-Infinity', 'NaN'];
                        if (!allowed.includes(input.value)) {
                            throw new RangeError(`Expected "value" to be one of ${allowed.join(', ')}, but got ${input.value}`);
                        }

                        payload.value = input.value;
                    } else if (typeof input.value === 'number') {
                        const v = input.value;
                        const allowed = [Infinity, -Infinity, NaN];

                        if (!allowed.includes(v)) {
                            throw new RangeError(`Expected "value" to be one of ${allowed.join(', ')}, but got ${v}`);
                        }

                        payload.value = String(v);
                    } else {
                        throw new TypeError(`Expected "value" to be a number, but got ${typeof input.value}`);
                    }
                } else {
                    throw new TypeError(`Expected "value" to be provided in the "${kind}" envelope payload.`);
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

        const requiresBodyInjection = DEFERRED_BODY_ENVELOPES.has(this.#_envelope.$kind);

        if (requiresBodyInjection) {
            return this.#_buildDeferredTokenization(tokenized) as EnvelopeTokenizationResult<K>;
        }

        const result: EnvelopeCompleteTokens = {
            deferred: false,
            tokens: Object.freeze(tokenized),
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
    static inspect<K extends EnvelopeKind>(env: DataEnvelope<K>): Readonly<Envelope<K>> {
        return env.#_envelope;
    }
}

export default DataEnvelope;