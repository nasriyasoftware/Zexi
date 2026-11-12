import terminalIO from "./terminal.io.v2";

/**
 * Exposes the process-wide terminal I/O coordinator.
 *
 * The coordinator composes input, output, screen selection, terminal-size
 * tracking, and initialization. Importing this module returns the same
 * instance used by the terminal API and renderer rather than creating a
 * separate controller.
 *
 * The responsibility-specific operations are available through the
 * coordinator's `input` and `output` properties. This module also re-exports
 * the terminal I/O event, stream, screen, and size-detector types.
 *
 * @since 1.0.0
 */
export * from './shared/screen';
export * from './shared/streams';
export * from './shared/size.detector';

export * from './input/types';
export * from './output/types';

/**
 * The `ZexiTerminalIO` constructor for explicitly typed integrations.
 *
 * Prefer the process-wide default export for normal terminal operations.
 *
 * @since 1.0.0
 */
export { ZexiTerminalIO } from "./terminal.io.v2";

/**
 * The process-wide terminal I/O coordinator.
 *
 * @since 1.0.0
 */
export default terminalIO;