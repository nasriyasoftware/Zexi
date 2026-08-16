import keys from "../../../shared/keys";
import ObjectCache from "../assets/object.cache";
import type JSONHelpers from "../helpers/helpers";
import type { PassedData } from "./types";
import type { PropertyToken } from "../../../../3-tokenization/tokens/tokenization/property.token";

/**
 * Object Structure Normalization Pass
 * -----------------------------------
 *
 * This pass performs structural analysis and transformation of object
 * literals during the **JSON normalization phase** of the pipeline.
 *
 * It does NOT perform rendering or string emission.
 * Instead, it prepares object-related token structures so that the
 * rendering phase can operate deterministically without structural branching.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE POSITION
 * ---------------------------------------------------------------------
 *
 * Graph → Representation → Tokenization → Normalization → Rendering
 *
 * This pass executes in the normalization stage and is responsible for:
 *
 * - analyzing object scope boundaries
 * - identifying property tokens
 * - classifying property visibility
 * - collapsing empty objects
 * - suppressing invalid separators (trailing commas / soft-lines)
 *
 * ---------------------------------------------------------------------
 * 🔷 INPUT CONTROL SURFACE (ignoredTokens)
 * ---------------------------------------------------------------------
 *
 * This pass accepts an external `ignoredTokens` set which is used to:
 *
 * - suppress tokens produced by other normalization passes
 * - prevent double-processing of structural rewrites
 * - coordinate cross-pass token exclusion
 *
 * Any token present in `ignoredTokens` is treated as:
 *
 * - logically removed from the stream
 * - skipped during traversal
 * - eligible for one-time cleanup (auto-deletion semantics)
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * The goal of this pass is to transform raw object token streams into
 * a normalized, render-safe structure by enforcing JSON semantics:
 *
 * - remove non-renderable properties
 * - detect fully empty or fully ignored objects
 * - suppress object-level whitespace artifacts
 * - mark trailing separator suppression targets
 *
 * This ensures rendering does not need structural awareness.
 *
 * ---------------------------------------------------------------------
 * 🔷 SCANNING MODEL
 * ---------------------------------------------------------------------
 *
 * The pass performs a single forward, peek-based scan over the token stream:
 *
 * 1. Tracks object nesting using:
 *    - `object-open`
 *    - `object-close`
 *
 * 2. Restricts processing to the **top-level object scope only**
 *    (i.e. only when `opened - closed === 1`)
 *
 * 3. Identifies property tokens:
 *    - `kind === 'property'`
 *    - `type === 'property'`
 *
 * 4. Resolves property value via fixed offset lookup:
 *    - `valueToken = ctx.tokens.peek(index + 3)`
 *
 * 5. Classifies each property as:
 *    - renderable
 *    - ignored (non-visible)
 *
 * ---------------------------------------------------------------------
 * 🔷 EMPTY OBJECT COLLAPSE RULE
 * ---------------------------------------------------------------------
 *
 * If ANY of the following conditions are met:
 *
 * - no properties were discovered
 *
 * THEN:
 *
 * - both opening and closing whitespace tokens are suppressed
 *   (soft-line removal via `ignoredTokens`)
 *
 * RESULT:
 *
 *     {}
 *
 * is produced with no intermediate formatting artifacts such as:
 *
 *     { }
 *
 * This ensures minimal, deterministic output for empty objects.
 *
 * ---------------------------------------------------------------------
 * 🔷 FULL OBJECT IGNORE RULE
 * ---------------------------------------------------------------------
 *
 * If ALL discovered properties are classified as ignored:
 *
 * THEN:
 *
 * - the entire object is replaced
 * - a synthetic empty object `{}` is generated via JSONTokenizer
 * - the current normalization group is aborted
 * - replacement tokens are injected in place of the original group
 *
 * This guarantees:
 *
 * - structural consistency after full filtering
 * - no dangling separators or partial object output
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAILING SEPARATOR SUPPRESSION
 * ---------------------------------------------------------------------
 *
 * When the last visible property is followed by ignored properties:
 *
 * - the last renderable property is identified
 * - its trailing separator is suppressed via ObjectCache
 *
 * This ensures:
 *
 * - valid JSON output
 * - no dangling commas after filtered properties
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE & CACHE USAGE
 * ---------------------------------------------------------------------
 *
 * A per-object ObjectCache instance is created and stored in context:
 *
 *   ctx.data.set(OBJECT_CACHE, cache)
 *
 * The cache is responsible for:
 *
 * - tracking ignored properties
 * - marking trailing separator suppression targets
 * - coordinating downstream rendering decisions
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTEXT INTERACTIONS
 * ---------------------------------------------------------------------
 *
 * This pass interacts with:
 *
 * - ctx.tokens
 *   → peek-based traversal of object structure
 *
 * - ctx.data
 *   → shared normalization state (cache + layout metadata)
 *
 * - helpers
 *   → visibility rules and group abortion control
 *
 * ---------------------------------------------------------------------
 * 🔷 SIDE EFFECTS
 * ---------------------------------------------------------------------
 *
 * This pass may:
 *
 * - mutate `ctx.data` (OBJECT_CACHE)
 * - modify `ignoredTokens` set
 * - suppress soft-line tokens for empty objects
 * - mark property-level suppression metadata
 * - replace entire object group with synthetic `{}` output
 *
 * ---------------------------------------------------------------------
 * 🔷 FAILURE MODEL
 * ---------------------------------------------------------------------
 *
 * This pass does not normally throw under valid input streams.
 *
 * It may throw only if:
 *
 * - expected property value token is missing
 * - token stream structure is corrupted
 * - object scope boundaries are invalid
 *
 * ---------------------------------------------------------------------
 * @param passedData
 * Normalization input bundle containing:
 *
 * - `ctx`: shared normalization context
 * - `ignoredTokens`: global suppression registry shared across passes
 *
 * @param helpers
 * JSONNormalizationHelpers instance providing:
 *
 * - token visibility evaluation
 * - group abortion control
 * - structural transformation utilities
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export default function objectPass(
    passedData: Pick<PassedData, 'ctx' | 'ignoredTokens'>,
    helpers: JSONHelpers
) {
    const { ctx, ignoredTokens } = passedData;

    const ignoredProps = new Set<PropertyToken>();
    const cache = new ObjectCache(ignoredProps);

    // Store the cache in the context
    ctx.data.set(keys.OBJECT_CACHE, cache);

    let index = 0;
    let item = ctx.tokens.peek(++index);
    const scopes = { opened: 0, closed: 0 }

    const props = new Set<PropertyToken>();

    do {
        try {
            if (!item) { break; }
            if (item.kind === 'object-close') {
                scopes.closed++;
                if (scopes.opened === scopes.closed) {
                    break;
                }

                continue;
            }

            if (item.kind === 'object-open') {
                scopes.opened++;
                continue;
            }

            // Checking if we're in the correct scope
            if (scopes.closed + 1 !== scopes.opened) { continue; }

            if (item.kind === 'property') {
                props.add(item);

                if (item.type !== 'property') {
                    ignoredProps.add(item);
                }

                const valueToken = ctx.tokens.peek(index + 3);
                if (!valueToken) {
                    throw new Error(`Invariant violation: Property value token was expected but was not found.`);
                }

                const isVisible = helpers.isVisibleToken(valueToken);
                if (!isVisible) {
                    ignoredProps.add(item);
                }
            }
        } finally {
            index++;
            item = ctx.tokens.peek(index);
        }
    } while (item);

    if (props.size === 0) {
        // skipping the soft-line tokens
        ignoredTokens.add(ctx.tokens.peek(2)!);
        ignoredTokens.add(ctx.tokens.peek(5)!);
        return;
    }

    if (props.size === ignoredProps.size) {
        helpers.ignoreCurrentGroup();
        return;
    }

    // Detect if the last property is ignored
    const allProps = Array.from(props);
    const ignored = Array.from(ignoredProps);

    const lastProp = allProps[allProps.length - 1];
    const lastIgnoredProp = ignored[ignored.length - 1];

    if (lastProp === lastIgnoredProp) {
        // Mark the last visible property to ignore its separator
        const visibleProps = allProps.filter(prop => !ignored.includes(prop));
        const lastVisibleProp = visibleProps[visibleProps.length - 1];
        cache.suppressTrailingOf(lastVisibleProp);
    }
}