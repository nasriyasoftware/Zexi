/**
 * Node.js standard-output stream type used by terminal I/O.
 *
 * @since 1.0.0
 */
export type StdoutStream = typeof process.stdout;

/**
 * Node.js standard-error stream type used by terminal I/O.
 *
 * @since 1.0.0
 */
export type StderrStream = typeof process.stderr;

/**
 * Node.js standard-input stream type used by terminal I/O.
 *
 * @since 1.0.0
 */
export type StdinStream = typeof process.stdin;

/**
 * Standard output or standard error stream provided by the Node.js process.
 *
 * Represents either `process.stdout` or `process.stderr`, preserving the
 * respective stream's native type and supported write and terminal-control
 * operations.
 *
 * @since 1.0.0
 */
export type ProcessStdWriteStream = StdoutStream | StderrStream;