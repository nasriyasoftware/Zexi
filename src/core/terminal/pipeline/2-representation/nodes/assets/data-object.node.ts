import type { GraphParentNode } from "../../../1-graphing/types";

const tokens = {
    array: '[]',
    set: '()',
    map: '()',
    object: '{}',
    record: '{}',
} satisfies Record<GraphParentNode['type'], string>

/**
 * Abstract base class for structured representation containers.
 *
 * `DataObjectRepresentationNode` defines shared structural metadata
 * for representation nodes that behave like container objects.
 *
 * This includes:
 * - arrays
 * - sets
 * - maps
 * - objects
 * - records
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Representation nodes model semantic rendering structures rather than
 * raw JavaScript runtime objects.
 *
 * Container-like structures share common rendering characteristics:
 * - opening delimiters
 * - closing delimiters
 * - semantic type classification
 * - display naming
 *
 * This base class centralizes that shared behavior.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITIES
 * ---------------------------------------------------------------------
 *
 * Rendering engines use this abstraction to determine:
 *
 * - surrounding structural tokens
 * - layout semantics
 * - object categorization
 *
 * Examples:
 *
 * ```txt
 * Array  → []
 * Object → {}
 * Map    → ()
 * Set    → ()
 * ```
 *
 * The representation node itself does not perform rendering.
 * It only exposes semantic structure metadata.
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN MODEL
 * ---------------------------------------------------------------------
 *
 * Opening and closing delimiters are derived dynamically from the
 * representation type.
 *
 * This allows renderers to:
 * - consistently render containers
 * - swap formatting strategies
 * - serialize generically
 *
 * without hardcoding token logic repeatedly.
 *
 * ---------------------------------------------------------------------
 * 🔷 TYPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The node type is restricted to valid parent graph container types:
 *
 * ```ts
 * GraphParentNode['type']
 * ```
 *
 * ensuring representation containers remain aligned with the graph layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 ABSTRACT ROLE
 * ---------------------------------------------------------------------
 *
 * This class is never instantiated directly.
 *
 * Concrete implementations provide actual container data storage:
 *
 * Examples:
 * - `ObjectRepresentationNode`
 * - `ArrayRepresentationNode`
 * - `SetRepresentationNode`
 * - `MapRepresentationNode`
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY
 * ---------------------------------------------------------------------
 *
 * Structural metadata is immutable after construction.
 *
 * ---------------------------------------------------------------------
 * @abstract
 * @since 1.0.0
 */
abstract class DataObjectRepresentationNode {
    /**
     * Semantic container type.
     *
     * Determines rendering behavior and structural delimiters.
     *
     * @since 1.0.0
     */
    readonly #_type: GraphParentNode['type'];

    /**
     * Human-readable container name.
     *
     * Typically used by renderers for labels and debugging.
     *
     * Examples:
     * - `Array`
     * - `Object`
     * - `Map`
     * - `Set`
     *
     * @since 1.0.0
     */
    readonly #_name: string;

    /**
     * Creates a new structured representation container.
     *
     * @param type - Semantic container classification.
     * @param name - Human-readable container name.
     *
     * @since 1.0.0
     */
    constructor(type: GraphParentNode['type'], name: string) {
        this.#_type = type;
        this.#_name = name;
    }

    /**
     * Semantic container type.
     *
     * @returns Container classification.
     * @since 1.0.0
     */
    get type() { return this.#_type; }

    /**
     * Semantic container type.
     *
     * @returns Container classification.
     * @since 1.0.0
     */
    get name() { return this.#_name; }
    
    /**
     * Opening structural token.
     *
     * Examples:
     * - `{`
     * - `[`
     * - `(`
     *
     * Derived automatically from container type.
     *
     * @returns Opening delimiter token.
     * @since 1.0.0
     */
    get openToken() { return tokens[this.type][0] }

    /**
     * Closing structural token.
     *
     * Examples:
     * - `}`
     * - `]`
     * - `)`
     *
     * Derived automatically from container type.
     *
     * @returns Closing delimiter token.
     * @since 1.0.0
     */
    get closeToken() { return tokens[this.type][1] }
}

export default DataObjectRepresentationNode;