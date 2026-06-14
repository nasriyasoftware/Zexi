import GraphBuilder from "../../../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../../../src/core/terminal/pipeline/2-representation/builder";
import TokensBuffer from "../../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import Tokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";
import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";

import type { GraphConfig } from "../../../../../../src/core/terminal/pipeline/4-rendering/types/types";
import type { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import MapEntryFrame from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/map.entry.frame";

// Helpers (ONLY allowed pipeline entry point)
const tokenize = (
    value: unknown,
    preset: 'json' | 'ignoredCycles' | 'markedCycles'
): readonly Token[] => {
    const config: GraphConfig = {
        cycles: 'ignore',
        canonical: false
    };

    switch (preset) {
        case 'json': {
            config.canonical = true;
            config.cycles = 'throw';
            break;
        }

        case 'ignoredCycles': {
            config.cycles = 'ignore';
            break;
        }

        case 'markedCycles': {
            config.cycles = 'mark';
            break;
        }
    }

    const graph = GraphBuilder.build(value, config);
    const rep = RepresentationBuilder.build(graph);
    const buffer = Tokenizer.tokenize(rep);
    return TokensBuffer.toArray(buffer);
}

const extractKinds = (tokens: readonly any[]) => tokens.map(t => t.kind);

const tokenizer = {
    json: (value: unknown) => tokenize(value, "json"),
    ignoredCycles: (value: unknown) => tokenize(value, "ignoredCycles"),
    markedCycles: (value: unknown) => tokenize(value, "markedCycles"),
} as const;

const tokenizers = [
    tokenizer.json,
    tokenizer.ignoredCycles,
    tokenizer.markedCycles
] as const;

const makeFrame = (fn: (v: unknown) => readonly Token[]) => {
    return new MapEntryFrame(fn);
};

const generatedTokensKinds = [
    "group-start", "object-name",
    "object-open", "soft-line",
    "indent-start", "group-start",
    "property", "key-value-separator",
    "soft-space", "anchor", // 9
    "separator", "soft-line",
    "group-end", "group-start",
    "property", "key-value-separator",
    "soft-space", "anchor", // 17
    "group-end", "indent-end",
    "soft-line", "object-close",
    "group-end"
] as const;

describe("MapEntryFrame contracts", () => {

    it.each(tokenizers)("implements the insertion contract for %s", (tokenizer) => {
        const frame = makeFrame(tokenizer);

        expect(frame.isComplete).toBe(false);

        const keyToken = new TOKENS.Primitive('string', "key-v");
        const valueToken = new TOKENS.Primitive('string', "value-v");

        {
            frame.add(keyToken);
            frame.apply();

            expect(frame.isComplete).toBe(false);

            const newTokens = frame.getTokens();
            const kinds = extractKinds(newTokens);

            const parts = {
                start: generatedTokensKinds.slice(0, 10),
                end: generatedTokensKinds.slice(10)
            }

            expect(parts.start.length + parts.end.length + 1).toBe(kinds.length);
            expect(kinds).toEqual([
                ...parts.start,
                'primitive',
                ...parts.end
            ]);

            const kToken = newTokens[parts.start.length] as InstanceType<typeof TOKENS.Primitive>;

            expect(kToken).toBe(keyToken);
            expect(kToken.kind).toBe("primitive");
            expect(kToken.type).toBe("string");
            expect(kToken.value).toBe("key-v");
        }

        {
            frame.add(valueToken);
            frame.apply();

            expect(frame.isComplete).toBe(true);

            const newTokens = frame.getTokens();
            const kinds = extractKinds(newTokens);

            const parts = {
                start: generatedTokensKinds.slice(0, 10),
                middle: generatedTokensKinds.slice(10, 18),
                end: generatedTokensKinds.slice(18)
            }

            console.log(parts);
            expect(
                parts.start.length +
                parts.middle.length +
                parts.end.length + 2
            ).toBe(kinds.length);

            expect(kinds).toEqual([
                ...parts.start,
                'primitive',
                ...parts.middle,
                'primitive',
                ...parts.end
            ]);

            const vToken = newTokens[
                parts.start.length + 1 +
                parts.middle.length
            ] as InstanceType<typeof TOKENS.Primitive>;

            expect(vToken).toBe(valueToken);
            expect(vToken.kind).toBe("primitive");
            expect(vToken.type).toBe("string");
            expect(vToken.value).toBe("value-v");
        }
    });

    it.each(tokenizers)(
        "rejects applying an empty stream for %s",
        (tokenizer) => {
            const frame = makeFrame(tokenizer);

            expect(() => frame.apply()).toThrow('Invariant violation: Cannot apply empty tokens.');
        }
    );

    it.each(tokenizers)(
        "rejects applying after completion for %s",
        (tokenizer) => {
            const frame = makeFrame(tokenizer);

            frame.add(new TOKENS.Primitive('string', 'a'));
            frame.apply();

            frame.add(new TOKENS.Primitive('string', 'b'));
            frame.apply();

            expect(frame.isComplete).toBe(true);

            expect(() => frame.apply())
                .toThrow(
                    'Invariant violation: Cannot apply tokens after its completion.'
                );
        }
    );

    it.each(tokenizers)(
        "rejects adding tokens after completion for %s",
        (tokenizer) => {
            const frame = makeFrame(tokenizer);

            frame.add(new TOKENS.Primitive('string', 'a'));
            frame.apply();

            frame.add(new TOKENS.Primitive('string', 'b'));
            frame.apply();

            expect(frame.isComplete).toBe(true);

            expect(() => {
                frame.add(
                    new TOKENS.Primitive('string', 'c')
                );
            }).toThrow(
                'Invariant violation: Cannot add tokens after end.'
            );
        }
    );

    it.each(tokenizers)(
        "returns an immutable token snapshot for %s",
        (tokenizer) => {
            const frame = makeFrame(tokenizer);

            const tokens = frame.getTokens();

            expect(Object.isFrozen(tokens)).toBe(true);
        }
    );
});