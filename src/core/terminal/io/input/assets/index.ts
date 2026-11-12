import TextInputCapture from "./capture/text.input.capture";
import stdinController from "./controller/stdin.controller";

/**
 * Exposes the stdin controller, managed text capture, and input asset types.
 *
 * These assets are composed by the input I/O module; application-facing
 * callers should generally use that module's session and capture methods.
 *
 * @since 1.0.0
 */
export * from './types';

/**
 * Shared stdin controller and managed text-capture implementation.
 *
 * @internal
 * @since 1.0.0
 */
export {
    stdinController,
    TextInputCapture
};