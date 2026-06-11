import type { PropertyKind } from "../nodes/assets/property.node";

/**
 * ---------------------------------------------------------------------
 * 🔷 PROPERTY KEY TYPE ALIAS
 * ---------------------------------------------------------------------
 *
 * Represents all valid JavaScript property keys.
 *
 * JavaScript objects support two fundamental key types:
 *
 * ### string keys
 * Standard object property names.
 *
 * ```ts
 * "foo"
 * "bar"
 * ```
 *
 * ---
 *
 * ### symbol keys
 * Unique runtime identifiers used to avoid naming collisions.
 *
 * ```ts
 * Symbol("id")
 * Symbol.iterator
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * `PropertyKey` is used to unify both key types under a single
 * abstraction for:
 *
 * - property enumeration
 * - deduplication tracking
 * - prototype traversal consistency
 *
 * It preserves the native JavaScript property key model without
 * losing type information at runtime.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
type PropertyKey = string | symbol;

/**
 * ---------------------------------------------------------------------
 * 🔷 PROPERTY ENTRY MODEL
 * ---------------------------------------------------------------------
 *
 * `PropEntry` is the normalized representation of a single
 * extracted property from a JavaScript object.
 *
 * It is the intermediate structural format used before graph
 * construction.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Each `PropEntry` represents a fully resolved property including:
 *
 * - its name (stringified key)
 * - its semantic classification (kind)
 * - its runtime value
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
interface PropEntry {
    /**
     * -----------------------------------------------------------------
     * 🔹 PROPERTY NAME
     * -----------------------------------------------------------------
     *
     * String representation of the property key.
     *
     * This field normalizes both:
     *
     * - string keys → unchanged
     * - symbol keys → stringified form (Symbol(...))
     *
     * -----------------------------------------------------------------
     * NOTE
     * -----------------------------------------------------------------
     *
     * This field is intentionally string-based for:
     *
     * - deterministic sorting
     * - serialization compatibility
     * - graph label consistency
     * ---------------------------------------------------------------------
     * @since 1.0.0 
     */
    name: string;

    /**
     * -----------------------------------------------------------------
     * 🔹 PROPERTY KIND
     * -----------------------------------------------------------------
     *
     * Semantic classification of the property.
     *
     * Possible values:
     *
     * - `property`
     * - `getter`
     * - `setter`
     * - `method`
     *
     * -----------------------------------------------------------------
     * SEMANTIC RULES
     * -----------------------------------------------------------------
     *
     * - `getter` / `setter` come from property descriptors
     * - `method` is determined via function source syntax analysis
     * - `property` is the default fallback category
     * ---------------------------------------------------------------------
     * @since 1.0.0 
     */
    kind: PropertyKind;

    /**
     * -----------------------------------------------------------------
     * 🔹 PROPERTY VALUE
     * -----------------------------------------------------------------
     *
     * Raw runtime value associated with the property.
     *
     * This may be:
     *
     * - primitive values (string, number, boolean, etc.)
     * - objects
     * - functions
     * - getters/setters (function references)
     *
     * -----------------------------------------------------------------
     * IMPORTANT
     * -----------------------------------------------------------------
     *
     * No transformation is applied at this stage.
     * Values are preserved exactly as retrieved from runtime.
     * ---------------------------------------------------------------------
     * @since 1.0.0 
     *
     */
    value: unknown;
}

