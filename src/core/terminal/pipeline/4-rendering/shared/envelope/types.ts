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
    map: {};
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