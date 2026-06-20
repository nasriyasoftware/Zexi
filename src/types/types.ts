declare const brand: unique symbol;
/**
 * Creates a *branded* version of a base type, allowing nominal typing in TypeScript.
 *
 * By default, TypeScript uses *structural typing*, which means types with the same shape are considered interchangeable.
 * `Brand<T, B>` allows you to distinguish between otherwise identical types by attaching a unique hidden "brand" to the type.
 *
 * This is useful for creating safer APIs where different domains use the same primitive types (like `string` or `number`)
 * but should not be mixed up unintentionally.
 *
 * @template T - The base type to brand (e.g. `string`, `number`, etc).
 * @template Brand - A string literal representing the brand (e.g. `'UserId'`, `'FilePath'`).
 *
 * @example
 * ```ts
 * type UserId = Brand<string, 'UserId'>;
 * type PostId = Brand<string, 'PostId'>;
 *
 * function getUser(id: UserId) { ... }
 *
 * const userId = 'abc123' as UserId;
 * const postId = 'xyz789' as PostId;
 *
 * getUser(userId); // ✅ OK
 * getUser(postId); // ❌ Type error: PostId is not assignable to UserId
 * ```
 *
 * @example
 * ```ts
 * // Branded number
 * type Milliseconds = Brand<number, 'Milliseconds'>;
 * type Seconds = Brand<number, 'Seconds'>;
 *
 * const wait = (ms: Milliseconds) => { ... };
 * wait(5000 as Milliseconds); // ✅
 * wait(5 as Seconds);         // ❌ Compile error
 * ```
 *
 * @note This has no runtime effect. The brand is erased in the compiled JavaScript.
 */
export type Brand<T, Brand extends string> = T & { [brand]: Brand };

/**
 * Recursively converts a type into a deeply immutable form.
 *
 * ---------------------------------------------------------------------
 * 🔷 TRANSFORMATION RULES
 * ---------------------------------------------------------------------
 *
 * The transformation is applied recursively according to the following
 * rules:
 *
 * 1. Functions
 *    - Preserved as-is
 *    - Function signatures remain callable
 *    - No wrapping or mutation occurs
 *
 * 2. Arrays
 *    - Converted to `ReadonlyArray`
 *    - Element types are recursively transformed
 *
 * 3. Objects
 *    - All properties become `readonly`
 *    - Nested properties are recursively transformed
 *
 * 4. Primitives
 *    - Preserved without modification
 *
 * ---------------------------------------------------------------------
 * 🔷 EXAMPLE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * interface User {
 *     name: string;
 *     settings: {
 *         theme: string;
 *     };
 * }
 *
 * type FrozenUser = DeepReadonly<User>;
 * ```
 *
 * Produces:
 *
 * ```ts
 * {
 *     readonly name: string;
 *     readonly settings: {
 *         readonly theme: string;
 *     };
 * }
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTE
 * ---------------------------------------------------------------------
 *
 * This utility provides compile-time immutability only.
 *
 * It does NOT freeze values at runtime.
 * Use `deepFreeze()` when runtime immutability is required.
 *
 * @template T
 * Type to transform.
 *
 * @since 1.0.0
 */
export type DeepReadonly<T> = {
    readonly [P in keyof T]: T[P] extends (...args: any[]) => any
    ? T[P] // Functions stay callable (not made readonly)
    : T[P] extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>> // Recursively readonly arrays
    : T[P] extends object
    ? DeepReadonly<T[P]> // Recursively readonly objects
    : T[P]; // Primitives remain as-is
};