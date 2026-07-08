import type { AnsiColor, AnsiStyle } from "../../../../styling/types";
import type { AnsiMetaConfig, TokensANSIMap } from "./types";

/**
 * ANSI metadata container attached to individual tokens.
 *
 * This class is responsible for storing and resolving ANSI styling
 * information during the enrichment phase of the rendering pipeline.
 *
 * ---------------------------------------------------------------------
 * 🔷 ROLE IN PIPELINE
 * ---------------------------------------------------------------------
 *
 * ANSI metadata is applied after tokenization and before rendering.
 *
 * It represents *resolved styling decisions* derived from:
 *
 * - traversal context (e.g. maps, errors, groups)
 * - theme defaults
 * - structural overrides
 *
 * Once assigned, values are **write-once** and cannot be overridden.
 *
 * This guarantees deterministic styling behavior across rendering passes.
 *
 * ---------------------------------------------------------------------
 * 🔷 MUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * - Tokens are immutable.
 * - ANSI metadata is mutable only during enrichment.
 * - Each field is resolved at most once (first-write-wins).
 *
 * This ensures that contextual styling (e.g. map key highlighting)
 * is not overridden by later generic token-level styling.
 *
 * ---------------------------------------------------------------------
 * 🔷 STYLE PRECEDENCE RULE
 * ---------------------------------------------------------------------
 *
 * Styling assignment follows strict precedence:
 *
 * 1. First contextual assignment wins
 * 2. Subsequent assignments are ignored
 *
 * This avoids conflicts between overlapping traversal scopes.
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STORAGE MODEL
 * ---------------------------------------------------------------------
 *
 * Internally, metadata tracks:
 *
 * - whether a value has been resolved (`defined`)
 * - the resolved ANSI value
 * - optional debug provenance (`source`)
 *
 * Styles are stored as a Set to guarantee uniqueness.
 *
 * ---------------------------------------------------------------------
 * 🔷 INSPECTION
 * ---------------------------------------------------------------------
 *
 * This class exposes a static inspection API intended for:
 *
 * - testing
 * - debugging
 * - development tooling
 *
 * It returns the internal metadata reference directly.
 *
 * ⚠ This API is not intended for production-side mutation logic.
 *
 * ---------------------------------------------------------------------
 * @internal
 * This class is part of the rendering pipeline implementation and is
 * not part of the public API contract.
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class AnsiMeta {
    /**
     * Internal ANSI metadata state container.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE
     * ---------------------------------------------------------------------
     *
     * This field stores all resolved ANSI styling information for the token.
     *
     * It is mutated only during the enrichment phase and becomes effectively
     * read-only afterward.
     *
     * ---------------------------------------------------------------------
     * 🔷 INVARIANTS
     * ---------------------------------------------------------------------
     *
     * - Each property is resolved at most once
     * - `defined = true` guarantees `value` is present
     * - Styles are deduplicated via Set semantics
     *
     * ---------------------------------------------------------------------
     * 🔷 LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * 1. Initialized with empty unresolved entries
     * 2. Enrichment phase assigns values (first-write-wins)
     * 3. Rendering phase reads only resolved values
     *
     * ---------------------------------------------------------------------
     * 🔷 ENCLOSURE
     * ---------------------------------------------------------------------
     *
     * This field is strictly private and should never be accessed outside
     * of `AnsiMeta`. External access is only permitted via:
     *
     * - getters (`color`, `bgColor`, `styles`)
     * - `AnsiMeta.inspect()` (debug/testing only)
     *
     * @internal
     */
    readonly #_meta: AnsiMetaConfig = {
        color: { defined: false },
        bgColor: { defined: false },
        styles: { defined: false }
    }

    /**
     * Assigns ANSI styling metadata to the token.
     *
     * This method is invoked during the enrichment phase of the pipeline
     * when contextual styling is resolved.
     *
     * ---------------------------------------------------------------------
     * 🔷 BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * - Assignments are write-once per field
     * - Subsequent calls for the same field are ignored
     * - Optional `source` metadata may be attached for debugging
     *
     * ---------------------------------------------------------------------
     * 🔷 STYLE PRECEDENCE
     * ---------------------------------------------------------------------
     *
     * The first resolved style wins. This ensures deterministic behavior
     * when multiple traversal contexts attempt to style the same token.
     *
     * ---------------------------------------------------------------------
     * @param kind - The ANSI property being assigned
     * @param value - The ANSI value or values to apply
     * @param source - Optional provenance identifier for debugging/tracing
     * @since 1.0.0
     */
    assign<T extends keyof TokensANSIMap>(
        kind: T,
        value: TokensANSIMap[T],
        source?: string
    ) {
        switch (kind) {
            case 'color': {
                if (!this.#_meta.color.defined) {
                    this.#_meta.color.defined = true;
                    this.#_meta.color.value = value as AnsiColor;
                    if (source) {
                        this.#_meta.color.source = source;
                    }
                }

                break;
            }

            case 'bgColor': {
                if (!this.#_meta.bgColor.defined) {
                    this.#_meta.bgColor.defined = true;
                    this.#_meta.bgColor.value = value as AnsiColor;
                    if (source) {
                        this.#_meta.bgColor.source = source;
                    }
                }

                break;
            }

            case 'styles': {
                if (!this.#_meta.styles.defined) {
                    this.#_meta.styles.defined = true;
                    const v = value as AnsiStyle | AnsiStyle[];
                    const styles = Array.isArray(v) ? v : [v];

                    this.#_meta.styles.value = new Set(styles);
                }

                break;
            }
        }
    }

    /**
     * Resolved foreground ANSI color.
     *
     * Returns `null` if no color was assigned during enrichment.
     *
     * @since 1.0.0
     */
    get color(): AnsiColor | null {
        return this.#_meta.color.defined
            ? this.#_meta.color.value!
            : null;
    }

    /**
     * Resolved background ANSI color.
     *
     * Returns `null` if no background color was assigned during enrichment.
     *
     * @since 1.0.0
     */
    get bgColor(): AnsiColor | null {
        return this.#_meta.bgColor.defined
            ? this.#_meta.bgColor.value!
            : null;
    }

    /**
     * Resolved ANSI text styles applied to this token.
     *
     * Styles are deduplicated during assignment and returned as an array
     * for consumption by renderers.
     *
     * Returns an empty array if no styles were assigned.
     *
     * @since 1.0.0
     */
    get styles(): AnsiStyle[] {
        return this.#_meta.styles.defined
            ? Array.from(this.#_meta.styles.value!)
            : [];
    }

    /**
     * Internal inspection utility for ANSI metadata.
     *
     * This method returns the raw internal metadata structure associated
     * with the given `AnsiMeta` instance.
     *
     * It is intended exclusively for:
     *
     * - unit testing
     * - debugging tools
     * - development-time inspection
     *
     * ---------------------------------------------------------------------
     * ⚠ IMPORTANT
     * ---------------------------------------------------------------------
     *
     * The returned object is the actual internal reference.
     * Mutating it will directly affect the instance state.
     *
     * This API must not be used in production logic.
     *
     * @param ansiMeta - Instance to inspect
     * @returns Internal metadata reference
     * @throws TypeError if input is not an `AnsiMeta` instance
     * @since 1.0.0
     */
    static inspect(ansiMeta: AnsiMeta) {
        if (!(ansiMeta instanceof AnsiMeta)) {
            throw new TypeError(`Expected \`AnsiMeta\`, received \`${typeof ansiMeta}\``);
        }

        return ansiMeta.#_meta;
    }
}

export default AnsiMeta;