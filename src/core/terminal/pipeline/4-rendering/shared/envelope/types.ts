import { DEFERRED_BODY_ENVELOPES_VALUES } from "./consts";
import type { AnchorToken } from "../../../3-tokenization/tokens/rendering/anchor.token";
import type { Token } from "../../../3-tokenization/types";

/**
 * Map of all supported envelope kinds and their associated payload shapes.
 *
 * Each key represents a structural encoding category produced by the
 * Zexi rendering pipeline, and each value defines the exact payload
 * shape that will be serialized inside `$payload`.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This map serves as the single source of truth for:
 *
 * - envelope type discrimination (`EnvelopeKind`)
 * - payload typing per envelope category
 * - runtime serialization guarantees
 *
 * It ensures that each envelope kind has a strictly defined structure,
 * preventing accidental payload drift between renderer and consumers.
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE CATEGORIES
 * ---------------------------------------------------------------------
 *
 * - `error`
 *   Structured error representation (metadata only or extended in future).
 *
 * - `map`
 *   Map-like structure serialization (key/value pairs).
 *
 * - `set`
 *   Set-like structure serialization (unique value collections).
 *
 * - `regex`
 *   Regular expression representation including source pattern and flags.
 *
 * - `function`
 *   Function identity representation (non-executable metadata only).
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type EnvelopeMap = {
    error: {};
    map: {
        size: number;
        entries?: { key: unknown; value: unknown }[];
    };
    set: {
        size: number;
        values?: unknown[];
    };

    regex: {
        pattern: string;
        flags: string;
    };

    function: {
        name: string;
    };
}

/**
 * Union of all supported envelope discriminators.
 *
 * Derived directly from {@link EnvelopeMap}, ensuring:
 *
 * - no orphan envelope kinds
 * - no mismatched payload definitions
 * - compile-time enforcement of valid envelope categories
 *
 * This type is used as the `$kind` discriminator in all envelope outputs.
 *
 * @example
 * ```ts
 * const kind: EnvelopeKind = "regex";
 * ```
 *
 * @since 1.0.0
 */
export type EnvelopeKind = keyof EnvelopeMap;

/**
 * A versioned codec identifier for Zexi envelope serialization.
 *
 * ---------------------------------------------------------------------
 * 🔷 FORMAT
 * ---------------------------------------------------------------------
 *
 * ```
 * zexi@<major>.<minor>
 * ```
 *
 * Only major and minor versions are included because:
 *
 * - patch versions are considered non-breaking internal fixes
 * - envelope structure compatibility is guaranteed at minor level
 * - consumers should not depend on patch-level behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 COMPATIBILITY MODEL
 * ---------------------------------------------------------------------
 *
 * - Same major version → structural compatibility guaranteed
 * - Different minor version → backward/forward compatible
 * - Patch version → intentionally excluded from codec identity
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```
 * zexi@1.4
 * ```
 *
 * @since 1.0.0
 */
export type ZexiCodec = `zexi@${string}.${string}`;

/**
 * Internal envelope structure used for serialized Zexi output.
 *
 * This interface defines the standardized transport format used by the
 * rendering pipeline when emitting structured diagnostic or logging data.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * The envelope acts as a stable serialization boundary between:
 *
 * - token-level rendering logic
 * - external logging systems
 * - debugging / telemetry consumers
 *
 * It ensures that raw token structures are never exposed directly,
 * only normalized and versioned representations.
 *
 * ---------------------------------------------------------------------
 * 🔷 STRUCTURE
 * ---------------------------------------------------------------------
 *
 * - `$kind`
 *   Discriminator identifying the envelope category (see `EnvelopeKind`).
 *
 * - `$codec`
 *   Versioned serialization identifier used for compatibility checks.
 *
 * - `$payload`
 *   Strictly typed, immutable payload derived from the token source.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY GUARANTEE
 * ---------------------------------------------------------------------
 *
 * The `$payload` field is defined as `Readonly` to enforce:
 *
 * - no runtime mutation after creation
 * - safe logging and transport
 * - predictable serialization output
 *
 * Note: This is a shallow immutability guarantee only.
 *
 * ---------------------------------------------------------------------
 * @template K
 * The envelope discriminator type, restricted to `EnvelopeKind`.
 *
 * @since 1.0.0
 */
export interface Envelope<K extends EnvelopeKind> {
    /**
     * Envelope discriminator identifying the structural category.
     *
     * This value determines how the `$payload` should be interpreted.
     *
     * It replaces raw token kinds with a constrained semantic subset
     * optimized for serialization and external consumption.
     *
     * @since 1.0.0
     */
    $kind: K;

    /**
     * Codec version identifying the serialization format.
     *
     * This ensures consumers can:
     *
     * - validate compatibility
     * - detect breaking changes
     * - evolve parsing behavior safely
     *
     * Example:
     * ```
     * zexi@1.2
     * ```
     *
     * @since 1.0.0
     */
    $codec: ZexiCodec;

