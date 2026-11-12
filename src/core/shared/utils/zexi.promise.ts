/**
 * Provides a promise together with explicit controls for settling it and
 * inspecting its settlement state.
 *
 * Each instance maintains a unique identifier, a promise created with
 * `Promise.withResolvers()`, and flags describing how the promise has been
 * settled. The promise can be resolved or rejected at most once. Subsequent
 * attempts to settle it are ignored.
 *
 * This helper is intended for internal asynchronous workflows that need to
 * identify a task and settle its promise from separate code paths.
 *
 * ---------------------------------------------------------------------
 * 🔷 PROMISE LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * The promise remains pending until either `resolve()` or `reject()` is called.
 *
 * Once settled:
 *
 * - The corresponding settlement flag is set to `true`.
 * - The `settled` flag is set to `true`.
 * - The associated promise is resolved or rejected.
 * - Further attempts to settle the promise have no effect.
 *
 * The settlement flags describe the action taken to settle the promise. They
 * do not indicate whether the promise's fulfillment or rejection handlers have
 * finished executing.
 *
 * ---------------------------------------------------------------------
 * 🔷 IDENTIFICATION
 * ---------------------------------------------------------------------
 *
 * Each instance receives a unique `Symbol` identifier.
 *
 * The identifier can be used to associate an asynchronous task with its
 * corresponding promise and distinguish it from other instances.
 *
 * ---------------------------------------------------------------------
 * 🔷 SETTLEMENT STATE
 * ---------------------------------------------------------------------
 *
 * The instance exposes three read-only state indicators:
 *
 * - `resolved` indicates whether `resolve()` successfully settled the promise.
 * - `rejected` indicates whether `reject()` successfully settled the promise.
 * - `settled` indicates whether either settlement operation has completed.
 *
 * These indicators are mutually consistent: once `settled` becomes `true`,
 * exactly one of `resolved` or `rejected` is `true`.
 *
 * ---------------------------------------------------------------------
 * 🔷 RETURN VALUE
 * ---------------------------------------------------------------------
 *
 * The `promise` getter exposes the underlying promise created by
 * `Promise.withResolvers()`.
 *
 * Its fulfillment value is determined by the generic type parameter `T`.
 *
 * @typeParam T - Value produced when the promise resolves. Defaults to `void`.
 *
 * @since 1.0.0
 */
class ZexiPromise<T extends unknown = void> {
    /**
     * Unique identifier assigned to this promise instance.
     *
     * The identifier is generated when the instance is created and remains
     * unchanged throughout its lifetime.
     *
     * @since 1.0.0
     */
    readonly #_id = Symbol();

    /**
     * Promise controller providing the promise and its settlement functions.
     *
     * The controller is created once per instance and is used by `resolve()`
     * and `reject()` to settle the associated promise.
     *
     * @since 1.0.0
     */
    readonly #_controller = Promise.withResolvers<T>();

    /**
     * Tracks whether and how the promise has been settled.
     *
     * The flags are updated by the settlement methods before the underlying
     * promise is resolved or rejected. Once the `settled` flag becomes `true`,
     * the settlement state cannot be changed.
     *
     * @since 1.0.0
     */
    readonly #_flags = {
        resolved: false,
        rejected: false,
        settled: false
    }

    /**
     * Gets the unique identifier for this promise instance.
     *
     * @returns The instance identifier.
     *
     * @since 1.0.0
     */
    get id() { return this.#_id; }

    /**
     * Gets the promise controlled by this instance.
     *
     * The returned promise can be observed using standard promise operations.
     * Its settlement is controlled by this instance's `resolve()` and
     * `reject()` methods.
     *
     * @returns The controlled promise.
     *
     * @since 1.0.0
     */
    get promise() { return this.#_controller.promise; }

    /**
     * Indicates whether the promise has been resolved.
     *
     * This flag becomes `true` when `resolve()` successfully settles the
     * promise. It remains `false` if the promise is rejected instead.
     *
     * @returns `true` if resolved; otherwise, `false`.
     *
     * @since 1.0.0
     */
    get resolved() { return this.#_flags.resolved; }

    /**
     * Indicates whether the promise has been rejected.
     *
     * This flag becomes `true` when `reject()` successfully settles the
     * promise. It remains `false` if the promise is resolved instead.
     *
     * @returns `true` if rejected; otherwise, `false`.
     *
     * @since 1.0.0
     */
    get rejected() { return this.#_flags.rejected; }

    /**
     * Indicates whether the promise has been settled.
     *
     * The flag becomes `true` after either `resolve()` or `reject()` successfully
     * settles the promise. Subsequent settlement attempts are ignored.
     *
     * @returns `true` if the promise has been resolved or rejected; otherwise,
     * `false`.
     *
     * @since 1.0.0
     */
    get settled() { return this.#_flags.settled; }

    /**
     * Resolves the promise with the specified value.
     *
     * If the promise has already been settled, this operation has no effect.
     *
     * The settlement flags are updated before the underlying promise is
     * resolved, allowing subsequent calls to inspect the updated state
     * immediately.
     *
     * ---------------------------------------------------------------------
     * 🔷 SETTLEMENT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When called while the promise is pending:
     *
     * - Sets the `resolved` flag to `true`.
     * - Sets the `settled` flag to `true`.
     * - Resolves the underlying promise with the supplied value.
     *
     * If `reject()` has already settled the promise, or a previous call to
     * `resolve()` has already succeeded, the supplied value is ignored.
     *
     * @param value - Value with which to resolve the promise.
     *
     * @since 1.0.0
     */
    readonly resolve = (value: T) => {
        if (this.#_flags.settled) { return; }
        this.#_flags.resolved = true;
        this.#_flags.settled = true;
        this.#_controller.resolve(value);
    }

    /**
     * Rejects the promise with the specified reason.
     *
     * If the promise has already been settled, this operation has no effect.
     *
     * The settlement flags are updated before the underlying promise is
     * rejected, allowing subsequent calls to inspect the updated state
     * immediately.
     *
     * ---------------------------------------------------------------------
     * 🔷 SETTLEMENT BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * When called while the promise is pending:
     *
     * - Sets the `rejected` flag to `true`.
     * - Sets the `settled` flag to `true`.
     * - Rejects the underlying promise with the supplied reason.
     *
     * The rejection reason can be any value, including an `Error` instance.
     * If `resolve()` has already settled the promise, or a previous call to
     * `reject()` has already succeeded, the supplied reason is ignored.
     *
     * @param error - Reason for rejecting the promise.
     *
     * @since 1.0.0
     */
    readonly reject = (error: unknown) => {
        if (this.#_flags.settled) { return; }
        this.#_flags.rejected = true;
        this.#_flags.settled = true;
        this.#_controller.reject(error);
    }
}

export default ZexiPromise;