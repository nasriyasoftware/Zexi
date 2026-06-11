import BaseToken from "../assets/__base.token__";
import type FunctionRepresentationNode from "../../../2-representation/nodes/function.node";

/**
 * Semantic token representing a JavaScript function value.
 *
 * `FunctionToken` preserves the semantic identity of a runtime
 * JavaScript function during the tokenization phase without converting
 * it into a textual representation prematurely.
 *
 * The token encapsulates the original runtime function reference,
 * allowing renderers to decide how executable values should appear.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `FunctionToken` belongs to the semantic tokenization layer.
 *
 * Rendering pipeline placement:
 *
 * ```text
 * JavaScript Function
 *        ↓
 * Graphing
 *        ↓
 * FunctionGraphNode
 *        ↓
 * Representation
 *        ↓
 * FunctionRepresentationNode
 *        ↓
 * Tokenization
 *        ↓
 * FunctionToken
 *        ↓
 * Rendering
 * ```
 *
 * This token represents executable runtime semantics,
 * not visual formatting.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The token exists to preserve:
 *
 * - runtime function identity
 * - renderer-controlled formatting
 * - executable value semantics
 *
 * without immediately serializing functions into strings.
 *
 * This allows renderers to:
 *
 * - display function names
 * - render async/generator modifiers
 * - inspect signatures
 * - display native function markers
 * - apply syntax highlighting
 * - support compact or expanded function views
 *
 * ---------------------------------------------------------------------
 * 🔷 FUNCTION SEMANTICS
 * ---------------------------------------------------------------------
 *
 * The token stores the original runtime `Function` object directly.
 *
 * This enables renderers to inspect:
 *
 * - `name`
 * - `length`
 * - `constructor`
 * - source code
 * - async/generator state
 *
 * if desired.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `FunctionToken` does NOT define how functions should appear visually.
 *
 * Renderers are responsible for:
 *
 * - source formatting
 * - syntax styling
 * - multiline expansion
 * - truncation behavior
 * - native function formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY MODEL
 * ---------------------------------------------------------------------
 *
 * The underlying function reference is immutable after token creation.
 *
 * The token itself does not modify or invoke the function.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKENIZATION SOURCE
 * ---------------------------------------------------------------------
 *
 * `FunctionToken` instances are typically created via:
 *
 * - `FunctionToken.from(node)`
 *
 * using a `FunctionRepresentationNode` generated during the
 * representation phase.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class FunctionToken extends BaseToken<'function'> {
    /**
     * Underlying runtime JavaScript function reference.
     *
     * @since 1.0.0
     */
    readonly #_value: Function;

    /**
     * Creates a new semantic function token.
     *
     * @param value - Runtime JavaScript function
     *
     * @since 1.0.0
     */
    constructor(value: Function) {
        super('function');
        this.#_value = value;
    }

    /**
     * Returns the underlying runtime function reference.
     *
     * Renderers may inspect this value to:
     *
     * - extract function names
     * - inspect signatures
     * - detect async/generator functions
     * - render source previews
     * - apply executable-specific formatting
     *
     * @returns Runtime function reference
     *
     * @since 1.0.0
     */
    get value() {
        return this.#_value;
    }
    
    /**
     * Creates a `FunctionToken` from a `FunctionRepresentationNode`.
     *
     * This method bridges:
     *
     * - representation normalization
     * - semantic tokenization
     *
     * @param node - Representation node containing a function value
     * @returns A new `FunctionToken` instance
     *
     * @since 1.0.0
     */
    static from(node: FunctionRepresentationNode) {
        return new FunctionToken(node.value);
    }
}