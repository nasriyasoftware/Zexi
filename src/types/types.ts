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