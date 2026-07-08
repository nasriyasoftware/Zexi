import { PropertyToken } from "../../../../3-tokenization/tokens/tokenization/property.token";

/**
 * Maintains rendering-time metadata for object serialization
 * during JSON rendering.
 *
 * This cache is used to coordinate structural decisions that cannot
 * be determined purely from token sequence order, such as:
 *
 * - Ignoring properties that should not be rendered
 * - Suppressing trailing separators (commas + line breaks)
 *   for the final visible property in an object
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * Object rendering is token-driven and streaming in nature.
 * However, some formatting decisions require cross-token awareness.
 *
 * This cache provides a scoped coordination layer that:
 *
 * - Tracks which property tokens are explicitly ignored
 * - Marks a single property as responsible for trailing suppression
 * - Enforces invariants to prevent conflicting trailing rules
 *
 * It is strictly tied to a single object scope and is not reusable
 * across unrelated object render operations.
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAILING SUPPRESSION MODEL
 * ---------------------------------------------------------------------
 *
 * Only one property may be designated as responsible for suppressing
 * trailing punctuation at any given time.
 *
 * This ensures that:
 *
 * - Only one comma/line-break correction is applied per object scope
 * - Renderer output remains deterministic
 * - Conflicting formatting corrections are prevented early
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ObjectCache {
    /**
     * Internal registry of property tokens that are excluded from rendering.
     *
     * These properties are identified during object analysis and represent
     * values that should not be emitted into the final output (e.g. undefined,
     * symbol-valued properties, or otherwise non-renderable fields).
     *
     * This set is shared by reference with the object-scanning phase and is
     * expected to remain stable for the lifetime of this cache instance.
     */
    readonly #_ignored: Set<PropertyToken>;

    /**
     * Tracks the single property responsible for suppressing trailing output
     * (comma + optional line break) within the current object scope.
     *
     * This is used to ensure that the last *visible* property does not leave
     * behind invalid JSON separators when ignored properties appear after it
     * in token order.
     *
     * Invariant:
     * - At most one property may be assigned trailing suppression per scope
     *
     * When set, the renderer will skip emitting trailing separators for this
     * property during the final formatting phase.
     */
    #_removeTrailingFrom?: PropertyToken;

    /**
     * Creates a new object rendering cache.
     *
     * The provided set represents properties that should be ignored
     * during rendering (e.g. undefined or symbol-valued properties).
     *
     * @param ignored
     * A set of property tokens marked as ignored for this object scope.
     *
     * @note
     * The set is retained by reference and is expected to be scoped
     * exclusively to this cache instance.
     */
    constructor(ignored: Set<PropertyToken>) {
        this.#_ignored = ignored;
    }

    /**
     * Determines whether a given property token is marked as ignored.
     *
     * Ignored properties are skipped during rendering and do not
     * contribute to structural output (including separators or spacing).
     *
     * @param property
     * The property token to check.
     *
     * @returns
     * `true` if the property is ignored, otherwise `false`.
     *
     * @since 1.0.0
     */
    isIgnored(property: PropertyToken): boolean {
        return this.#_ignored.has(property);
    }

    /**
     * Checks whether the given property is responsible for suppressing
     * trailing punctuation in the current object scope.
     *
     * This is used to ensure that the final visible property does not
     * emit trailing separators such as commas or line breaks.
     *
     * @param property
     * The property token to evaluate.
     *
     * @returns
     * `true` if this property suppresses trailing output, otherwise `false`.
     *
     * @since 1.0.0
     */
    shouldRemoveTrailing(property: PropertyToken): boolean {
        return this.#_removeTrailingFrom === property;
    }

    /**
     * Marks a property as responsible for suppressing trailing output
     * within the current object scope.
     *
     * Only one property may be assigned trailing suppression at a time.
     * Attempting to assign another property before the previous one is
     * resolved will result in an invariant violation.
     *
     * This mechanism ensures deterministic formatting by guaranteeing
     * a single authoritative source for trailing correction.
     *
     * @param property
     * The property token that should suppress trailing output.
     *
     * @throws
     * If another property has already been assigned trailing suppression
     * within this scope.
     *
     * @since 1.0.0
     */
    suppressTrailingOf(property: PropertyToken): void {
        if (this.#_removeTrailingFrom) {
            throw new Error(
                `Invariant violation: Only one property's trailing can be removed at a time. ` +
                `[Current: Kind: ${property.kind}, Name: ${property.value}], ` +
                `[Previous: Kind: ${this.#_removeTrailingFrom.kind}, Name: ${this.#_removeTrailingFrom.value}]`
            );
        }

        this.#_removeTrailingFrom = property;
    }
}

export default ObjectCache;