    /**
     * Normalized, immutable payload derived from the source token.
     *
     * The structure depends on the envelope kind:
     *
     * - `regex` → `{ pattern, flags }`
     * - `function` → `{ name }`
     * - `map` → `{}` (placeholder / future expansion)
     * - `set` → `{}` (placeholder / future expansion)
     * - `error` → `{}` (base structure)
     *
     * This field is shallow-frozen at creation time to:
     *
     * - prevent accidental mutation during intermediate pipeline stages
     * - ensure deterministic tokenization input
     * - preserve structural intent before conversion into tokens
     *
     * ⚠️ Important:
     * This immutability is a *development-time and pipeline-safety guarantee only*.
     * The envelope itself is never serialized or transmitted directly —
     * it is immediately transformed into tokens by the rendering pipeline.
     *
     * @readonly
     * @since 1.0.0
     */
    $payload: Readonly<EnvelopeMap[K]>;
}

/**
 * Conditional tokenization result of a `DataEnvelope`, determined by the
 * envelope kind at compile time.
 *
 * This type maps each `EnvelopeKind` to its corresponding tokenization
 * strategy:
 *
 * - Deferred envelopes → `EnvelopeDeferredTokens`
 * - Complete envelopes → `EnvelopeCompleteTokens`
 *
 * ---------------------------------------------------------------------
 * 🔷 DISPATCH MODEL
 * ---------------------------------------------------------------------
 *
 * The result type is resolved based on whether the envelope kind is
 * considered *deferred* (i.e. requires renderer-side body injection).
 *
 * Deferred kinds:
 *
 * - `set`
 * - `map`
 *
 * All other envelope kinds are treated as complete and fully resolved
 * during tokenization.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * This is a compile-time conditional type. It does not exist at runtime.
 *
 * The runtime behavior is determined by `DataEnvelope.tokenize()`, but
 * this type ensures correct structural expectations at the type level.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESULT FORMS
 * ---------------------------------------------------------------------
 *
 * Depending on `K`, this resolves to:
 *
 * - `EnvelopeDeferredTokens`
 *   → token stream split into structural segments with injection anchors
 *
 * - `EnvelopeCompleteTokens`
 *   → fully materialized immutable token stream
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This type exists to enforce correctness of renderer expectations:
 *
 * - deferred envelopes must support injection regions
 * - complete envelopes must be consumed as flat streams
 *
 * It prevents accidental misuse of injection logic on fully-resolved
 * envelope types.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export type EnvelopeTokenizationResult<K extends EnvelopeKind> =
    K extends typeof DEFERRED_BODY_ENVELOPES_VALUES[number]
    ? EnvelopeDeferredTokens
    : EnvelopeCompleteTokens;

/**
 * Tokenized representation of an envelope whose payload is fully
 * resolved at tokenization time.
 *
 * Complete envelopes do not contain deferred rendering regions and are
 * emitted as a single, immutable token stream.
 *
 * Examples include:
 *
 * - `regex`
 * - `function`
 * - `error`
 *
 * where all payload data is known upfront and no renderer-side
 * injection is required.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Complete envelopes are represented as a single linear token stream:
 *
 * ```txt
 * tokens[]
 * ```
 *
 * There are:
 *
 * - no injection anchors
 * - no deferred body region
 * - no structural split between start/trailing segments
 *
 * The entire envelope is fully materialized at tokenization time and
 * ready for immediate consumption by the renderer.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The returned token array is immutable and must be treated as a
 * read-only stream.
 *
 * Consumers must not:
 *
 * - insert tokens
 * - remove tokens
 * - reorder tokens
 *
 * Any structural transformation must occur through higher-level
 * rendering pipelines, not through direct mutation.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTRAST WITH DEFERRED ENVELOPES
 * ---------------------------------------------------------------------
 *
 * Unlike `EnvelopeDeferredTokens`, complete envelopes:
 *
 * - do not expose `anchors`
 * - do not split token streams
 * - do not support renderer-side payload injection
 *
 * They represent terminal, fully-resolved data structures.
 *
 * ---------------------------------------------------------------------
 * 🔷 PRODUCED BY
 * ---------------------------------------------------------------------
 *
 * Generated by:
 *
 * ```ts
 * DataEnvelope.tokenize(...)
 * ```
 *
 * for envelope kinds whose payload is static and does not require
 * incremental rendering.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface EnvelopeCompleteTokens {
    /**
     * Discriminator indicating that this envelope is fully resolved.
     *
     * When `false`, the envelope contains no deferred body region and is
     * fully represented by a single token stream.
     *
     * @since 1.0.0
     */
    deferred: false;

    /**
     * Immutable token stream representing the complete envelope.
     *
     * This includes all structural and payload tokens in a single sequence.
     *
     * The stream is:
     *
     * - fully resolved at tokenization time
     * - not split into structural segments
     * - not accompanied by injection anchors
     *
     * ---------------------------------------------------------------------
     * 🔷 STREAM CONTRACT
     * ---------------------------------------------------------------------
     *
     * This array represents the final rendering-ready output of the
     * envelope and must be treated as read-only.
     *
     * @since 1.0.0
     */
    tokens: readonly Token[];
}

