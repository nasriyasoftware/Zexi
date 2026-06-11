import { DEFAULT_OUTPUT_CONFIG } from "../types/types";
import type { TargetConfig } from "../types/types";

/**
 * Resolves the default renderer configuration for a given output target and mode.
 *
 * This function provides the baseline configuration used by the rendering pipeline
 * when no user overrides are supplied.
 *
 * Each output target (`terminal`, `json`, `debug`) has its own independent
 * configuration presets, and each preset may vary depending on the selected mode.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This function exists to:
 *
 * - Provide consistent default configurations per renderer
 * - Normalize configuration selection across the pipeline
 * - Ensure predictable behavior for all output targets
 *
 * It is used internally by the rendering pipeline before applying
 * any user-defined overrides.
 *
 * ---------------------------------------------------------------------
 * 🔷 MODE BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * The `mode` parameter selects the rendering preset:
 *
 * - `pretty` → optimized for readability and structured inspection
 * - `compact` → optimized for density and minimal output size
 *
 * Each renderer may interpret these modes differently depending on its
 * output characteristics.
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT TARGETS
 * ---------------------------------------------------------------------
 *
 * Supported targets:
 *
 * - `terminal` → human-readable console output
 * - `json` → structured machine-readable output
 * - `debug` → deep inspection output for development diagnostics
 *
 * Each target has its own independent configuration space.
 *
 * ---------------------------------------------------------------------
 * 🔷 BEHAVIOR
 * ---------------------------------------------------------------------
 *
 * - This function is deterministic
 * - It does not mutate input values
 * - It does not apply user overrides
 * - It only returns predefined defaults
 *
 * ---------------------------------------------------------------------
 * 🔷 ERROR HANDLING
 * ---------------------------------------------------------------------
 *
 * If an unknown target is provided, the function throws an error.
 * This ensures strict exhaustiveness of supported renderers.
 *
 * ---------------------------------------------------------------------
 * @param target
 * The output renderer target for which configuration should be resolved.
 *
 * @param mode
 * The rendering mode preset to use for the selected target.
 *
 * @returns
 * A fully resolved renderer configuration object for the given target and mode.
 *
 * @throws
 * If the provided target is not a valid supported renderer.
 *
 * @since 1.0.0
 */
export function resolveRendererConfig<
    T extends keyof typeof DEFAULT_OUTPUT_CONFIG,
    M extends 'pretty' | 'compact'
>(
    target: T,
    mode: M
): TargetConfig<T, M> {
    switch (target) {
        case 'terminal': {
            return DEFAULT_OUTPUT_CONFIG.terminal[mode];
        }

        case 'debug': {
            return DEFAULT_OUTPUT_CONFIG.debug[mode];
        }

        case 'json': {
            return DEFAULT_OUTPUT_CONFIG.json[mode];
        }

        default: {
            throw new Error(`Unknown output target: ${target}`);
        }
    }
}