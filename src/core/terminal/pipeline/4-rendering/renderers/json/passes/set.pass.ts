import JSONTokenizer from "../../../../3-tokenization/tokenizers/json.tokenizer";
import TOKENS from "../../../../3-tokenization/tokens";
import DataEnvelope from "../../../shared/envelope/data.envelope";
import keys from "../helpers/keys";

import type { PassedData } from "./types";

/**
 * Set Structure Normalization Pass
 * --------------------------------
 *
 * This pass transforms a token stream representing a JavaScript `Set`
 * into a deterministic JSON-compatible envelope structure during the
 * **normalization phase** of the pipeline.
 *
 * It does NOT perform rendering.
 * Instead, it rewrites and annotates the token stream so that the
 * rendering phase can treat Sets as a fully materialized envelope.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE POSITION
 * ---------------------------------------------------------------------
 *
 * Graph → Representation → Tokenization → Normalization → Rendering
 *
 * This pass runs in the normalization stage and is responsible for:
 *
 * - structural recognition of Set boundaries
 * - computing Set size from token stream
 * - injecting envelope structure
 * - marking consumed structural tokens
 * - registering deferred cleanup behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * The purpose of this pass is to convert a Set token stream into a
 * canonical envelope representation:
 *
 *     {
 *       "$codec": "zexi@1.0",
 *       "$kind": "set",
 *       "$payload": {
 *         "size": number,
 *         "values": [...]
 *       }
 *     }
 *
 * This ensures Sets are serialized deterministically regardless of
 * runtime ordering or structure variability.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLES
 * ---------------------------------------------------------------------
 *
 * 1. Token-driven reconstruction
 *    - No runtime Set inspection is performed
 *    - All metadata is derived from token analysis
 *
 * 2. Deterministic size derivation
 *    - Size is computed from separator tokens
 *    - Ensures stable output across equivalent inputs
 *
 * 3. Anchor-based mutation
 *    - Uses named anchors instead of index coupling
 *    - Guarantees safe injection under stream mutation
 *
 * 4. Deferred envelope serialization
 *    - Envelope is constructed after full structural scan
 *    - Prevents partial or inconsistent metadata emission
 *
 * 5. Safe structural suppression
 *    - Consumed tokens are explicitly registered as ignored
 *    - Prevents duplicate rendering in later phases
 *
 * ---------------------------------------------------------------------
 * 🔷 TOKEN SCANNING MODEL
 * ---------------------------------------------------------------------
 *
 * The pass performs a single linear scan with cursor tracking:
 *
 * - `scanned`
 *   Cursor used for sequential token inspection
 *
 * - `item`
 *   Current token under evaluation
 *
 * - `scopes.opened / scopes.closed`
 *   Tracks nested object boundaries within the Set structure
 *
 * - `separators`
 *   Counts element delimiters used for size computation
 *
 * ---------------------------------------------------------------------
 * 🔷 SKIPPED STRUCTURE MODEL
 * ---------------------------------------------------------------------
 *
 * The following structural tokens are intentionally skipped at start:
 *
 * - `object-open`
 * - `soft-line`
 * - `indent-start`
 *
 * These represent formatting scaffolding and are not part of the
 * logical Set payload.
 *
 * ---------------------------------------------------------------------
 * 🔷 SIZE COMPUTATION RULE
 * ---------------------------------------------------------------------
 *
 * Set size is derived as:
 *
 *     size = separators + 1
 *
 * This assumes:
 *
 * - at least one element exists in the Set
 * - separators represent boundaries between elements
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE INJECTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Two anchors coordinate deterministic insertion:
 *
 * - `set:envelope-start`
 *   → injection point for envelope header tokens
 *
 * - `set:data-end`
 *   → injection point for trailing payload and cleanup callbacks
 *
 * This ensures:
 *
 * - stable ordering despite stream mutation
 * - correct placement of metadata vs payload
 * - safe multi-stage token injection
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEANUP PHASE
 * ---------------------------------------------------------------------
 *
 * After payload injection, a deferred callback is registered which:
 *
 * - suppresses `indent-end`
 * - suppresses `soft-line`
 * - suppresses `object-close`
 *
 * This ensures structural formatting tokens do not leak into output.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTEXT INTERACTIONS
 * ---------------------------------------------------------------------
 *
 * This pass interacts with:
 *
 * - ctx.tokens
 *   → stream traversal, injection, cursor tracking
 *
 * - ctx.data
 *   → layout state mutation (`RENDERING_LAYOUT`)
 *
 * - ignoredTokens
 *   → global registry of suppressed tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 SIDE EFFECTS
 * ---------------------------------------------------------------------
 *
 * This pass may:
 *
 * - mutate rendering layout state (forces `block`)
 * - inject envelope structure into token stream
 * - register ignored structural tokens
 * - inject anchors and deferred callbacks
 * - modify token stream ordering via insertion operations
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * This pass relies on stable structural assumptions:
 *
 * - object wrapper structure must remain consistent
 * - skipped tokens must not change ordering
 * - anchor insertion points must remain valid under mutation
 *
 * Any deviation in token structure may lead to incorrect injection
 * or misaligned envelope construction.
 *
 * ---------------------------------------------------------------------
 * @param passedData.ctx
 * Rendering context providing:
 *
 * - token stream access
 * - injection APIs
 * - scope tracking
 * - shared normalization state
 *
 * @param passedData.ignoredTokens
 * Registry tracking tokens excluded from final output emission
 *
 * ---------------------------------------------------------------------
 * @throws Error
 * This pass does not explicitly throw in normal execution, but may
 * propagate errors from:
 *
 * - malformed token streams
 * - invalid object structure assumptions
 * - invalid injection indices or anchor resolution failures
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export default function setPass(
    passedData: Pick<PassedData, 'ctx' | 'ignoredTokens'>
) {
    const { ctx, ignoredTokens } = passedData;

    ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });
    const initialCursor = ctx.tokens.cursor;

    // Skipping set tokens
    let skipped = 0;
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `object-open`
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `soft-line`
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `indent-start`

    const envelopeStartAnchor = new TOKENS.Anchor('set:envelope-start');
    const dataEndAnchor = new TOKENS.Anchor('set:data-end');
    ctx.tokens.inject(envelopeStartAnchor, { at: initialCursor + skipped + 1 });

    const size = (() => {
        const isEmptySet = ctx.tokens.peek(skipped + 2)?.kind === 'indent-end';

        let separators = 0;
        let scanned = skipped; // The skipped tokens

        let item = ctx.tokens.peek(++scanned);
        const scopes = { opened: 1, closed: 0 }

        do {
            try {
                if (!item) { break; }
                if (item.kind === 'object-close') {
                    scopes.closed++;
                    if (scopes.opened === scopes.closed) {
                        const closeIndex = initialCursor + scanned;
                        ctx.tokens.inject(dataEndAnchor, {
                            // The index of the closing token - 2 tokens (`soft-line` and `indent-end`)
                            at: closeIndex - 2
                        });
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

                if (item.kind === 'separator') {
                    separators++;
                }
            } finally {
                scanned++;
                item = ctx.tokens.peek(scanned);
            }
        } while (item);

        return isEmptySet ? 0 : separators + 1;
    })();

    const envelop = new DataEnvelope('set', { size, values: [] });
    const result = envelop.tokenize(JSONTokenizer);

    // Add the envelope data to the stream
    ctx.tokens.inject(result.tokens.start, { at: envelopeStartAnchor });

    ctx.tokens.inject([
        ...result.tokens.trailing,
        new TOKENS.Callback(() => {
            ignoredTokens.add(ctx.tokens.peek(1)!); // Ignoring `indent-end`
            ignoredTokens.add(ctx.tokens.peek(2)!); // Ignoring `soft-line`
            ignoredTokens.add(ctx.tokens.peek(3)!); // Ignoring `object-close`
        })
    ], { at: dataEndAnchor });
}