import type { AnsiColor, AnsiStyle } from "../../../../styling/types";

/**
 * Internal storage structure for ANSI metadata resolution.
 *
 * This type represents the full state of all ANSI attributes
 * that may be assigned to a token during enrichment.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * It tracks:
 *
 * - whether a value has been resolved (`defined`)
 * - the resolved ANSI value
 * - optional provenance information (`source`)
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN NOTES
 * ---------------------------------------------------------------------
 *
 * This structure is intentionally verbose to:
 *
 * - make assignment state explicit
 * - prevent accidental overwrites
 * - support debugging and traceability
 *
 * It is not exposed outside of `AnsiMeta` and should be considered
 * an implementation detail of the enrichment pipeline.
 *
 * @internal
 */
export type AnsiMetaConfig = {
    color: MetaEntry<AnsiColor>;
    bgColor: MetaEntry<AnsiColor>;
    styles: MetaEntry<Set<AnsiStyle>>;
}

/**
 * Represents a single resolved ANSI metadata field.
 *
 * ---------------------------------------------------------------------
 * 🔷 SEMANTICS
 * ---------------------------------------------------------------------
 *
 * A metadata entry follows a strict lifecycle:
 *
 * - `defined = false` → no value has been assigned
 * - `defined = true` → value has been resolved and locked
 *
 * Once defined, the value is considered immutable.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * This structure enforces a write-once semantic during enrichment,
 * ensuring deterministic styling across traversal passes.
 *
 * @internal
 */
export type MetaEntry<T> = {
    defined: boolean;
    source?: string;
    value?: T;
}

/**
 * Mapping between ANSI property kinds and their accepted input types.
 *
 * ---------------------------------------------------------------------
 * 🔷 PURPOSE
 * ---------------------------------------------------------------------
 *
 * This map defines the allowed values that can be assigned via
 * `AnsiMeta.assign()`.
 *
 * It is used exclusively for type-safe dispatching in the enrichment
 * stage.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN ROLE
 * ---------------------------------------------------------------------
 *
 * - `color` → foreground ANSI color
 * - `bgColor` → background ANSI color
 * - `styles` → one or more ANSI text styles
 *
 * This type is not a runtime construct; it only exists for compile-time
 * safety and inference.
 *
 * @internal
 */
export type TokensANSIMap = {
    color: AnsiColor;
    bgColor: AnsiColor;
    styles: AnsiStyle | AnsiStyle[];
}