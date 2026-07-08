import WritingLine from "./line/line";
import type TraversalDepth from "../traversal/traversal.depth";
import type { WriterConfig } from "./types";
import consoleStyler from "../../../../../styling/styler";

/**
 * Internal authentication symbol used to validate safe construction
 * of branch writer branches.
 *
 * Only `RenderingWriter` itself is allowed to produce valid copies
 * containing this symbol.
 *
 * This prevents external code from forging branche line state.
 *
 * @internal
 */
const copySymbol = Symbol('consumption');

/**
 * Streaming layout-aware rendering engine.
 *
 * `RenderingWriter` is responsible for incrementally constructing
 * a formatted textual output from streaming input segments.
 *
 * It operates on a **line-based layout model** with strict control over:
 *
 * - indentation (based on traversal depth)
 * - soft wrapping using max-width constraints
 * - line segmentation and continuation logic
 * - hierarchical composition via branch writers
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE ARCHITECTURE
 * ---------------------------------------------------------------------
 *
 * The writer maintains an ordered list of `WritingLine` instances.
 * Each line represents an immutable layout unit during rendering,
 * except for the current active line.
 *
 * Each line tracks:
 *
 * - indentation (static per-line once applied)
 * - content segments (incremental string fragments)
 * - total width (indent + content length)
 * - content state (whether visible content has been written)
 *
 * The writer always writes into the **current active line**.
 *
 * ---------------------------------------------------------------------
 * 🔷 WRITING MODEL
 * ---------------------------------------------------------------------
 *
 * Writing is streaming and incremental:
 *
 * - input strings may contain multiple logical lines (`\n`)
 * - each segment is processed sequentially
 * - long segments are split using width-aware wrapping rules
 *
 * Wrapping behavior:
 *
 * - if segment fits → written directly
 * - if it exceeds width → split at optimal whitespace boundary
 * - otherwise → forced split at max width
 *
 * ---------------------------------------------------------------------
 * 🔷 INDENTATION MODEL
 * ---------------------------------------------------------------------
 *
 * Indentation is applied lazily:
 *
 * - only applied when writing into an empty line
 * - based on traversal depth and optional extra indentation
 * - suppressed when indentation itself exceeds max width
 *
 * Overflow rule:
 *
 * - if computed indentation ≥ maxWidth
 *   → indentation is replaced with 0
 *   → line is treated as overflow-safe
 *
 * ---------------------------------------------------------------------
 * 🔷 BRANCHING MODEL (SUB-WRITERS)
 * ---------------------------------------------------------------------
 *
 * Writers may spawn independent branch writers via `branches.create()`.
 *
 * Each branch:
 *
 * - clones the current line at creation time
 * - inherits layout context (depth, spacing, maxWidth)
 * - writes independently without affecting parent
 *
 * Branch restrictions:
 *
 * - parent writer is immutable while branches exist
 * - branches must be explicitly consumed or discarded
 *
 * ---------------------------------------------------------------------
 * 🔷 CONSUMPTION MODEL
 * ---------------------------------------------------------------------
 *
 * A branch writer is merged back into its parent via `consume()`.
 *
 * Merge semantics:
 *
 * - parent removes its last line (outdated reference)
 * - replaces it with all lines from the branch
 * - updates current line reference to branch’s last line
 * - marks branch as consumed (immutable afterward)
 *
 * Only branch writers created via `branches.create()` are valid
 * consumption targets.
 *
 * ---------------------------------------------------------------------
 * 🔷 IMMUTABILITY RULES
 * ---------------------------------------------------------------------
 *
 * A writer becomes immutable when:
 *
 * - it has been consumed
 * - or it has active branches
 *
 * This guarantees deterministic composition and prevents conflicting
 * modifications across concurrent branches.
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL SAFETY RULES
 * ---------------------------------------------------------------------
 *
 * - writing is forbidden after consumption
 * - writing is forbidden while branches exist
 * - branch ownership is strictly enforced
 *
 * These rules guarantee structural consistency of the final output.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class RenderingWriter {
    /**
     * Traversal depth controller.
     *
     * Determines base indentation level for all lines.
     *
     * Used as:
     *
     * - base structural indentation
     * - hierarchical nesting depth
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_depth: TraversalDepth;

    /**
     * Number of spaces per indentation level.
     *
     * Used to compute final indentation width:
     *
     * depth × spaces
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_spaces: number;

    /**
     * Maximum allowed width for a line.
     *
     * ---------------------------------------------------------------------
     * 🔷 ROLE IN THE WRITER MODEL
     * ---------------------------------------------------------------------
     *
     * This value is purely informational and does NOT influence rendering
     * behavior.
     *
     * The writer does not perform any wrapping, truncation, or layout
     * enforcement based on this value.
     *
     * Instead, `maxWidth` is exposed as a constraint signal for external
     * systems (such as layout resolvers and renderers) to make decisions
     * about formatting strategy.
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY BOUNDARY
     * ---------------------------------------------------------------------
     *
     * The writer is strictly an output accumulator and is responsible only for:
     *
     * - collecting written segments
     * - managing line boundaries explicitly requested via `newLine()`
     * - tracking line state and indentation metadata
     *
     * It does NOT:
     *
     * - split long input automatically
     * - enforce width constraints
     * - modify input based on layout rules
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN GUARANTEE
     * ---------------------------------------------------------------------
     *
     * Line width constraints are handled entirely outside the writer,
     * ensuring that layout policy remains decoupled from output generation.
     *
     * @internal
     */
    readonly #_maxWidth: number = Infinity

    /**
     * Ordered collection of all rendered lines.
     *
     * Each entry represents a finalized or active layout unit.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_lines: WritingLine[] = [];

    /**
     * Reference to the currently active line.
     *
     * All write operations mutate this line unless a new line is created.
     *
     * @internal
     * @since 1.0.0
     */
    #_currentLine!: WritingLine;

    /**
     * Active branch writers spawned from this writer.
     *
     * While non-empty:
     *
     * - parent writer becomes write-protected
     * - structural mutations are disallowed
     *
     * @internal
     */
    #_branches = new Set<RenderingWriter>();

    /**
     * Indicates whether this writer has been consumed into another writer.
     *
     * Once true:
     *
     * - all write operations are forbidden
     * - internal state is considered finalized
     *
     * @internal
     * @since 1.0.0
     */
    #_consumed = false;

    /**
     * Creates a new RenderingWriter instance.
     *
     * If `subContext` is provided, this writer is constructed as a branch
     * inheriting an existing line state.
     *
     * Branch construction is protected via `copySymbol` to ensure only
     * trusted internal copies are allowed.
     *
     * ---------------------------------------------------------------------
     * 🔷 MODES
     * ---------------------------------------------------------------------
     *
     * 1. Root writer:
     *    - initializes fresh line
     *
     * 2. Branch writer:
     *    - inherits current line snapshot
     *    - validates auth key via `copySymbol`
     *
     * ---------------------------------------------------------------------
     * @param config writer configuration including layout constraints
     *
     * @throws if subContext authKey is invalid
     *
     * @since 1.0.0
     */
    constructor(config: WriterConfig) {
        this.#_depth = config.depth;
        this.#_spaces = config.spaces;

        if (config.maxWidth !== undefined) {
            this.#_maxWidth = config.maxWidth;
        }

        if (config.subContext) {
            if (config.subContext.authKey !== copySymbol) {
                throw new Error('Invariant violation: copy.authKey !== copySymbol');
            }

            this.#_currentLine = config.subContext.currentLine;
            this.#_lines.push(this.#_currentLine);
        } else {
            this.newLine();
        }
    }

    /**
     * Indicates whether this writer has been consumed.
     *
     * A consumed writer is immutable and cannot be modified.
     *
     * @since 1.0.0
     */
    get consumed() { return this.#_consumed; }

    /**
     * Computes remaining width available in the current line.
     *
     * Calculation:
     *
     * maxWidth - currentLine.width
     *
     * This value determines whether a segment fits directly or must be wrapped.
     *
     * @internal
     * @since 1.0.0
     */
    get #_remainingWidth() {
        return this.#_maxWidth - this.#_currentLine.width;
    }

    /**
     * Computes indentation for the current line.
     *
     * Indentation rules:
     *
     * - only applied if line has no content
     * - derived from traversal depth and optional extra indentation
     * - suppressed if it would exceed max width (overflow mode)
     *
     * Overflow behavior:
     *
     * - if computed indent ≥ maxWidth:
     *   → indentation is replaced with 0
     *   → overflow flag is returned
     *
     * @param extraIndents - temporary indentation offset applied to depth
     *
     * @returns Object containing:
     * - indent: resolved indentation width (0 if overflowed)
     * - overflow: whether indentation exceeded max width
     *
     * @internal
     * @since 1.0.0
     */
    #_getIndentation(extraIndents: number) {
        const indent = this.#_currentLine.hasContent
            ? 0
            : this.#_spaces * (this.#_depth.value + extraIndents);

        return indent >= this.#_maxWidth ? 0 : indent;
    }

    /**
     * Writes a raw segment into the current line.
     *
     * Responsibilities:
     *
     * - ensures segment is non-empty
     * - applies indentation if provided by caller
     * - delegates actual storage to WritingLine
     *
     * This method does NOT perform wrapping or validation.
     *
     * @param segment - string fragment to append
     * @param indent - computed indentation (0 if none)
     *
     * @internal
     * @since 1.0.0
     */
    #_writeToLine(segment: string, indent: number) {
        if (segment.length === 0) { return; }
        this.#_currentLine.add(segment, indent);
    }

    /**
     * Writes a value into the rendering buffer.
     *
     * Input may contain newline characters, which are treated as:
     *
     * - explicit line breaks
     * - forced segment boundaries
     *
     * Each segment is processed independently through the layout engine.
     *
     * ---------------------------------------------------------------------
     * Behavior guarantees:
     * ---------------------------------------------------------------------
     *
     * - respects maxWidth constraints when active
     * - applies indentation only on empty lines
     * - splits long segments safely
     * - prevents writes during branch state
     * - prevents writes after consumption
     *
     * @param value - raw input string
     * @param options.newLine - forces line break before writing
     * @param options.extraIndents - temporary indentation offset
     *
     * @returns this writer for chaining
     *
     * @since 1.0.0
     */
    write(
        value: string,
        options?: {
            /** Whether to insert a newline before writing */
            newLine?: boolean;

            /**
             * A positive number to temporarily adjust indentation.
             *
             * Example:
             * - depth = 2, extraIndents = 1 → effective indent = 3
             *
             * Only applied if the write occurs at the start of a line.
             *
             * @default 0
             */
            extraIndents?: number;
        }
    ): this {
        if (this.consumed) {
            throw new Error('Invariant violation: Attempting to write to a writer that has already been consumed.');
        }

        if (this.#_branches.size > 0) {
            throw new Error('Invariant violation: A writer with branches cannot be modified - Attempted: "write".');
        }

        if (options?.newLine === true) {
            this.newLine();
        }

        const extraIndents = options?.extraIndents ?? 0;
        const parts = value.split('\n');

        for (let i = 0; i < parts.length; i++) {
            const segment = parts[i];
            const indent = this.#_getIndentation(extraIndents);

            this.#_writeToLine(segment, indent);

            if (i < parts.length - 1) {
                this.newLine();
            }
        }

        return this;
    }

    /**
     * Determines whether a given string can fit into the current line
     * without exceeding the available width constraints.
     *
     * This method is a pure width evaluation utility used by layout-sensitive
     * renderers to determine whether a value can be appended to the current
     * line or whether rendering should fall back to block layout.
     *
     * ---------------------------------------------------------------------
     * 🔷 SCOPE OF EVALUATION
     * ---------------------------------------------------------------------
     *
     * This method evaluates only the currently active output line.
     *
     * It does NOT:
     *
     * - inspect previously written lines
     * - consider overall writer history
     * - interpret layout state (inline vs block)
     * - modify the writer state
     *
     * The existence of multiple lines has no effect on this calculation.
     *
     * ---------------------------------------------------------------------
     * 🔷 ANSI-AWARE WIDTH MEASUREMENT
     * ---------------------------------------------------------------------
     *
     * The supplied string may already contain ANSI escape sequences used for
     * terminal styling (colors, background colors, text styles, etc.).
     *
     * These escape sequences occupy characters in the string but produce no
     * visible output and therefore contribute nothing to the rendered width.
     *
     * Before measuring the input, all ANSI escape sequences are removed using:
     *
     * ```
     * consoleStyler.strip(value)
     * ```
     *
     * Width calculations are therefore based solely on the visible characters
     * that will actually appear in the terminal.
     *
     * Example:
     *
     * ```
     * "\x1b[31mHello\x1b[0m"
     * ```
     *
     * is treated as having a width of:
     *
     * ```
     * 5
     * ```
     *
     * rather than the length of the raw escape sequence.
     *
     * ---------------------------------------------------------------------
     * 🔷 WIDTH MODEL
     * ---------------------------------------------------------------------
     *
     * The decision is based solely on:
     *
     * ```
     * remainingWidth = maxWidth - currentLine.width
     * visibleLength = consoleStyler.strip(value).length
     * ```
     *
     * A value is considered fitable if:
     *
     * ```
     * visibleLength <= remainingWidth
     * ```
     *
     * ---------------------------------------------------------------------
     * 🔷 RESPONSIBILITY BOUNDARY
     * ---------------------------------------------------------------------
     *
     * This method intentionally remains a low-level utility.
     *
     * It does NOT:
     *
     * - decide whether inline rendering should be used
     * - trigger layout aborts or retries
     * - interpret rendering context
     * - inspect token structure
     *
     * Higher-level renderer logic is responsible for:
     *
     * - selecting inline or block layout
     * - aborting rendering when inline capacity is exceeded
     * - restarting rendering under alternate layout strategies
     *
     * ---------------------------------------------------------------------
     * 🔷 DESIGN INTENT
     * ---------------------------------------------------------------------
     *
     * By measuring only visible characters, this method guarantees that
     * terminal styling never influences layout decisions.
     *
     * As a result, inline-fit calculations remain deterministic regardless of
     * whether ANSI rendering is enabled, ensuring identical layout behavior
     * between styled and unstyled output.
     *
     * @param value
     * The string to evaluate. The string may contain ANSI escape sequences,
     * which are ignored when determining its rendered width.
     *
     * @returns
     * `true` if the visible portion of the string fits within the remaining
     * space of the current line; otherwise `false`.
     *
     * @since 1.0.0
     */
    canFitInline(value: string): boolean {
        const inputLength = consoleStyler.strip(value).length;
        return this.#_remainingWidth >= inputLength;
    }

    /**
     * Forces creation of a new active line.
     *
     * This method:
     *
     * - finalizes the current line explicitly
     * - creates a fresh `WritingLine`
     * - switches active context to the new line
     *
     * Restrictions:
     *
     * - cannot be called when writer has active branches
     * - cannot be called after consumption
     *
     * @returns this writer for chaining
     *
     * @since 1.0.0
     */
    newLine(): this {
        if (this.consumed) {
            throw new Error('Invariant violation: Attempting to write to a writer that has already been consumed.');
        }

        if (this.#_branches.size > 0) {
            throw new Error('Invariant violation: A writer with branches cannot be modified - Attempted: "newLine".');
        }

        if (this.#_currentLine) {
            this.#_currentLine.finalize();
        }

        const line = new WritingLine();
        this.#_lines.push(line);
        this.#_currentLine = line;

        return this;
    }

    /**
     * Serializes the entire writer output into a string.
     *
     * Each line is rendered as:
     *
     * indent + concatenated segments
     *
     * Lines are joined using newline characters.
     *
     * This operation is:
     *
     * - pure (no mutation)
     * - deterministic
     * - safe to call multiple times
     *
     * @returns final rendered string
     *
     * @since 1.0.0
     */
    toString() {
        return this.#_lines.map(line => line.toString()).join('\n');
    }

    /**
     * Merges a branch writer into this writer.
     *
     * This operation replaces the parent's last line with
     * the full line set of the branch writer.
     *
     * Steps:
     *
     * 1. validate ownership of branch
     * 2. remove outdated last line
     * 3. append branch lines
     * 4. update current line reference
     * 5. mark branch as consumed
     * 6. clear branch registry
     *
     * This ensures deterministic hierarchical composition.
     *
     * @param writer - branch writer to merge
     *
     * @throws if writer is not a registered branch
     *
     * @since 1.0.0
     */
    consume(writer: RenderingWriter) {
        if (this.consumed) {
            throw new Error('Invariant violation: Attempting to consume a writer that has already been consumed.');
        }

        if (this.#_branches.size === 0) {
            throw new Error('A writer with no branches cannot consume other writers.')
        }

        if (!this.#_branches.has(writer)) {
            throw new Error('Invariant violation: Attempting to consume a writer that doesn\'t belong to this writer.');
        }

        this.branches.discardAll();

        // Merge lines (skip last line since it has been copied and modfied)
        this.#_lines.pop();
        this.#_lines.push(...writer.#_lines);

        // update current line reference
        this.#_currentLine = this.#_lines[this.#_lines.length - 1];

        // mark writer as consumed
        writer.#_consumed = true;
        writer.#_branches.clear();
    }

    readonly branches = {
        /**
         * Creates a new branch writer derived from the current state.
         *
         * The branch:
         *
         * - inherits depth, spacing, and width constraints
         * - clones current active line
         * - writes independently from parent
         *
         * Branch lifecycle:
         *
         * - must be consumed or discarded
         * - prevents parent modifications while active
         *
         * @returns new RenderingWriter branch instance
         *
         * @since 1.0.0
         */
        create: () => {
            if (this.consumed) {
                throw new Error('Invariant violation: Attempting to create a branche for a writer that has already been consumed.');
            }

            const writeConfig: WriterConfig = {
                depth: this.#_depth,
                spaces: this.#_spaces,
                maxWidth: this.#_maxWidth,
                subContext: {
                    authKey: copySymbol,
                    currentLine: WritingLine.from(this.#_currentLine)
                }
            }

            const newWriter = new RenderingWriter(writeConfig);
            this.#_branches.add(newWriter);

            return newWriter;
        },

        /**
         * Removes a branch from tracking without merging it.
         *
         * This effectively abandons the branch.
         *
         * @param writer - branch to remove
         *
         * @since 1.0.0
         */
        discard: (writer: RenderingWriter) => {
            this.#_branches.delete(writer);
        },

        /**
         * Removes all active branches.
         *
         * After this call:
         *
         * - parent writer becomes writable again
         * - all branch references are invalidated
         *
         * @since 1.0.0
         */
        discardAll: () => {
            this.#_branches.clear();
        }
    }

    /**
     * Creates a new branch writer from an existing writer.
     *
     * Equivalent to:
     *
     * writer.branches.create()
     *
     * @param writer - parent writer
     *
     * @returns new branch writer instance
     *
     * @since 1.0.0
     */
    static from(writer: RenderingWriter) {
        return writer.branches.create();
    }
}

export default RenderingWriter;