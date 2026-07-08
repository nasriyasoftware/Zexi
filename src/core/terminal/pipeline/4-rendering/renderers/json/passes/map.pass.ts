import TOKENS from "../../../../3-tokenization/tokens";
import JSONTokenizer from "../../../../3-tokenization/tokenizers/json.tokenizer";
import DataEnvelope from "../../../shared/envelope/data.envelope";
import MapEntryFrame from "../assets/map.entry.frame";

import type { PassedData } from "./types";
import type { Token } from "../../../../3-tokenization/types";

/**
 * Map Structure Normalization Pass
 * --------------------------------
 *
 * This pass transforms a token stream representing a JavaScript `Map`
 * into a deterministic JSON-compatible envelope structure during the
 * **normalization phase** of the pipeline.
 *
 * It does NOT perform rendering or runtime Map inspection.
 *
 * Instead, it reconstructs Map semantics purely from token structure,
 * producing a stable intermediate representation for the rendering phase.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE POSITION
 * ---------------------------------------------------------------------
 *
 * Graph → Representation → Tokenization → Normalization → Rendering
 *
 * This pass operates in the normalization stage and is responsible for:
 *
 * - detecting Map entry boundaries from token groups
 * - reconstructing key/value pairs via entry frames
 * - computing deterministic size metadata
 * - injecting envelope structure via anchors
 * - suppressing consumed structural tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * The purpose of this pass is to convert a Map token stream into a
 * canonical envelope representation:
 *
 *     {
 *       "$codec": "zexi@1.0",
 *       "$kind": "map",
 *       "$payload": {
 *         "entries": [...],
 *         "size": number
 *       }
 *     }
 *
 * This ensures Maps are serialized deterministically regardless of:
 *
 * - insertion order variability
 * - nested structure complexity
 * - token stream formatting differences
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PRINCIPLES
 * ---------------------------------------------------------------------
 *
 * 1. Token-driven reconstruction
 *    - No runtime Map inspection occurs
 *    - All structure is derived from token stream semantics
 *
 * 2. Entry-frame isolation
 *    - Each Map entry is captured in a `MapEntryFrame`
 *    - Prevents cross-entry token leakage
 *    - Ensures strict key/value grouping integrity
 *
 * 3. Group-based semantics
 *    - Map entries are defined by `group-start / group-end`
 *    - Each completed group represents a single entry
 *
 * 4. Anchor-based injection
 *    - Uses named anchors instead of index mutation
 *    - Guarantees stable insertion under stream changes
 *
 * 5. Deferred envelope construction
 *    - Envelope is created only after full structural scan
 *    - Ensures accurate size and entry metadata
 *
 * 6. Safe token suppression
 *    - Consumed tokens are explicitly registered in `ignoredTokens`
 *    - Prevents duplicate emission in downstream passes
 *
 * ---------------------------------------------------------------------
 * 🔷 GROUP MODEL (CRITICAL)
 * ---------------------------------------------------------------------
 *
 * Map entries are defined by structural grouping tokens:
 *
 *   group-start → group-end
 *
 * Each group corresponds to exactly one Map entry:
 *
 *   key → value
 *
 * Entry lifecycle:
 *
 * 1. group-start → create new MapEntryFrame
 * 2. stream key/value tokens into frame
 * 3. key-value-separator → flush partial frame state
 * 4. group-end → finalize entry
 * 5. commit entry to entries list
 *
 * This guarantees:
 *
 * - no partial entries
 * - no incomplete key/value pairs
 * - deterministic grouping semantics
 *
 * ---------------------------------------------------------------------
 * 🔷 OBJECT SCOPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The pass enforces strict outer-object boundary tracking:
 *
 * - only processes tokens within the root Map object scope
 * - stops immediately at root object closure
 * - prevents cross-structure contamination
 *
 * ---------------------------------------------------------------------
 * 🔷 SIZE COMPUTATION RULE
 * ---------------------------------------------------------------------
 *
 * Map size is derived from structural separators:
 *
 *     size = separators + 1
 *
 * This assumes:
 *
 * - each separator represents a boundary between entries
 * - at least one entry exists during scanning
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE INJECTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Two anchors coordinate deterministic mutation:
 *
 * - `map:envelope-start`
 *   → insertion point for envelope header tokens
 *
 * - `map:data-end`
 *   → insertion point for payload + cleanup callback
 *
 * This ensures:
 *
 * - stable ordering under token stream mutation
 * - separation of metadata vs payload regions
 * - predictable downstream rendering behavior
 *
 * ---------------------------------------------------------------------
 * 🔷 FINAL OUTPUT CONSTRUCTION
 * ---------------------------------------------------------------------
 *
 * After scanning:
 *
 * 1. Each entry is converted into a token array
 * 2. Each entry is prefixed with an Anchor (`entry-i`)
 * 3. Entry separators are reconstructed:
 *    - group-end
 *    - separator
 *    - soft-line
 *
 * 4. DataEnvelope('map', ...) is created
 * 5. Envelope tokens are injected into the stream
 *
 * ---------------------------------------------------------------------
 * 🔷 CLEANUP PHASE
 * ---------------------------------------------------------------------
 *
 * After payload injection, a deferred callback is registered to:
 *
 * - ignore `indent-end`
 * - ignore `soft-line`
 * - ignore `object-close`
 *
 * This ensures structural formatting artifacts do not leak into output.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTEXT INTERACTIONS
 * ---------------------------------------------------------------------
 *
 * This pass interacts with:
 *
 * - ctx.tokens
 *   → stream traversal, injection, and mutation
 *
 * - ctx.data
 *   → shared normalization state (layout + metadata if needed)
 *
 * - ignoredTokens
 *   → global registry of consumed structural tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 SIDE EFFECTS
 * ---------------------------------------------------------------------
 *
 * This pass may:
 *
 * - mutate token stream via injection and cursor-relative logic
 * - mark tokens as ignored
 * - inject structural anchors and envelope frames
 * - compute and attach deterministic metadata (size, entries)
 * - register deferred cleanup callbacks
 *
 * ---------------------------------------------------------------------
 * 🔷 SAFETY MODEL
 * ---------------------------------------------------------------------
 *
 * This pass depends on strict structural invariants:
 *
 * - group-start / group-end pairing must remain consistent
 * - object nesting must not change unexpectedly
 * - anchor insertion points must remain valid under mutation
 *
 * Violations in these assumptions may result in:
 *
 * - incorrect entry reconstruction
 * - misaligned envelope injection
 * - corrupted size calculation
 *
 * ---------------------------------------------------------------------
 * @param passedData.ctx
 * Normalization context providing:
 *
 * - token stream access
 * - injection APIs
 * - scope tracking
 * - shared normalization state
 *
 * @param passedData.ignoredTokens
 * Registry of tokens excluded from final output emission
 *
 * ---------------------------------------------------------------------
 * @throws Error
 * May propagate invariant errors when:
 *
 * - group-end is encountered without matching group-start
 * - entry is closed prematurely or incompletely
 * - token structure violates expected Map grouping semantics
 * - frame reconstruction detects invalid group termination
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export default function mapPass(
    passedData: Pick<PassedData, 'ctx' | 'ignoredTokens'>
) {
    const { ctx, ignoredTokens } = passedData;
    const initialCursor = ctx.tokens.cursor;

    // Skipping set tokens
    let skipped = 0;
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `object-open`
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `soft-line`
    ignoredTokens.add(ctx.tokens.peek(++skipped)!); // Ignoring `indent-start`

    const envelopeStartAnchor = new TOKENS.Anchor('map:envelope-start');
    const dataEndAnchor = new TOKENS.Anchor('map:data-end');
    ctx.tokens.inject(envelopeStartAnchor, { at: initialCursor + skipped + 1 });
    
    const metadata = (() => {
        const isEmptyMap = ctx.tokens.peek(skipped + 2)?.kind === 'indent-end';
        let separators = 0;
        let scanned = skipped; // The skipped tokens

        let item = ctx.tokens.peek(++scanned);
        const objects = { opened: 1, closed: 0 }
        const groups = { opened: 0, closed: 0 }

        const sameObject = () => objects.closed + 1 === objects.opened;

        let entry: MapEntryFrame | undefined;
        const entries: (readonly Token[])[] = [];        

        scanning: do {
            try {
                if (!item) { break scanning; }
                ignoredTokens.add(item);

                if (item.kind === 'object-close') {
                    objects.closed++;

                    // Inject the data anchor
                    if (objects.opened === objects.closed) {
                        const closeIndex = initialCursor + scanned;

                        ctx.tokens.inject(dataEndAnchor, {
                            // The index of the closing token - 2 tokens (`soft-line` and `indent-end`)
                            at: closeIndex - 2
                        });

                        break scanning;
                    }

                    entry!.add(item);

                    continue;
                } else if (item.kind === 'object-open') {
                    objects.opened++;

                    entry!.add(item);

                    continue;
                }

                // Checking if we're in the correct scope
                if (!sameObject()) {
                    entry!.add(item);
                    continue;
                }

                // We're in the same object
                switch (item.kind) {
                    case 'group-start': {
                        groups.opened++;

                        if (groups.closed + 1 === groups.opened) {
                            entry = new MapEntryFrame(JSONTokenizer);
                        }

                        continue scanning;
                    }

                    case 'group-end': {
                        groups.closed++;

                        if (groups.opened === groups.closed) {
                            if (!entry) {
                                throw new Error('Invariant violation: Group end without group start.');
                            }

                            entry.apply();

                            if (!entry.isComplete) {
                                throw new Error('Invariant violation: attempting to close an entry before streaming its "end" tokens.')
                            }

                            entries.push(entry.getTokens());
                            entry = undefined;
                        }

                        continue scanning;
                    }

                    case 'key-value-separator': {
                        entry?.apply();

                        continue scanning;
                    }

                    case 'separator': {
                        separators++;
                        continue scanning;
                    }
                }

                if (entry && item.kind === 'primitive') {
                    entry.add(item);
                }
            } finally {
                scanned++;
                item = ctx.tokens.peek(scanned);
            }
        } while (item);

        const mapDataTokens: Token[] = [];
        for (let i = 0; i < entries.length; i++) {
            const entryTokens = entries[i];
            const hasMore = i < entries.length - 1;

            mapDataTokens.push(new TOKENS.Anchor(`entry-${i}`));
            mapDataTokens.push(...entryTokens);

            if (hasMore) {
                // The group-end token of the entry object
                const groupEnd = mapDataTokens.pop()! as InstanceType<typeof TOKENS.GroupEnd>;
                if (groupEnd.kind !== 'group-end') {
                    throw new Error(`Invariant violation: Expected 'group-end' token, but got '${groupEnd.kind}' instead.`);
                }

                mapDataTokens.push(
                    groupEnd,
                    new TOKENS.Separator,
                    new TOKENS.SoftLine
                )
            }
        }

        return {
            size: isEmptyMap ? 0 : separators + 1,
            entriesTokens: mapDataTokens,
        }
    })();

    const envelop = new DataEnvelope('map', { size: metadata.size, entries: [] });
    const result = envelop.tokenize(JSONTokenizer);

    // Add the envelope data to the stream
    ctx.tokens.inject(result.tokens.start, { at: envelopeStartAnchor });

    ctx.tokens.inject([
        ...metadata.entriesTokens,
        ...result.tokens.trailing,
        new TOKENS.Callback(() => {
            ignoredTokens.add(ctx.tokens.peek(1)!); // Ignoring `indent-end`
            ignoredTokens.add(ctx.tokens.peek(2)!); // Ignoring `soft-line`
            ignoredTokens.add(ctx.tokens.peek(3)!); // Ignoring `object-close`
        })
    ], { at: dataEndAnchor });
}