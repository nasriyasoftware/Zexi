
import ZexiRenderingContext from "../../../shared/context/context";
import type { Token } from "../../../../3-tokenization/types";
import type { JSONPipelineFlags } from "../types";

export interface PassedData {
    ctx: ZexiRenderingContext;
    flags: JSONPipelineFlags;
    ignoredTokens: Set<Token>;
    mode: 'compact' | 'pretty';
}