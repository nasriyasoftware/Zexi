import TOKENS from "../../../../3-tokenization/tokens";
import DataEnvelope from "../../../shared/envelope/data.envelope";
import JSONTokenizer from "../helpers/tokenizer";
import MapEntryFrame from "../assets/map.entry.frame";

import type { Token } from "../../../../3-tokenization/types";
import type { PassedData } from "./types";

/**
 * Map Rendering Pass
 * ------------------
 *
 * A structural transformation pass responsible for converting a token stream
 * representing a JavaScript `Map` into a JSON-compatible envelope structure.
 *
 * This pass operates at the **token mutation layer**, not at the value layer.
 * It does NOT inspect runtime values directly.
 *
 * Instead, it:
 *
 * - Traverses a pre-tokenized representation of a Map
 * - Extracts entry boundaries using group-scoped tokens
 * - Builds entry frames to isolate key/value structure
 * - Injects a structured envelope using anchors
 * - Produces a deterministic serialized Map representation
 *
 * ---------------------------------------------------------------------
 * 🔷 OUTPUT FORMAT
 * ---------------------------------------------------------------------
 *
 * The final serialized structure follows this schema:
 *
 * {
 *   "$codec": "zexi@1.0",
 *   "$kind": "map",
 *   "$payload": {
 *     "entries": [...],
 *     "size": number
 *   }
 * }
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GOALS
 * ---------------------------------------------------------------------
 *
 * 1. **Token-Driven Structural Extraction**
 *    - No runtime Map inspection occurs here
 *    - Structure is derived entirely from token stream semantics
 *
 * 2. **Entry Frame Isolation**
 *    - Each Map entry is encapsulated in a `MapEntryFrame`
 *    - Ensures correct grouping of key/value pairs
 *    - Prevents cross-entry token leakage
 *
 * 3. **Anchor-Based Injection Model**
 *    - Uses `Anchor` tokens instead of numeric indices
 *    - Ensures stable insertion points during stream mutation
 *
 * 4. **Deferred Envelope Construction**
 *    - Envelope structure is injected AFTER structural parsing
 *    - Ensures size and entries are fully computed before emission
 *
 * 5. **Stream Mutation Safety**
 *    - All ignored tokens are explicitly tracked
 *    - Prevents duplicate rendering of consumed structural tokens
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL SCANNING MODEL
 * ---------------------------------------------------------------------
 *
 * The pass performs a single forward scan with the following state:
 *
 * - `objects.opened / closed`
 *   Tracks Map outer object boundary
 *
 * - `groups.opened / closed`
 *   Tracks Map entry grouping boundaries
 *
 * - `entry: MapEntryFrame`
 *   Accumulates tokens belonging to a single Map entry
 *
 * - `entries: Token[][]`
 *   Final extracted entry token groups
 *
 * - `separators`
 *   Used to compute Map size (entries = separators + 1)
 *
 * ---------------------------------------------------------------------
 * 🔷 GROUP MODEL (CRITICAL)
 * ---------------------------------------------------------------------
 *
 * Map entries are defined by `group-start / group-end` tokens.
 *
 * Each group corresponds to a full Map entry:
 *
 *   key → value
 *
 * The pass:
 *
 * - Starts a new MapEntryFrame at first group-start in scope
 * - Accumulates tokens until group-end
 * - Commits entry only when group is fully closed
 *
 * This guarantees:
 *
 * - no partial entries
 * - no half-emitted key/value pairs
 * - strict structural consistency
 *
 * ---------------------------------------------------------------------
 * 🔷 OBJECT SCOPE SAFETY
 * ---------------------------------------------------------------------
 *
 * The pass enforces strict object boundary tracking:
 *
 * - Only processes tokens within the outer Map object scope
 * - Stops immediately when root object is closed
 * - Ensures no leakage across nested structures
 *
 * ---------------------------------------------------------------------
 * 🔷 ENVELOPE INJECTION STRATEGY
 * ---------------------------------------------------------------------
 *
 * Two anchors are used:
 *
 * - `map:envelope-start`
 *   → Injects envelope header before data region
 *
 * - `map:data-end`
 *   → Injects trailing metadata + cleanup callbacks
 *
 * These anchors ensure:
 *
 * - stable insertion despite stream mutation
 * - separation of metadata and payload regions
 *
 * ---------------------------------------------------------------------
 * 🔷 FINAL OUTPUT CONSTRUCTION
 * ---------------------------------------------------------------------
 *
 * After scanning:
 *
 * 1. Entries are converted into token arrays
 * 2. Each entry is prefixed with an Anchor (`entry-i`)
 * 3. Entry separators are reconstructed:
 *    - group-end
 *    - separator
 *    - soft-line
 *
 * 4. Envelope is created using DataEnvelope('map', ...)
 * 5. Envelope tokens are injected into stream
 *
 * ---------------------------------------------------------------------
 * 🔷 SIZE COMPUTATION RULE
 * ---------------------------------------------------------------------
 *
 * Map size is computed as:
 *
 *   size = separators + 1
 *
 * This assumes:
 *
 * - every separator represents a boundary between entries
 * - at least one entry exists when parsing begins
 *
 * ---------------------------------------------------------------------
 * @param passedData
 * Pass context containing:
 *
 * - `ctx`
 *   Rendering context with token stream and injection APIs
 *
 * - `ignoredTokens`
 *   Global registry of tokens excluded from rendering output
 *
 * ---------------------------------------------------------------------
 * @throws Error
 * Throws invariant violations when:
 *
 * - group-end is encountered without matching group-start
 * - entry is closed before completion
 * - expected group or object structure is malformed
 * - group-end token is not of expected type during reconstruction
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
            size: separators + 1,
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