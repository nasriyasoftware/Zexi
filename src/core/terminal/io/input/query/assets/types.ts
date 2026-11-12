/**
 * Internal callback that performs cleanup and settles a query promise once.
 * The status parameter determines whether `value` is a resolved value or a
 * rejection reason.
 *
 * @since 1.0.0
 */
export type SettleHandler<T> = <S extends 'resolve' | 'reject'>(
    status: S,
    value: S extends 'resolve' ? T : unknown
) => Promise<void>;

/**
 * Parses one stdin data chunk and resolves when a complete response is found.
 *
 * A handler is synchronous: it may maintain its own accumulator across calls,
 * but it must call `resolve` only after it has parsed a complete value. Throwing
 * from the handler causes the active query to reject.
 *
 * @since 1.0.0
 */
export type QueryHandler<T> = (data: Buffer, resolve: (value: T) => void) => void;

/**
 * Configuration required to bind a terminal request to its response parser.
 *
 * @since 1.0.0
 */
export interface QueryDispatchConfig<T> {
    /**
     * Bytes written to the terminal to request the information.
     * @since 1.0.0
     */
    query: string | Uint8Array;

    /**
     * Parser invoked for each raw stdin data chunk during the request.
     * @since 1.0.0
     */
    handler: QueryHandler<T>;

    /**
     * Human-readable operation name used in timeout and TTY errors.
     * @since 1.0.0
     */
    description: string;

    /**
     * Response wait timeout in milliseconds; defaults to `1000`.
     * @since 1.0.0
     */
    timeout?: number;
}

/**
 * Promise and settlement callbacks for one active dispatcher request.
 *
 * @since 1.0.0
 */
export interface Settler<T> {
    /**
     * Promise returned to the caller of {@link QueryDispatcher.dispatch}.
     * @since 1.0.0
     */
    promise: Promise<T>;

    /**
     * Resolves the request after terminal cleanup completes.
     * @since 1.0.0
     */
    resolve: (value: T) => void;

    /**
     * Rejects the request after terminal cleanup completes.
     * @since 1.0.0
     */
    reject: (error: unknown) => void;
}