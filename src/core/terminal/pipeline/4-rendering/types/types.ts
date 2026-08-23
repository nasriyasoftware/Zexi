
import { DEFAULT_JSON_CONFIG } from "../renderers/json/configs";
import { DEFAULT_DEBUG_CONFIG } from "../renderers/debug/configs";

import type { DebugOptions } from "../renderers/debug/types";
import type { JsonProjection } from "../renderers/json/types";
import type { CircularReferencePolicy } from "../../1-graphing/types";

export interface GraphConfig {
    /**
     * Circular reference handling strategy.
     *
     * Controls how the graph builder reacts when encountering
     * recursive object structures during traversal.
     *
     * @since 1.0.0
     */
    cycles: CircularReferencePolicy;

    /**
     * Enables canonical (deterministic) property ordering.
     *
     * When enabled, object property traversal order is normalized
     * to ensure deterministic output regardless of:
     *
     * - insertion order
     * - runtime engine behavior
     * - property definition timing
     *
     * ---------------------------------------------------------------------
     * 🔷 EFFECT ON OBJECT TRAVERSAL
     * ---------------------------------------------------------------------
     *
     * When `canonical = true`:
     *
     * - `Object.entries()` are sorted lexicographically by key
     * - `Object.getOwnPropertyDescriptors()` entries are also sorted
     * - traversal becomes fully deterministic across runs
     *
     * When `canonical = false` (default):
     *
     * - JavaScript native property ordering is preserved
     * - insertion order + engine-defined ordering applies
     *
     * ---------------------------------------------------------------------
     * 🔷 SCOPE
     * ---------------------------------------------------------------------
     *
     * Canonical ordering applies ONLY to:
     *
     * - plain object properties
     * - property descriptors
     *
     * It does NOT affect:
     *
     * - arrays (index order is already deterministic)
     * - maps (iteration order is defined by insertion)
     * - sets (iteration order is defined by insertion)
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN INTENT
     * ---------------------------------------------------------------------
     *
     * This option exists to support:
     *
     * - deterministic JSON serialization
     * - caching / hashing stability
     * - test reproducibility
     * - structural diffing
     *
     * It is NOT intended for:
     *
     * - preserving runtime semantics
     * - reflecting insertion order truthfully
     *
     * @since 1.0.0
     */
    canonical?: boolean;
}

/**
 * Controls how whitespace and structural formatting is applied
 * during output rendering.
 *
 * This model defines only visual layout behavior, not semantic structure.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * Layout configuration determines how structured output is visually arranged:
 *
 * - spacing between elements
 * - line break behavior
 * - indentation strategy
 *
 * This is a *render-time concern only* and does not affect:
 *
 * - graph structure
 * - token semantics
 * - value representation
 *
 * ---------------------------------------------------------------------
 * 🔷 RUNTIME CONTRACT
 * ---------------------------------------------------------------------
 *
 * This interface represents a **fully resolved configuration**.
 *
 * All values are guaranteed to be defined at runtime.
 *
 * Missing user-provided values are replaced during configuration
 * normalization using system defaults.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export interface OutputLayout {
    /**
     * Controls how spacing between structural elements is handled.
     *
     * - `preserve` → keep original spacing intent where applicable
     * - `normalize` → enforce consistent spacing rules
     * - `collapse` → remove unnecessary spacing for compact output
     *
     * @default normalize
     * (applied during configuration normalization)
     */
    spaces: 'preserve' | 'normalize' | 'collapse';

    /**
     * Controls how line breaks are applied in structured output.
     *
     * - `strict` → preserve structural line breaks exactly
     * - `soft` → allow flexible wrapping based on renderer rules
     * - `collapsed` → minimize line breaks where possible
     *
     * @default soft
     * (applied during configuration normalization)
     */
    lineBreaks: 'strict' | 'soft' | 'collapsed';

    /**
     * Controls indentation strategy for nested structures.
     *
     * - `preserve` → keep original structural indentation intent
     * - `reflow` → recompute indentation for readability and consistency
     *
     * @default reflow
     * (applied during configuration normalization)
     */
    indentation: 'preserve' | 'reflow';
}

export type TargetConfig<
    T extends keyof typeof DEFAULT_OUTPUT_CONFIG,
    M extends 'pretty' | 'compact'
> = ReturnType<typeof DEFAULT_OUTPUT_CONFIG[T]>[M];

export const DEFAULT_OUTPUT_CONFIG = {
    json: DEFAULT_JSON_CONFIG,
    debug: DEFAULT_DEBUG_CONFIG
} as const;