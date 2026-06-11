import BaseToken from "../../assets/__base.token__";

/**
 * Semantic token representing the runtime type/name of an object-like structure.
 *
 * `ObjectNameToken` is used to annotate object-based structures (objects,
 * maps, sets, records, class instances) with a human-readable identifier
 * that describes their constructor or semantic type.
 *
 * This token does NOT affect layout or rendering directly; instead, it
 * provides metadata for renderers to optionally display type information.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * This token belongs to the semantic tokenization layer and represents
 * metadata about a structured value.
 *
 * It is typically emitted for:
 *
 * - plain objects
 * - class instances
 * - Maps / Sets (as logical objects)
 * - record-like structures
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The goal of this token is to preserve:
 *
 * - runtime constructor identity
 * - object classification metadata
 * - optional debug visibility of type names
 *
 * without forcing it into the final rendered output.
 *
 * ---------------------------------------------------------------------
 * 🔷 SPECIAL CASE HANDLING
 * ---------------------------------------------------------------------
 *
 * The class name `"Record"` is treated as an internal abstraction
 * and is intentionally hidden from renderers by returning `undefined`.
 *
 * This allows:
 *
 * - cleaner output for generic record-like structures
 * - avoidance of noise in serialized views
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers may use this token to:
 *
 * - display object type labels (e.g. `Set`, `Map`, `User`)
 * - show debug metadata in expanded mode
 * - hide metadata in compact mode
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class ObjectNameToken extends BaseToken<'object-name'> {
    /**
     * Internal runtime class name of the object.
     *
     * @since 1.0.0
     */
    readonly #_className: string;

    /**
     * Creates a new object name token.
     *
     * @param name - Runtime constructor name or logical object type
     *
     * @since 1.0.0
     */
    constructor(name: string) {
        super('object-name');
        this.#_className = name;
    }

    /**
     * Returns the object class name for rendering purposes.
     *
     * Returns `undefined` when the object is a generic `Record`,
     * as it is treated as a non-visual structural abstraction.
     *
     * @returns Object class name or `undefined` if hidden
     *
     * @since 1.0.0
     */
    get className() {
        return this.#_className === 'Record' ? undefined : this.#_className;
    }
}