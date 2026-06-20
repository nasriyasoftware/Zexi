import { DeepReadonly } from "../types/types";

/**
 * No-operation function.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * A reusable function that intentionally performs no work.
 *
 * Common use cases include:
 *
 * - default callbacks
 * - placeholder implementations
 * - optional event handlers
 * - testing and mocking
 *
 * ---------------------------------------------------------------------
 * 🔷 BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - accepts no arguments
 * - produces no side effects
 * - returns `undefined`
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * Reusing a shared noop function avoids unnecessary allocation of
 * anonymous empty functions throughout the codebase.
 *
 * @returns
 * `undefined`
 *
 * @since 1.0.0
 */
export function noop() { }

/**
 * Determines whether a value is a plain JavaScript record object.
 *
 * ---------------------------------------------------------------------
 * 🔷 RECORD DEFINITION
 * ---------------------------------------------------------------------
 *
 * A value is considered a record when:
 *
 * - it is an object
 * - it is not `null`
 * - it is not an array
 * - it is not a Set
 * - it is not a Map
 * - it is not a Date
 * - it is not a RegExp
 * - its prototype is exactly `Object.prototype`
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLES
 * ---------------------------------------------------------------------
 *
 * ```ts
 * isRecord({});            // true
 * isRecord({ a: 1 });      // true
 *
 * isRecord([]);            // false
 * isRecord(new Set());     // false
 * isRecord(new Map());     // false
 * isRecord(new Date());    // false
 * isRecord(null);          // false
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This utility intentionally excludes special object types because they
 * possess behavior beyond plain key-value storage.
 *
 * It is commonly used as a safe guard before performing:
 *
 * - property inspection
 * - structural traversal
 * - serialization logic
 *
 * @template T
 * Value type of record properties.
 *
 * @param value
 * Value to inspect.
 *
 * @returns
 * `true` if the value is a plain record object.
 *
 * @since 1.0.0
 */
export function isRecord<T = unknown>(value: unknown): value is Record<string, T> {
    return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map) &&
        !(value instanceof Date) &&
        !(value instanceof RegExp) &&
        Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Determines whether a record directly owns a property.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Type-safe wrapper around:
 *
 * ```ts
 * Object.prototype.hasOwnProperty.call(...)
 * ```
 *
 * Provides:
 *
 * - prototype-safe property checks
 * - proper TypeScript narrowing
 * - protection against overridden `hasOwnProperty`
 *
 * ---------------------------------------------------------------------
 * 🔷 OWNERSHIP RULES
 * ---------------------------------------------------------------------
 *
 * Returns `true` only when:
 *
 * - the object directly defines the property
 * - the property is NOT inherited through the prototype chain
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * const user = {
 *     name: 'John'
 * };
 *
 * if (hasOwnProp(user, 'name')) {
 *     // narrowed to keyof typeof user
 * }
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This helper should be preferred over:
 *
 * ```ts
 * obj.hasOwnProperty(...)
 * ```
 *
 * because objects may:
 *
 * - override the method
 * - lack the method entirely
 * - originate from a null prototype
 *
 * @template T
 * Record type being inspected.
 *
 * @param obj
 * Target object.
 *
 * @param prop
 * Property name to test.
 *
 * @returns
 * `true` if the property exists directly on the object.
 *
 * @since 1.0.0
 */
export function hasOwnProp<T extends Record<string, any>>(
    obj: T,
    prop: keyof T | (string & {})
): prop is keyof T {
    if (!isRecord(obj)) return false;
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

/**
 * Freezes an object, making its own properties immutable.
 *
 * ---------------------------------------------------------------------
 * 🔷 BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * This is a thin wrapper around `Object.freeze()` that provides:
 *
 * - runtime validation
 * - improved type inference
 * - consistent error semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 FREEZE SEMANTICS
 * ---------------------------------------------------------------------
 *
 * After freezing:
 *
 * - new properties cannot be added
 * - existing properties cannot be removed
 * - existing properties cannot be reassigned
 *
 * Nested objects remain mutable.
 *
 * Example:
 *
 * ```ts
 * const obj = freeze({
 *     user: {
 *         name: 'John'
 *     }
 * });
 *
 * obj.user.name = 'Jane'; // Allowed
 * obj.user = {};          // Not allowed
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This function performs a shallow freeze only.
 *
 * To recursively freeze an entire object graph, use `deepFreeze()`.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDEMPOTENCY
 * ---------------------------------------------------------------------
 *
 * Calling `freeze()` on an already frozen object returns the same object.
 *
 * @template T
 * Object type to freeze.
 *
 * @param obj
 * Object instance to freeze.
 *
 * @returns
 * Frozen object with readonly typing.
 *
 * @throws {TypeError}
 * If the provided value is not an object.
 *
 * @since 1.0.0
 */
export function freeze<T extends object>(obj: T): Readonly<T> {
    const isObject = obj && typeof obj === 'object';
    if (!isObject) { throw new TypeError(`Expected an object but received ${typeof obj}`); }

    return Object.isFrozen(obj) ? obj : Object.freeze(obj);
}

/**
 * Recursively freezes an object graph.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Applies runtime immutability to:
 *
 * - objects
 * - nested objects
 * - arrays
 * - objects contained within arrays
 *
 * Every reachable object node is frozen before the function returns.
 *
 * ---------------------------------------------------------------------
 * 🔷 FREEZE STRATEGY
 * ---------------------------------------------------------------------
 *
 * 1. Freeze current object
 * 2. Traverse child values
 * 3. Recursively freeze nested objects
 * 4. Return original reference
 *
 * ---------------------------------------------------------------------
 * 🔷 ARRAY HANDLING
 * ---------------------------------------------------------------------
 *
 * Arrays are frozen and each object element is recursively frozen.
 *
 * Primitive elements are ignored because they are already immutable.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * const config = deepFreeze({
 *     app: {
 *         theme: 'dark'
 *     }
 * });
 *
 * config.app.theme = 'light'; // Runtime error (strict mode)
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 CYCLE SAFETY
 * ---------------------------------------------------------------------
 *
 * This implementation assumes an acyclic object graph.
 *
 * Cyclic references may cause infinite recursion and stack overflow.
 *
 * Objects containing cycles should be normalized before calling
 * `deepFreeze()`.
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN TYPE
 * ---------------------------------------------------------------------
 *
 * Returns the original object reference while exposing a
 * `DeepReadonly<T>` view at the type level.
 *
 * @template T
 * Object type to recursively freeze.
 *
 * @param obj
 * Object graph to freeze.
 *
 * @returns
 * Deeply frozen immutable object.
 *
 * @throws {TypeError}
 * If the provided value is not an object.
 *
 * @since 1.0.0
 */
export function deepFreeze<T extends object>(obj: T): DeepReadonly<T> {
    if (!obj) { throw new TypeError(`Expected an object but received ${typeof obj}`); }
    freeze(obj);

    if (Array.isArray(obj)) {
        for (const item of obj.filter(i => i && typeof i === 'object')) {
            deepFreeze(item);
        }
    } else {
        const keys = Object.keys(obj) as unknown as (readonly (keyof T)[]);
        for (const key of keys) {
            const value = obj[key];
            if (typeof value !== 'object') {
                continue;
            }

            deepFreeze(value as object);
        }
    }

    return obj as DeepReadonly<T>;
}