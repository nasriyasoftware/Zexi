import TOKENS from "../../../../3-tokenization/tokens";
import DataEnvelope from "../../../shared/envelope/data.envelope";
import JSONTokenizer from "../helpers/tokenizer";
import keys from "../helpers/keys";

import type { PassedData } from "./types";

/**
 * Set Rendering Pass
 * ------------------
 *
 * A structural transformation pass responsible for converting a token stream
 * representing a JavaScript `Set` into a JSON-compatible envelope structure.
 *
 * This pass performs **stream mutation + structural analysis**, but does not
 * directly render output in a conventional sense.
 *
 * Instead, it:
 *
 * - Skips structural wrapper tokens
 * - Computes Set size from separator tokens
 * - Injects a structured envelope using anchors
 * - Marks ignored tokens to prevent duplicate emission
 * - Defers payload construction through DataEnvelope
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT FORMAT
 * ---------------------------------------------------------------------
 *
 * Sets are serialized into a deterministic envelope:
 *
 * {
 *   "$codec": "zexi@1.0",
 *   "$kind": "set",
 *   "$payload": {
 *     "size": number,
 *     "values": [...]
 *   }
 * }
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Token-Level Structural Reconstruction**
 *    - No runtime Set inspection occurs
 *    - Structure is derived purely from token stream
 *
 * 2. **Deterministic Size Calculation**
 *    - Set size is computed from separator tokens
 *    - Ensures consistent representation regardless of input shape
 *
 * 3. **Anchor-Based Stream Injection**
 *    - Uses `set:envelope-start` and `set:data-end` anchors
 *    - Avoids reliance on fragile index-based mutation
 *
 * 4. **Deferred Envelope Serialization**
 *    - Envelope is generated after structural analysis
 *    - Guarantees correct metadata before emission
 *
 * 5. **Safe Token Suppression**
 *    - Skips structural tokens explicitly
 *    - Registers ignored tokens to prevent duplication in later passes
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL SCANNING MODEL
 * ---------------------------------------------------------------------
 *
 * The pass performs a single forward scan with cursor tracking:
 *
 * - `scopes.opened / closed`
 *   Tracks nested object boundaries
 *
 * - `scanned`
 *   Linear cursor offset from initial position
 *
 * - `item`
 *   Current token under evaluation
 *
 * - `separators`
 *   Count of Set element delimiters
 *
 * ---------------------------------------------------------------------
 * 🔷 SKIPPED STRUCTURE MODEL
 * ---------------------------------------------------------------------
 *
 * Initial tokens are explicitly skipped:
 *
 * - `object-open`
 * - `soft-line`
 * - `indent-start`
 *
 * These represent structural wrappers of the Set representation
 * and are not part of payload content.
 *
 * ---------------------------------------------------------------------
 * 🔷 SIZE COMPUTATION RULE
 * ---------------------------------------------------------------------
 *
 * Set size is derived using:
 *
 *   size = separators + 1
 *
 * This assumes:
 *
 * - at least one element exists in the Set
 * - separators represent element boundaries
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE INJECTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Two anchor points are used:
 *
 * - `set:envelope-start`
 *   → injection point for envelope header tokens
 *
 * - `set:data-end`
 *   → injection point for trailing metadata and cleanup callbacks
 *
 * These anchors ensure:
 *
 * - stable injection regardless of stream mutation
 * - deterministic ordering of envelope + payload
 *
 * ---------------------------------------------------------------------
 * 🔷 CALLBACK CLEANUP PHASE
 * ---------------------------------------------------------------------
 *
 * After trailing tokens are injected, a callback is registered to:
 *
 * - mark `indent-end` as ignored
 * - mark `soft-line` as ignored
 * - mark `object-close` as ignored
 *
 * This ensures:
 *
 * - structural wrappers do not leak into final output
 * - formatting tokens are properly suppressed
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTEXT INTERACTIONS
 * ---------------------------------------------------------------------
 *
 * This pass interacts with:
 *
 * - `ctx.tokens`
 *   → token traversal, injection, and cursor tracking
 *
 * - `ctx.data`
 *   → layout state mutation (`RENDERING_LAYOUT_KEY`)
 *
 * - `ignoredTokens`
 *   → global suppression registry for consumed tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 SIDE EFFECTS
 * ---------------------------------------------------------------------
 *
 * - Mutates rendering layout state (forces `block`)
 * - Injects envelope structure into token stream
 * - Marks structural tokens as ignored
 * - Registers deferred cleanup callback
 * - Performs direct token stream mutation via anchors
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY NOTES
 * ---------------------------------------------------------------------
 *
 * This pass relies heavily on cursor-relative indexing.
 * Therefore:
 *
 * - token stream integrity is critical
 * - skipped token assumptions must remain stable
 * - object wrapper structure must not change without updating logic
 *
 * ---------------------------------------------------------------------
 * @param passedData
 * Pass context containing:
 *
 * - `ctx`
 *   Rendering context with token stream and injection APIs
 *
 * - `ignoredTokens`
 *   Registry of tokens excluded from final rendering output
 *
 * ---------------------------------------------------------------------
 * @throws Error
 * This pass may indirectly propagate errors from:
 *
 * - token stream inconsistencies
 * - invalid object structure
 * - injection index misalignment
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export default function setPass(
    passedData: Pick<PassedData, 'ctx' | 'ignoredTokens'>
) {
    const { ctx, ignoredTokens } = passedData;

    ctx.data.set(keys.RENDERING_LAYOUT_KEY, 'block', { overwrite: true });
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

        return separators + 1;
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