/**
 * Tokenized representation of an envelope whose payload content is
 * supplied later during rendering.
 *
 * Deferred envelopes cannot be rendered as a complete token stream at
 * tokenization time because part of their payload is produced dynamically
 * by the renderer.
 *
 * Examples include:
 *
 * - `set`
 * - `map`
 *
 * where structural metadata is known immediately but body content is
 * emitted later from the source traversal stream.
 *
 * ---------------------------------------------------------------------
 * 🔷 DEFERRED RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Deferred envelopes are split into two immutable structural token
 * segments:
 *
 * - `tokens.start`
 * - `tokens.trailing`
 *
 * Between these segments exists a dynamic body region represented by
 * injection anchors.
 *
 * During rendering:
 *
 * ```txt
 * start tokens
 * ↓
 * start anchor
 * ↓
 * renderer-injected body content
 * ↓
 * end anchor
 * ↓
 * trailing tokens
 * ```
 *
 * This allows envelope structure to be emitted immediately while
 * postponing body generation until the renderer reaches the underlying
 * source data.
 *
 * ---------------------------------------------------------------------
 * 🔷 ANCHOR MODEL
 * ---------------------------------------------------------------------
 *
 * Two anchors delimit the deferred body region:
 *
 * - `anchors.start`
 * - `anchors.end`
 *
 * These anchors provide stable injection targets regardless of token
 * stream mutations that occur after tokenization.
 *
 * Using anchors avoids fragile index-based insertion logic and allows
 * renderers to inject content deterministically.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * All token collections exposed by this structure are immutable.
 *
 * Consumers must treat:
 *
 * - `tokens.start`
 * - `tokens.trailing`
 * - anchor references
 *
 * as read-only renderer metadata.
 *
 * ---------------------------------------------------------------------
 * 🔷 PRODUCED BY
 * ---------------------------------------------------------------------
 *
 * Generated by:
 *
 * ```ts
 * DataEnvelope.tokenize(...)
 * ```
 *
 * for envelope kinds whose payload is rendered incrementally rather than
 * serialized entirely during tokenization.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface EnvelopeDeferredTokens {
    /**
     * Discriminator indicating that this envelope contains a deferred
     * rendering region.
     *
     * When `true`, body content is expected to be injected later between
     * `anchors.start` and `anchors.end`.
     *
     * @since 1.0.0
     */
    deferred: true;

    /**
     * Immutable structural prefix and suffix segments of the envelope.
     *
     * These tokens define the fixed envelope scaffold surrounding the
     * dynamic insertion region.
     *
     * ---------------------------------------------------------------------
     * 🔷 START SEGMENT
     * ---------------------------------------------------------------------
     *
     * Contains:
     *
     * - envelope header tokens
     * - structural indentation start tokens (if applicable)
     * - all tokens up to (and including) the body opening boundary
     *
     * The `anchors.start` token is appended at the end of this segment
     * to mark the injection point for dynamic content.
     *
     * ---------------------------------------------------------------------
     * 🔷 TRAILING SEGMENT
     * ---------------------------------------------------------------------
     *
     * Contains:
     *
     * - closing body boundary tokens
     * - envelope termination structure
     * - post-body formatting tokens
     *
     * The `anchors.end` token is prepended to this segment to mark the
     * end of dynamic content injection.
     * 
     * @since 1.0.0
     */
    tokens: {
        /**
         * Structural prefix of the envelope.
         *
         * Contains all tokens before the dynamic body region,
         * including the insertion point for `anchors.start`.
         * 
         * @since 1.0.0
         */
        start: readonly Token[];

        /**
         * Structural suffix of the envelope.
         *
         * Contains all tokens after the dynamic body region,
         * including the insertion point for `anchors.end`.
         * 
         * @since 1.0.0
         */
        trailing: readonly Token[];
    };

    /**
     * Injection anchors used to delimit the dynamic body region of the envelope.
     *
     * These anchors are inserted into the token stream and later resolved
     * by the renderer to determine exact injection boundaries.
     *
     * ---------------------------------------------------------------------
     * 🔷 START ANCHOR
     * ---------------------------------------------------------------------
     *
     * Indicates where renderer-generated body content should begin.
     *
     * All injected tokens targeting the envelope body must be inserted
     * immediately after this anchor.
     *
     * ---------------------------------------------------------------------
     * 🔷 END ANCHOR
     * ---------------------------------------------------------------------
     *
     * Indicates where renderer-generated body content should end.
     *
     * All injected tokens must appear before this anchor to preserve
     * envelope structural integrity.
     * 
     * @since 1.0.0
     */
    anchors: {
        /**
         * Marks the start of the dynamic envelope body region.
         *
         * Renderer injects body tokens immediately after this anchor.
         * 
         * @since 1.0.0
         */
        start: AnchorToken;

        /**
         * Marks the end of the dynamic envelope body region.
         *
         * Renderer must inject body tokens before this anchor.
         * 
         * @since 1.0.0
         */
        end: AnchorToken;
    };
}