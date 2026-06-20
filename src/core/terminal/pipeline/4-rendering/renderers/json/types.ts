import { OutputLayout } from "../../types/types";

/**
 * Configuration for JSON output rendering.
 *
 * JSON rendering produces deterministic, machine-readable output
 * intended for:
 *
 * - serialization
 * - structured logging
 * - transport pipelines
 * - external integrations
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This configuration controls:
 *
 * - indentation size
 * - structural formatting density
 * - whitespace normalization behavior
 * - line break behavior
 *
 * JSON rendering prioritizes:
 *
 * - deterministic structure
 * - serialization safety
 * - predictable output formatting
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Unlike terminal rendering, JSON output does NOT support:
 *
 * - ANSI styling
 * - visual formatting styles
 * - semantic highlighting
 *
 * JSON output is always emitted as plain serialized text.
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME CONTRACT
 * ---------------------------------------------------------------------
 *
 * This is a fully resolved runtime configuration object.
 *
 * All properties are guaranteed to exist during rendering.
 * Missing values are injected during configuration normalization.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface JSONConfig {

    /**
     * Number of spaces used for indentation.
     *
     * A value of:
     *
     * - `0` produces fully compact output
     * - values greater than `0` improve readability
     *
     * This value controls indentation depth during pretty rendering.
     *
     * @default 0
     * (injected during normalization)
     *
     * @since 1.0.0
     */
    spaces: number;

    /**
     * Layout behavior applied during JSON rendering.
     *
     * Controls:
     *
     * - spacing normalization
     * - line break behavior
     * - indentation strategy
     *
     * Layout rules influence only visual formatting and do NOT alter:
     *
     * - serialized values
     * - structural semantics
     * - traversal behavior
     *
     * @default JSON renderer preset
     * (resolved during normalization)
     *
     * @since 1.0.0
     */
    layout: OutputLayout;
}

export interface JSONRendererFlags {
    ignoreCurrentGroup: boolean;
    skipNextSeparator: boolean;
    skipNextSoftLine: boolean;
    forceNextGroupAsBlock: boolean;
}