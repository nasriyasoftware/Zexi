import type TraversalDepth from "../context/traversal/traversal.depth";
import type WritingLine from "./line/line";

export interface WriterConfig {
    depth: TraversalDepth,
    spaces: number,
    maxWidth?: number;
    subContext?: {
        authKey: symbol;
        currentLine: WritingLine
    }
}