/**
 * ---------------------------------------------------------------------
 * 🔷 PROPS EXTRACTION ENGINE (RUNTIME REFLECTION LAYER)
 * ---------------------------------------------------------------------
 *
 * `PropsExtractor` is a deterministic runtime reflection system that
 * converts JavaScript objects into a normalized property metadata
 * structure (`PropEntry[]`) suitable for downstream graph construction.
 *
 * It operates as a LOW-LEVEL INTROSPECTION MODULE that bridges raw
 * JavaScript runtime structures and the graph normalization layer.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURE ROLE
 * ---------------------------------------------------------------------
 *
 * This module represents the PROTOTYPE-AWARE PROPERTY DISCOVERY PHASE
 * of the graph pipeline.
 *
 * ```text
 * JavaScript Runtime Object
 *              ↓
 * PropsExtractor (this module)
 *              ↓
 * PropEntry[] (normalized property model)
 *              ↓
 * GraphBuilder
 *              ↓
 * GraphNode system
 *              ↓
 * Representation layer
 *              ↓
 * Tokenization / Rendering
 *              ↓
 * Output
 * ```
 *
 * It is strictly a PRE-NODE CONSTRUCTION phase and does NOT perform
 * any graph creation or identity management.
 *
 * ---------------------------------------------------------------------
 * 🔷 RESPONSIBILITY BOUNDARY
 * ---------------------------------------------------------------------
 *
 * This module is responsible ONLY for:
 *
 * - runtime property enumeration
 * - descriptor resolution via reflection APIs
 * - prototype chain traversal (excluding Object.prototype)
 * - getter / setter detection
 * - function classification (method vs property)
 * - symbol + string key support
 * - duplicate suppression across inheritance chain
 * - canonical sorting (optional deterministic output)
 *
 * It explicitly does NOT handle:
 *
 * - graph node creation
 * - structural identity tracking
 * - rendering or serialization
 * - recursive value traversal
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLES
 * ---------------------------------------------------------------------
 *
 * ### 1. Reflection-first model
 * Uses runtime descriptor APIs rather than static analysis.
 *
 * ### 2. Prototype-aware flattening
 * Treats prototype chain as a unified property surface.
 *
 * ### 3. First-seen precedence
 * Shadowed properties are ignored once encountered.
 *
 * ### 4. Lossless value capture
 * Property values are preserved without transformation.
 *
 * ### 5. Heuristic method classification
 * Function classification relies on syntactic inference via
 * function source inspection.
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE MODEL
 * ---------------------------------------------------------------------
 *
 * The extractor is stateful per instance due to:
 *
 * - `#_seen` → duplicate suppression registry
 * - `#_props` → accumulation buffer
 * - `#_originalTarget` → classification anchor reference
 *
 * Each extraction run must use an isolated instance.
 *
 * ---------------------------------------------------------------------
 * 🔷 PROTOTYPE RESOLUTION MODEL
 * ---------------------------------------------------------------------
 *
 * Properties are collected from:
 *
 * 1. The target object itself
 * 2. Each prototype in the chain
 *
 * Traversal stops at:
 *
 * ```ts
 * Object.prototype
 * ```
 *
 * This ensures:
 *
 * - exclusion of built-in base object noise
 * - bounded traversal depth
 * - predictable inheritance scope
 *
 * ---------------------------------------------------------------------
 * 🔷 PROPERTY SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Each extracted property is normalized into a `PropEntry`.
 *
 * The system distinguishes four semantic categories:
 *
 * - `property` → default data field
 * - `getter`   → accessor getter
 * - `setter`   → accessor setter
 * - `method`   → syntactically detected function method
 *
 * Method classification is based on:
 *
 * - function source structure (`toString()`)
 * - syntactic method pattern detection
 *
 * NOT on runtime prototype origin or binding context.
 *
 * ---------------------------------------------------------------------
 * 🔷 DUPLICATION MODEL
 * ---------------------------------------------------------------------
 *
 * A global `seen` set ensures uniqueness across the full prototype
 * chain traversal.
 *
 * Keys tracked:
 *
 * ```ts
 * string | symbol
 * ```
 *
 * First occurrence wins:
 *
 * - own properties override prototype properties
 * - shadowed prototype entries are ignored
 *
 * ---------------------------------------------------------------------
 * 🔷 CANONICAL MODE
 * ---------------------------------------------------------------------
 *
 * When enabled, output is sorted lexicographically by property name.
 *
 * This ensures:
 *
 * - deterministic ordering
 * - stable serialization output
 * - reproducible graph construction input
 *
 * Canonical mode does NOT affect:
 *
 * - traversal behavior
 * - classification logic
 * - duplicate suppression rules
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT CONTRACT
 * ---------------------------------------------------------------------
 *
 * The result is a flat array of `PropEntry` objects representing:
 *
 * - own properties
 * - inherited prototype properties
 * - accessor descriptors
 * - function-valued properties
 *
 * Prototype hierarchy is NOT preserved in output structure.
 *
 * ---------------------------------------------------------------------
 * 🔷 INTENDED CONSUMERS
 * ---------------------------------------------------------------------
 *
 * Output is designed for consumption by:
 *
 * - GraphBuilder (primary consumer)
 * - inspection/debug tools
 * - structural analyzers
 * - runtime introspection utilities
 *
 * ---------------------------------------------------------------------
 * 🔷 THREAD MODEL
 * ---------------------------------------------------------------------
 *
 * Instances are NOT thread-safe due to internal mutation state.
 *
 * Safe usage pattern:
 *
 * - one instance per extraction operation
 * - static `extract()` ensures isolation per call
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class PropsExtractor {
    /**
     * -----------------------------------------------------------------
     * 🔹 SEEN PROPERTY TRACKER
     * -----------------------------------------------------------------
     *
     * Tracks all encountered property keys during traversal.
     *
     * Purpose:
     *
     * - prevent duplicate emissions across prototype chain
     * - enforce first-seen priority semantics
     *
     * -----------------------------------------------------------------
     * KEY TYPE
     * -----------------------------------------------------------------
     *
     * Stores raw `PropertyKey` values:
     *
     * - string
     * - symbol
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_seen = new Set<PropertyKey>();

    /**
     * -----------------------------------------------------------------
     * 🔹 EXTRACTED PROPERTY BUFFER
     * -----------------------------------------------------------------
     *
     * Accumulates all extracted property entries during traversal.
     *
     * This array is later returned as the final output of extraction.
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    readonly #_props: PropEntry[] = [];

    /**
     * -----------------------------------------------------------------
     * 🔹 ORIGINAL TARGET REFERENCE
     * -----------------------------------------------------------------
     *
     * Stores the root object passed to `extract()`.
     *
     * This reference is used for:
     *
     * - distinguishing instance-level vs prototype-level evaluation
     * - method classification heuristics
     *
     * -----------------------------------------------------------------
     * IMPORTANT
     * -----------------------------------------------------------------
     *
     * This is NOT used for identity tracking or graph construction.
     * It is purely a classification reference point.
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    #_originalTarget?: object;

    /**
     * -----------------------------------------------------------------
     * 🔹 TARGET PROCESSOR
     * -----------------------------------------------------------------
     *
     * Processes a single object in the prototype chain and extracts
     * all of its own properties via descriptor inspection.
     *
     * -----------------------------------------------------------------
     * PIPELINE
     * -----------------------------------------------------------------
     *
     * For each property key:
     *
     * 1. Skip constructor (string key only)
     * 2. Skip already-seen properties
     * 3. Resolve property descriptor
     * 4. Detect getter/setter/value
     * 5. Classify value if function
     * 6. Emit PropEntry
     *
     * -----------------------------------------------------------------
     * FUNCTION CLASSIFICATION MODEL
     * -----------------------------------------------------------------
     *
     * If a property value is a function:
     *
     * - It is classified as `method` if it matches method syntax
     *   via function source inspection
     *
     * - Otherwise it is classified as `property`
     *
     * This allows distinction between:
     *
     * - method declarations (`foo() {}`)
     * - function-valued fields (`foo: function() {}`)
     * - arrow functions (`foo: () => {}`)
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    #_processTarget(target: object): void {
        const seen = this.#_seen;
        const props = this.#_props;

        const keys = [
            ...Object.getOwnPropertyNames(target),
            ...Object.getOwnPropertySymbols(target) as any,
        ];

        for (const key of keys) {
            if (
                (typeof key === 'string' && key === 'constructor') ||
                seen.has(key)
            ) continue;

            const desc = Object.getOwnPropertyDescriptor(target, key);
            if (!desc) continue;

            seen.add(key);

            const isGetter = typeof desc.get === 'function';
            const isSetter = typeof desc.set === 'function';
            const isFunction = typeof desc.value === 'function';

            if (isGetter) {
                props.push({
                    name: String(key),
                    kind: 'getter',
                    value: desc.get
                })
            }

            if (isSetter) {
                props.push({
                    name: String(key),
                    kind: 'setter',
                    value: desc.set
                })
            }

            if ('value' in desc) {
                let kind: PropertyKind = 'property';
                if (isFunction) {
                    const fn = desc.value as Function;
                    const fnStr = fn.toString();
                    const isArrowFn = fnStr.includes('=>');

                    if (!isArrowFn) {
                        // Shorthand methods: "methodName() {...}"
                        // NOT: "function() {...}" or "function name() {...}"
                        const isShorthandMethod = /^\w+\s*\(/.test(fnStr) && !fnStr.startsWith('function');
                        kind = isShorthandMethod || target !== this.#_originalTarget ? 'method' : 'property';
                    }
                }

                props.push({
                    name: String(key),
                    kind,
                    value: desc.value
                })
            }
        }
    }

    /**
     * -----------------------------------------------------------------
     * 🔷 STATIC EXTRACTION ENTRYPOINT
     * -----------------------------------------------------------------
     *
     * Primary public API for property extraction.
     *
     * Creates an isolated extractor instance and performs:
     *
     * 1. extraction of root object
     * 2. traversal of prototype chain (excluding Object.prototype)
     * 3. optional canonical sorting
     *
     * -----------------------------------------------------------------
     * PARAMETERS
     * -----------------------------------------------------------------
     *
     * @param target
     * Root object to extract properties from.
     *
     * @param options
     * Extraction configuration options.
     *
     * @param options.canonical
     * If true, sorts all extracted properties lexicographically
     * by name for deterministic output.
     *
     * -----------------------------------------------------------------
     * OUTPUT
     * -----------------------------------------------------------------
     *
     * Returns a flat list of `PropEntry` objects representing:
     *
     * - own properties
     * - inherited prototype properties
     * - getters/setters
     * - method-classified functions
     * -----------------------------------------------------------------
     * @since 1.0.0
     */
    static extract(target: object, options?: { canonical?: boolean }): PropEntry[] {
        const extractor = new PropsExtractor();
        extractor.#_originalTarget = target;

        // own properties
        extractor.#_processTarget(target);

        // prototype chain
        let proto = Object.getPrototypeOf(target);

        while (proto && proto !== Object.prototype) {
            extractor.#_processTarget(proto);
            proto = Object.getPrototypeOf(proto);
        }

        const props = extractor.#_props;

        if (options?.canonical === true) {
            props.sort((a, b) => {
                if (a.name < b.name) return -1;
                if (a.name > b.name) return 1;
                return 0;
            });
        }

        return props;
    }
}

export default PropsExtractor;