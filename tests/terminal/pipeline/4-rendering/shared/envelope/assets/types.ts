import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import type { DEFERRED_BODY_ENVELOPES_VALUES } from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/consts";
import type { EnvelopeKind, EnvelopeMap } from "../../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/types";

export type IsDeferred<K extends EnvelopeKind> = K extends typeof DEFERRED_BODY_ENVELOPES_VALUES[number] ? true : false;
export type GenerateFunctions = {
    [K in EnvelopeKind]: () => Contract<K>
}

/**
 * Describes the exact location of a property token within a token stream.
 *
 * Contract tests use absolute token indices intentionally. The goal is
 * not merely to verify semantic correctness, but to assert the precise
 * layout emitted by the tokenization pipeline.
 *
 * Any change to token ordering, grouping, indentation, separators, or
 * emitted structure is expected to cause these positions to change and
 * therefore fail the contract test.
 *
 * When such changes are intentional, the corresponding contract should
 * be updated to reflect the new expected output.
 * 
 * @since 1.0.0
 */
export type PropItem = {
    /**
     * Expected property name.
     * @since 1.0.0
     */
    name: string;

    /**
     * Exact index of the property token in the flattened stream.
     * @since 1.0.0
     */
    index: number;

    /**
     * Optional description of the property's value token.
     * @since 1.0.0
     */
    value?: {
        /**
         * Exact index of the value token in the flattened stream.
         * @since 1.0.0
         */
        index: number;

        /**
         * Expected primitive type emitted by the tokenizer.
         * @since 1.0.0
         */
        type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'symbol';

        /**
         * Optional expected value.
         *
         * If omitted, no value is validated.
         * @since 1.0.0
         */
        value?: string | number | boolean | symbol | null | undefined
    }
}

/**
 * Expected token stream emitted by deferred envelopes.
 *
 * Deferred envelopes emit two independent token partitions separated by
 * a pair of anchor tokens. The rendered stream is represented as:
 *
 *   start + trailing
 *
 * where:
 *
 * - `start` contains the opening portion of the envelope.
 * - `trailing` contains the closing portion of the envelope.
 * - `full` represents the flattened stream used for positional checks.
 *
 * Contract tests verify both partitions independently and also validate
 * anchor placement within the combined stream.
 * 
 * @since 1.0.0
 */
export type DeferredStream = {
    readonly full: Token['kind'][],
    start: Token['kind'][],
    trailing: Token['kind'][]
}

/**
 * Defines the tokenization contract for a specific envelope kind.
 *
 * A contract is a formal specification of the exact token output
 * expected from each tokenizer implementation.
 *
 * These contracts intentionally verify:
 *
 * - exact token ordering
 * - exact token positions
 * - exact property locations
 * - exact primitive value locations
 * - exact anchor placement for deferred envelopes
 *
 * The purpose is to detect *any* modification to the emitted token
 * stream, whether caused by implementation changes, refactors, layout
 * adjustments, ordering changes, or serializer behavior changes.
 *
 * Contract failures are expected whenever token emission changes.
 * Intentional changes should be accompanied by an update to the
 * corresponding contract definition.
 * 
 * @since 1.0.0
 */
export type Contract<K extends EnvelopeKind> = {
    /**
     * Indicates whether this envelope emits a deferred token stream.
     * @since 1.0.0
     */
    deferred: IsDeferred<K>;

    /**
     * Envelope kind under test.
     * @since 1.0.0
     */
    kind: K;

    /**
     * Payload used to construct the envelope during contract execution.
     * @since 1.0.0
     */
    payload: EnvelopeMap[K];

    /**
     * Expected output for every tokenizer mode.
     * @since 1.0.0
     */
    tokenizers: {
        /**
         * Tokenizer configuration being validated.
         * @since 1.0.0
         */
        name: 'json' | 'ignoredCycles' | 'markedCycles';

        /**
         * Expected emitted token stream.
         *
         * For deferred envelopes this contains the expected start and
         * trailing partitions. For complete envelopes this contains the
         * full flattened stream.
         * 
         * @since 1.0.0
         */
        stream: IsDeferred<K> extends false ? Token['kind'][] : DeferredStream;

        /**
         * Exact positions of important semantic tokens within the
         * flattened stream.
         * 
         * @since 1.0.0
         */
        positions: {
            /**
             * Expected property and value locations.
             * @since 1.0.0
             */
            props: PropItem[]
        } & (
            IsDeferred<K> extends true
            ? {
                /**
                 * Exact indices of the start and end anchor tokens
                 * within the flattened stream.
                 * 
                 * @since 1.0.0
                 */
                anchors: number[]
            } : {}
        )
    }[]
}