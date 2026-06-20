import type ZexiRenderingContext from "../../../shared/context/context";
import type { Token } from "../../../../3-tokenization/types";
import type { JSONRendererFlags } from "../types";

export interface PassedData {
    ctx: ZexiRenderingContext;
    flags: JSONRendererFlags;
    ignoredTokens: Set<Token>;
    mode: 'compact' | 'pretty';
}