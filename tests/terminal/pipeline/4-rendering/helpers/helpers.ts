import GraphBuilder from "../../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../../src/core/terminal/pipeline/2-representation/builder";
import TokensBuffer from "../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import Tokenizer from "../../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";

import type { Token } from "../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { GraphConfig } from "../../../../../src/core/terminal/pipeline/4-rendering/types/types";

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

const extractKinds = (tokens: readonly Token[]) => tokens.map(t => t.kind);

const tokenizer = {
    json: (value: unknown) => tokenize(value, "json"),
    ignoredCycles: (value: unknown) => tokenize(value, "ignoredCycles"),
    markedCycles: (value: unknown) => tokenize(value, "markedCycles"),
} as const;

const _rendering = {
    tokenize,
    extractKinds,
    tokenizers: [
        ["json", tokenizer.json],
        ["ignoredCycles", tokenizer.ignoredCycles],
        ["markedCycles", tokenizer.markedCycles],
    ] as const
}

export default _rendering;