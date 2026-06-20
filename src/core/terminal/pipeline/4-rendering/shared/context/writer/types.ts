import TraversalDepth from "../traversal/traversal.depth";
import WritingLine from "./line/line";

export interface WriterConfig {
    depth: TraversalDepth,
    spaces: number,
    maxWidth?: number;
    subContext?: {
        authKey: symbol;
        currentLine: WritingLine
    }
}