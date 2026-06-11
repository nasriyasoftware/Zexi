import { isRecord } from "../../../../../../utils/utils";

import path from 'path';
import fs from 'fs';
import { Envelope, EnvelopeKind, EnvelopeMap } from "./types";

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
 * The number of tokens after the `$payload` section in the serialized envelope.
 *
 * ---------------------------------------------------------------------
 * ⚠️ IMPORTANT MAINTENANCE NOTE
 * ---------------------------------------------------------------------
 *
 * This value is manually derived from the current envelope token structure
 * produced by `DataEnvelope.toObject()` after tokenization.
 *
 * It is NOT automatically computed and will become invalid if the envelope
 * structure changes (e.g. adding/removing fields such as `$codec`, `$kind`,
 * or payload shaping logic).
 *
 * If the envelope schema is modified, this constant MUST be recalculated
 * to match the new token layout.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Used by render-time slicing logic to separate:
 *
 * - core envelope tokens
 * - trailing structural tokens injected by the renderer pipeline
 *
 * @since 1.0.0
 */
export const TRAILING_LENGTH = 9 as const;

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
 * 4. **JSON Compatibility**
 *    - The output is safe for `JSON.stringify`
 *    - `toObject()` returns a plain object representation of the envelope
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
     *   (restricted to `EnvelopeKind`)
     * - payload shape matches the expected schema for that kind
     * - invalid payloads are safely normalized to `{}` when needed
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
     * 🔷 PAYLOAD NORMALIZATION
     * ---------------------------------------------------------------------
     *
     * - If payload is not a plain record (`isRecord` check), it is replaced
     *   with an empty object `{}`.
     * - The payload is shallow-frozen to prevent accidental mutation within
     *   the rendering pipeline.
     *
     * ⚠️ This freezing is NOT for transport safety — it is purely an internal
     * immutability guard during rendering and tokenization.
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
     * The expected shape is defined by `EnvelopeMap[K]`.
     *
     * @since 1.0.0
     */
    constructor(kind: K, payload: EnvelopeMap[K]) {
        const _payload = isRecord(payload) ? payload : {};

        this.#_envelope = Object.freeze({
            $kind: kind,
            $codec: `zexi@${stableVersion}`,
            $payload: Object.isFrozen(_payload) ? _payload : Object.freeze(_payload),
        } as Envelope<K>);
    }

    /**
     * Returns the internal envelope object representation.
     *
     * ---------------------------------------------------------------------
     * 🔷 PURPOSE
     * ---------------------------------------------------------------------
     *
     * Provides access to the fully constructed envelope used internally
     * by the renderer pipeline before tokenization.
     *
     * This object is:
     *
     * - structurally immutable (frozen at construction time)
     * - safe for JSON serialization
     * - not intended for mutation or extension
     *
     * ---------------------------------------------------------------------
     * 🔷 IMPORTANT BEHAVIOR NOTE
     * ---------------------------------------------------------------------
     *
     * The returned object is NOT a transport payload.
     *
     * It is immediately consumed by the tokenization pipeline and converted
     * into rendering tokens. It does not leave the renderer as-is.
     *
     * ---------------------------------------------------------------------
     * 🔷 STRUCTURE
     * ---------------------------------------------------------------------
     *
     * ```ts
     * {
     *   $kind: EnvelopeKind,
     *   $codec: ZexiCodec,
     *   $payload: EnvelopeMap[EnvelopeKind]
     * }
     * ```
     *
     * ---------------------------------------------------------------------
     *
     * @returns
     * A frozen envelope object containing:
     *
     * - `$kind`: envelope discriminator
     * - `$codec`: versioned serialization identifier
     * - `$payload`: normalized structured payload
     *
     * @since 1.0.0
     */
    toObject(): Envelope<K> {
        return this.#_envelope;
    }
}

export default DataEnvelope;