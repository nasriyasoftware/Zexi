import terminalStreams from "./streams";

/**
 * Exposes the configured terminal streams and stream-related types.
 *
 * Consumers should use the exported singleton's getters and captured writing
 * context rather than mutate process stream methods directly.
 *
 * @since 1.0.0
 */
export * from "./types";

/**
 * The shared process-wide terminal stream manager.
 *
 * @since 1.0.0
 */
export { terminalStreams };
export default terminalStreams;