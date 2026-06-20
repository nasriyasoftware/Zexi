import { INLINE_SAFE_TOKENS as JSON_INLINE_SAFE_TOKENS } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/configs";
import _rendering from "../../helpers/helpers";

const data = {
    json: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'json')![1]
    },
    ignoredCycles: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'ignoredCycles')![1]
    },
    markedCycles: {
        inlineSafe: new Set(JSON_INLINE_SAFE_TOKENS),
        tokenize: _rendering.tokenizers.find(t => t[0] === 'markedCycles')![1]
    }
}

const contracts = [
    ['json', data.json],
    ['ignoredCycles', data.ignoredCycles],
    ['markedCycles', data.markedCycles]
] as const;

export default contracts;