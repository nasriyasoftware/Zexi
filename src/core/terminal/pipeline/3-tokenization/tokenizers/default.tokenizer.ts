import GraphBuilder from "../../1-graphing/builder";
import RepresentationBuilder from "../../2-representation/builder";
import TokensBuffer from "../container/tokens.buffer";
import Tokenizer from "../tokenizer";

import type { Token } from "../types";
import type { CircularReferencePolicy } from "../../1-graphing/types";

/**
 * DefaultTokenizer
 * ----------------
 *
 * The standard entry point into the Zexi Graph → Representation → Token
 * pipeline.
 *
 * This function transforms arbitrary runtime JavaScript values into an
 * immutable token stream suitable for the default rendering pipeline while
 * allowing callers to control how circular references are handled.
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ARCHITECTURE
 * ---------------------------------------------------------------------
 *
 * This tokenizer is the recommended entry point for general-purpose
 * rendering. It performs the complete transformation pipeline:
 *
 *    1. GraphBuilder
 *       - Converts runtime values into a structural graph representation
 *       - Detects and resolves circular references according to the
 *         selected policy
 *
 *    2. RepresentationBuilder
 *       - Translates the graph into a semantic intermediate model
 *       - Preserves runtime object structure
 *
 *    3. Tokenizer
 *       - Converts the representation into a raw token stream
 *       - Produces ordered, structured rendering instructions
 *
 *    4. TokensBuffer
 *       - Materializes the token stream into an immutable array
 *       - Enables safe reuse across multiple rendering passes
 *
 * ---------------------------------------------------------------------
 * 🔷 CIRCULAR REFERENCE POLICIES
 * ---------------------------------------------------------------------
 *
 * Circular references are resolved during graph construction.
 *
 * The selected policy determines how the graph is produced:
 *
 * • `"throw"`
 *   - Throws immediately when a circular reference is encountered.
 *
 * • `"ignore"`
 *   - Replaces the circular reference with `null`.
 *
 * • `"mark"`
 *   - Replaces the circular reference with a marker string using the
 *     format:
 *
 *     `[Circular:<ClassName>:<Occurrence>]`
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN GUARANTEES
 * ---------------------------------------------------------------------
 *
 * ✔ Pure transformation
 *   - No mutation of input values
 *   - No external state
 *   - No side effects
 *
 * ✔ Runtime object preservation
 *   - Preserves original property ordering
 *   - Retains runtime object structure
 *   - Does not canonicalize object members
 *
 * ✔ Renderer independence
 *   - Produces rendering-agnostic token streams
 *   - Formatting and layout decisions are deferred to later pipeline
 *     stages
 *
 * ✔ Immutable output
 *   - Returns an immutable token array
 *   - Safe for reuse across normalization and rendering passes
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * DefaultTokenizer forms the boundary between runtime JavaScript values
 * and the token-based rendering pipeline.
 *
 * Input:
 * - arbitrary JavaScript value
 *
 * Output:
 * - immutable `Token[]`
 *
 * All downstream stages operate exclusively on tokens rather than runtime
 * objects.
 *
 * ---------------------------------------------------------------------
 * 🔷 DIFFERENCE FROM JSONTOKENIZER
 * ---------------------------------------------------------------------
 *
 * Unlike `JSONTokenizer`, this tokenizer:
 *
 * - preserves runtime property ordering
 * - does not canonicalize object members
 * - allows configurable circular-reference handling
 *
 * It is intended for the standard Zexi rendering pipeline rather than
 * canonical JSON serialization.
 *
 * ---------------------------------------------------------------------
 * @param value
 * Arbitrary JavaScript value to tokenize.
 *
 * @param cycles
 * Circular reference policy used during graph construction.
 *
 * @returns
 * Immutable array of tokens representing the structured form of the input.
 *
 * @since 1.0.0
 */
export default function DefaultTokenizer(
    value: unknown,
    cycles: CircularReferencePolicy
): readonly Token[] {
    const graph = GraphBuilder.build(value, { cycles, canonical: false });
    const rep = RepresentationBuilder.build(graph);
    const buffer = Tokenizer.tokenize(rep);
    return TokensBuffer.toArray(buffer);
}