
import type { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";

import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import MapEntryFrame from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/assets/map.entry.frame";

import _rendering from "../../helpers/helpers";

const makeFrame = (tokenizer: (v: unknown) => readonly Token[]) => {
    return new MapEntryFrame(tokenizer);
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

    it.each(_rendering.tokenizers)("implements the insertion contract for %s", (_name, tokenizer) => {
        const frame = makeFrame(tokenizer);

        expect(frame.isComplete).toBe(false);

        const keyToken = new TOKENS.Primitive('string', "key-v");
        const valueToken = new TOKENS.Primitive('string', "value-v");

        {
            frame.add(keyToken);
            frame.apply();

            expect(frame.isComplete).toBe(false);

            const newTokens = frame.getTokens();
            const kinds = _rendering.extractKinds(newTokens);

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
            const kinds = _rendering.extractKinds(newTokens);

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

    it.each(_rendering.tokenizers)(
        "rejects applying an empty stream for %s",
        (_name, tokenizer) => {
            const frame = makeFrame(tokenizer);

            expect(() => frame.apply()).toThrow('Invariant violation: Cannot apply empty tokens.');
        }
    );

    it.each(_rendering.tokenizers)(
        "rejects applying after completion for %s",
        (_name, tokenizer) => {
            const frame = makeFrame(tokenizer);

            frame.add(new TOKENS.Primitive('string', 'a'));
            frame.apply();

            frame.add(new TOKENS.Primitive('string', 'b'));
            frame.apply();

            expect(frame.isComplete).toBe(true);

            expect(() => frame.apply()).toThrow(
                'Invariant violation: Cannot apply tokens after its completion.'
            );
        }
    );

    it.each(_rendering.tokenizers)(
        "rejects adding tokens after completion for %s",
        (_name, tokenizer) => {
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

    it.each(_rendering.tokenizers)(
        "returns an immutable token snapshot for %s",
        (_name, tokenizer) => {
            const frame = makeFrame(tokenizer);

            const tokens = frame.getTokens();

            expect(Object.isFrozen(tokens)).toBe(true);
        }
    );
});