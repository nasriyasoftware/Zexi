import type { Token } from "../../../../3-tokenization/types";
import type { StackTraceLine } from "../../../../1-graphing/types";
import type { EnvelopeDeferredTokens } from "../../../shared/envelope/types";
import type { ErrorStartToken } from "../../../../3-tokenization/tokens/tokenization/error";

export const ERROR_SECTIONS = ['name', 'message', 'cause', 'stack'] as const;

type Tokenizer = (value: unknown) => readonly Token[];
type ErrorSection = typeof ERROR_SECTIONS[number];
type ErrorData = {
    name: string;
    message: string;
    cause: readonly Token[];
    stack: readonly StackTraceLine[];
}

/**
 * Internal deferred rendering cache for structured error envelopes.
 *
 * `ErrorCache` collects error metadata as error-related tokens are
 * encountered during rendering and later generates the final envelope
 * payload once the error scope has completed.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN PURPOSE
 * ---------------------------------------------------------------------
 *
 * Error rendering is performed in two phases:
 *
 * 1. Collection
 *    - error sections are captured as they appear in the token stream
 *    - values are stored in the cache
 *
 * 2. Generation
 *    - the cache is sealed
 *    - a complete envelope payload is generated
 *    - the resulting tokens are injected into the renderer
 *
 * This allows renderers to defer emission of error data until all
 * required information has been collected.
 *
 * ---------------------------------------------------------------------
 * 🔷 COLLECTED SECTIONS
 * ---------------------------------------------------------------------
 *
 * The cache may store:
 *
 * - name
 * - message
 * - cause
 * - stack
 *
 * Each section may be assigned at most once.
 *
 * ---------------------------------------------------------------------
 * 🔷 DEFERRED RENDERING MODEL
 * ---------------------------------------------------------------------
 *
 * Rather than rendering individual error sections directly, renderers
 * accumulate data in this cache and generate the final envelope when
 * the corresponding `error-end` token is reached.
 *
 * This ensures:
 *
 * - complete error data availability
 * - deterministic envelope generation
 * - compatibility with canonical object ordering
 * - correct handling of nested causes
 *
 * ---------------------------------------------------------------------
 * 🔷 SEALING
 * ---------------------------------------------------------------------
 *
 * Once token generation begins, the cache becomes sealed.
 *
 * A sealed cache:
 *
 * - cannot accept additional sections
 * - cannot generate tokens again
 *
 * This guarantees deterministic one-time generation semantics.
 *
 * ---------------------------------------------------------------------
 * 🔷 INVARIANTS
 * ---------------------------------------------------------------------
 *
 * - Each error section may be assigned once
 * - Generation may occur only once
 * - Error identity remains immutable
 * - Required sections must be present before generation
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class ErrorCache {
    /**
     * Unique identifier of the error instance this cache belongs to.
     *
     * Used to ensure that tokens being processed belong to the same
     * logical error scope during rendering.
     *
     * @since 1.0.0
     */
    readonly #_id: symbol;

    /**
     * Deferred envelope token template associated with the error.
     *
     * Contains the envelope's opening and trailing token sequences that
     * surround the generated error payload.
     *
     * The payload tokens generated from collected error data are injected
     * between these token groups during final generation.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_envelope: EnvelopeDeferredTokens;

    /**
     * Internal storage for collected error sections.
     *
     * Sections are populated incrementally as error-related tokens are
     * processed by the renderer.
     *
     * A partial shape is used because sections may arrive in any order and
     * are not necessarily available simultaneously.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_data: Partial<ErrorData> = {};

    /**
     * Indicates whether token generation has already occurred.
     *
     * Once sealed:
     *
     * - additional sections cannot be assigned
     * - token generation cannot be performed again
     *
     * This enforces one-time generation semantics and prevents mutation
     * after final envelope construction.
     *
     * @internal
     * @since 1.0.0
     */
    #_sealed: boolean = false;

    /**
     * Creates a new deferred error rendering cache.
     *
     * @param error
     * The error start token that defines the logical identity of the error.
     *
     * The token's id is used to associate all collected sections with the
     * same error instance throughout rendering.
     *
     * @param envelope
     * Deferred envelope token template used to construct the final error
     * representation once generation occurs.
     *
     * @since 1.0.0
     */
    constructor(
        error: ErrorStartToken,
        envelope: EnvelopeDeferredTokens
    ) {
        this.#_id = error.id;
        this.#_envelope = envelope;
    }

    readonly #_helpers = {
        /**
         * Generates the payload token sequence representing the collected
         * error data.
         *
         * The supplied tokenizer is used to serialize a temporary object
         * representation of the collected error sections.
         *
         * When a cause is present, a placeholder value is temporarily inserted
         * into the object and later replaced with the previously captured cause
         * token sequence.
         *
         * This allows nested error causes to retain their original token
         * structure while still benefiting from normal object tokenization and
         * canonical property ordering.
         *
         * The outer object wrapper tokens generated by the tokenizer are
         * removed so that only payload tokens remain.
         *
         * @param tokenizer
         * Object tokenizer used to serialize the collected error data.
         *
         * @returns
         * The token sequence representing the error payload only.
         *
         * @throws Error
         * If required error data is missing.
         * If the cause placeholder cannot be located.
         *
         * @internal
         * @since 1.0.0
         */
        getDataTokens: (tokenizer: Tokenizer): Token[] => {
            if (!('name' in this.#_data)) {
                throw new Error(`Invariant violation: Error name was not set.`);
            }

            const data: Record<string, unknown> = {
                name: this.#_data.name,
            }

            if ('message' in this.#_data) {
                data.message = this.#_data.message;
            }

            if ('cause' in this.#_data) {
                data.cause = '<cause_placeholder>';
            }

            if ('stack' in this.#_data) {
                data.stack = this.#_data.stack;
            }

            const errTokens = [...tokenizer(data)];

            if ('cause' in this.#_data) {
                const causeIndex = errTokens.findIndex(t => t.kind === 'primitive' && t.value === '<cause_placeholder>');
                if (causeIndex === -1) {
                    throw new Error(`Invariant violation: Cause placeholder token was not found.`);
                }

                errTokens.splice(causeIndex, 1, ...this.#_data.cause!);
            }

            /**
             * Ignoring the object start and end tokens
             * 
             * Start tokens:
             * "group-start", "object-name", "object-open", "soft-line", "indent-start"
             * 
             * End tokens:
             * "indent-end", "soft-line",  "object-close", "group-end"
             */
            return errTokens.slice(5, -4);
        }
    }

    /**
     * Returns the unique identifier of the error instance represented by
     * this cache.
     *
     * This identifier is inherited from the originating error token and is
     * used to verify ownership of collected error sections.
     *
     * @returns
     * The unique error identifier.
     *
     * @since 1.0.0
     */
    get errorId(): symbol { return this.#_id; }

    /**
     * Indicates whether token generation has already occurred.
     *
     * A sealed cache is immutable and cannot accept additional section
     * assignments.
     *
     * @returns
     * `true` if generation has completed; otherwise `false`.
     *
     * @since 1.0.0
     */
    get isSealed(): boolean { return this.#_sealed; }

    /**
     * Assigns a value to an error section.
     *
     * Each section may be assigned at most once during the lifetime of the
     * cache.
     *
     * Values are validated according to the expected type of the target
     * section before being stored.
     *
     * ---------------------------------------------------------------------
     * 🔷 SECTION TYPES
     * ---------------------------------------------------------------------
     *
     * - `name` → string
     * - `message` → string
     * - `cause` → token sequence
     * - `stack` → stack trace lines
     *
     * ---------------------------------------------------------------------
     * 🔷 IMMUTABILITY
     * ---------------------------------------------------------------------
     *
     * Cause token arrays are frozen before storage to prevent accidental
     * mutation after capture.
     *
     * ---------------------------------------------------------------------
     * @template T
     * Error section name.
     *
     * @param section
     * Section to assign.
     *
     * @param value
     * Value associated with the section.
     *
     * @throws Error
     * If the cache has already been sealed.
     * If the section has already been assigned.
     * If the value type is invalid.
     *
     * @since 1.0.0
     */
    set<T extends ErrorSection>(section: T, value: ErrorData[T]) {
        if (this.#_sealed) {
            throw new Error(`Invariant violation: Cannot set error section "${section}" after completion.`);
        }

        if (!ERROR_SECTIONS.includes(section)) {
            throw new Error(`Invalid error section "${section}"`);
        }

        if (section in this.#_data) {
            throw new Error(`Invariant violation: Error section "${section}" already set`);
        }

        switch (section) {
            case 'name':
            case "message": {
                if (typeof value !== 'string') {
                    throw new Error(`Invariant violation: Error section "${section}" must be a string, received "${typeof value}"`);
                }

                break;
            }

            case 'cause': {
                if (!Array.isArray(value)) {
                    throw new Error(`Invariant violation: Error section "${section}" must be an array, received "${typeof value}"`);
                }

                if (!Object.isFrozen(value)) {
                    Object.freeze(value);
                }

                break;
            }

            case 'stack': {
                if (!Array.isArray(value)) {
                    throw new Error(`Invariant violation: Error section "${section}" must be an array, received "${typeof value}"`);
                }

                break;
            }
        }

        this.#_data[section] = value;
    }

    /**
     * Generates the final envelope token sequence for the collected error.
     *
     * Generation seals the cache and prevents any further modifications.
     *
     * The resulting token sequence consists of:
     *
     * - envelope opening tokens
     * - generated error payload tokens
     * - envelope trailing tokens
     *
     * The returned token array is frozen and safe for injection into the
     * renderer token stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 GENERATION LIFECYCLE
     * ---------------------------------------------------------------------
     *
     * Calling this method:
     *
     * 1. validates generation state
     * 2. seals the cache
     * 3. generates payload tokens
     * 4. constructs the final envelope token sequence
     *
     * ---------------------------------------------------------------------
     * @param tokenizer
     * Tokenizer used to serialize collected error data.
     *
     * @returns
     * Frozen token sequence representing the complete error envelope.
     *
     * @throws Error
     * If generation has already occurred.
     * If required error data is missing.
     *
     * @since 1.0.0
     */
    generateTokens(tokenizer: Tokenizer): readonly Token[] {
        if (this.#_sealed) {
            throw new Error(`Invariant violation: Cannot generate tokens after completion.`);
        }

        this.#_sealed = true;

        // Generate error payload tokens
        const errTokens = this.#_helpers.getDataTokens(tokenizer);

        // Construct final token sequence
        const finalTokens = [
            ...this.#_envelope.tokens.start,
            ...errTokens,
            ...this.#_envelope.tokens.trailing
        ];

        return Object.freeze(finalTokens);
    }
}

export default ErrorCache;