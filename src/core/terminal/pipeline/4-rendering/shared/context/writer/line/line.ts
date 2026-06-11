import LineIndent from "./indent";

export const WRITER_LINE_COPY_KEY = Symbol('copy-writing-line');

/**
 * Represents a single renderable line in the streaming layout system.
 *
 * A WritingLine is a *transactional layout unit* that accumulates:
 *
 * - indentation (via LineIndent)
 * - content segments
 * - width tracking
 * - lifecycle state (finalized / mutable)
 *
 * It supports deep cloning to enable speculative rendering,
 * sub-writer composition, and safe structural merging.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * WritingLine is designed as a lazy, composable unit of output.
 * It does not immediately commit layout decisions until content is written.
 *
 * This enables:
 *
 * - streaming construction of output
 * - safe line cloning for sub-contexts
 * - deferred indentation resolution
 * - controlled finalization of output state
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * A WritingLine progresses through these states:
 *
 * 1. Created (no content, no indentation applied)
 * 2. Active (first content write triggers indentation)
 * 3. Finalized (no further modifications allowed)
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - No content can be added after finalization
 * - Indentation is applied lazily on first write
 * - Width includes both indentation and content width
 * - Cloning produces a deep structural copy
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH MODEL
 * ---------------------------------------------------------------------
 *
 * ```ts
 * width = indent.width + content.width
 * ```
 *
 * This represents the full visual space consumed by the line.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTENT MODEL
 * ---------------------------------------------------------------------
 *
 * Content is stored as immutable string segments:
 *
 * - segments are appended incrementally
 * - width is updated incrementally
 * - segments are concatenated only during rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION
 * ---------------------------------------------------------------------
 *
 * Once finalized, a line becomes immutable and cannot be modified.
 * This ensures deterministic output during consumption and merging.
 *
 * ---------------------------------------------------------------------
 * 🔷 CLONING SEMANTICS
 * ---------------------------------------------------------------------
 *
 * Cloning creates a deep copy of:
 *
 * - indentation state
 * - content segments
 * - lifecycle flags
 *
 * This enables safe sub-writer creation without shared mutation.
 */
class WritingLine {
    /**
     * Handles indentation lifecycle for this line.
     *
     * Indentation is lazily applied when the first visible content
     * is added to the line.
     *
     * @since 1.0.0
     */
    readonly #_indent: LineIndent;

    /**
     * Internal content buffer for this line.
     *
     * Contains:
     * - `segments`: immutable string fragments that compose the line
     * - `width`: accumulated width of content segments only
     *
     * Note: this excludes indentation width.
     *
     * @since 1.0.0
     */
    readonly #_content: {
        /**
         * Ordered list of string fragments composing the line content.
         *
         * These segments are concatenated only during rendering (`toString`).
         *
         * @since 1.0.0
         */
        segments: string[];

        /**
         * Total width of all content segments combined.
         *
         * This does not include indentation width.
         *
         * @since 1.0.0
         */
        width: number;
    }

    /**
     * Lifecycle flags controlling mutation state of the line.
     *
     * Currently tracks whether the line has been finalized.
     *
     * @since 1.0.0
     */
    readonly #_flags: {
        /**
         * Indicates whether the line has been finalized.
         *
         * Once true:
         * - no further content can be added
         * - the line becomes immutable
         *
         * @since 1.0.0
         */
        finalized: boolean;
    };

    /**
     * Constructs a new WritingLine instance.
     *
     * If a copy is provided, a deep structural clone is created.
     * Otherwise, a fresh empty line is initialized.
     *
     * @param copy optional cloning context
     *
     * @since 1.0.0
     */
    constructor(copy?: {
        /**
         * Security token required to authorize cloning.
         *
         * Prevents external unauthorized instantiation of copied state.
         *
         * @since 1.0.0
         */
        authKey: symbol;

        /**
         * Source WritingLine instance to clone.
         *
         * @since 1.0.0
         */
        instance: WritingLine;
    }) {
        if (copy) {
            if (copy.authKey !== WRITER_LINE_COPY_KEY) {
                throw new Error('Invariant violation: cannot copy writing line.');
            }

            this.#_indent = copy.instance.#_indent.clone();

            this.#_content = {
                width: copy.instance.#_content.width,
                segments: [...copy.instance.#_content.segments]
            }

            this.#_flags = { ...copy.instance.#_flags };
        } else {
            this.#_indent = new LineIndent();
            this.#_content = { segments: [], width: 0 };
            this.#_flags = { finalized: false };
        }
    }

    /**
     * Returns the total visual width of the line.
     *
     * This includes:
     * - indentation width
     * - content width
     *
     * This value is used for layout calculations such as wrapping.
     *
     * @returns total rendered width of the line
     *
     * @since 1.0.0
     */
    get width() {
        return this.#_indent.width + this.#_content.width;
    }

    /**
     * Indicates whether the line contains any visible content.
     *
     * A line is considered to have content if at least one segment
     * has been written.
     *
     * @returns true if line has content, false otherwise
     *
     * @since 1.0.0
     */
    get hasContent() {
        return this.#_content.width > 0;
    }

    /**
     * Indicates whether this line has been finalized.
     *
     * Finalized lines are immutable and cannot be modified.
     *
     * @returns true if line is finalized
     *
     * @since 1.0.0
     */
    get finalized() {
        return this.#_flags.finalized;
    }

    /**
     * Finalizes the line, making it immutable.
     *
     * After calling this method:
     * - no further content can be added
     * - the line becomes a stable output unit
     *
     * This is used during consumption and layout finalization.
     *
     * @since 1.0.0
     */
    finalize() {
        this.#_flags.finalized = true;
    }

    /**
     * Adds a content segment to the line.
     *
     * If this is the first visible content write:
     * - indentation is applied before content insertion
     *
     * @param segment string fragment to append
     * @param depthBasedSpaces indentation width used if indentation is pending
     *
     * @throws if the line is finalized
     *
     * @since 1.0.0
     */
    add(segment: string, depthBasedSpaces = 0) {
        if (this.finalized) {
            throw new Error('Invariant violation: cannot add content to a finalized line.');
        }

        if (segment.length === 0) {
            return;
        }

        if (this.#_indent.status === 'pending') {
            this.#_indent.apply(depthBasedSpaces);
        }

        this.#_content.segments.push(segment);
        this.#_content.width += segment.length;
    }

    /**
     * Serializes the line into a formatted string.
     *
     * The output includes:
     * - resolved indentation
     * - concatenated content segments
     *
     * This method does not mutate internal state.
     *
     * @returns formatted line string
     *
     * @since 1.0.0
     */
    toString() {
        return ' '.repeat(this.#_indent.width) + this.#_content.segments.join('');
    }

    /**
     * Creates a deep copy of a WritingLine instance.
     *
     * This ensures full structural isolation between:
     * - original line
     * - cloned line
     *
     * @param line source instance
     * @returns cloned WritingLine
     *
     * @since 1.0.0
     */
    static from(line: WritingLine): WritingLine {
        return new WritingLine({ authKey: WRITER_LINE_COPY_KEY, instance: line });
    }
}

export default WritingLine;