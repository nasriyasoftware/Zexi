import DefaultTokenizer from "../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/default.tokenizer";
import JSONTokenizer from "../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import TOKENS from "../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import type { Token } from "../../../../../src/core/terminal/pipeline/3-tokenization/types";

/**
 * Extracts the `kind` field from every token in a token sequence.
 *
 * This helper provides a concise way to assert the structural shape of a
 * token stream without inspecting individual token instances.
 *
 * It is primarily used when verifying token ordering or comparing the
 * overall structure produced by a tokenizer.
 *
 * @param tokens
 * Token sequence to inspect.
 *
 * @returns
 * Array containing the `kind` of each token in traversal order.
 * 
 * @since 1.0.0
 */
const extractKinds = (tokens: readonly Token[]) => tokens.map(t => t.kind);

/**
 * Asserts that a token is a primitive token representing the supplied value.
 *
 * The helper verifies:
 *
 * - the token is an instance of `Primitive`
 * - the stored value matches the expected value
 * - the inferred primitive type matches JavaScript semantics
 *
 * `null` is treated specially since JavaScript reports its type as
 * `"object"` while Zexi represents it as `"null"`.
 *
 * @param t
 * Token expected to be a primitive.
 *
 * @param value
 * Expected primitive value.
 * 
 * @since 1.0.0
 */
const expectPrimitive = (t: Token, value: unknown) => {
    const token = t as InstanceType<typeof TOKENS.Primitive>;

    expect(token).toBeInstanceOf(TOKENS.Primitive);
    expect(token.value).toBe(value);
    expect(token.type).toBe(value === null ? "null" : typeof value);
}

/**
 * Verifies that a token sequence represents a complete standalone error.
 *
 * This helper validates both the structural ordering and the semantic
 * relationships between the generated error tokens.
 *
 * The following invariants are verified:
 *
 * - the expected error token sequence is produced
 * - all tokens have the correct runtime types
 * - every error-scoped token references the same error identifier
 * - the error name and message match the supplied Error instance
 * - the generated stack trace belongs to the error
 * - the outer group is correctly opened and closed
 *
 * This helper is intended for errors without a nested `cause`.
 *
 * @param tokens
 * Token sequence representing an error.
 *
 * @param err
 * Original error used to produce the tokens.
 * 
 * @since 1.0.0
 */
const expectError = (tokens: Token[] | readonly Token[], err: Error) => {
    const kinds = extractKinds(tokens);

    expect(kinds).toEqual([
        'group-start',
        'error-start',
        'error-data',
        'stack-trace',
        'error-end',
        'group-end'
    ]);

    const t0 = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
    expect(t0).toBeInstanceOf(TOKENS.GroupStart);
    expect(t0.kind).toBe("group-start");
    expect(typeof t0.id).toBe("symbol");

    const t1 = tokens[1] as InstanceType<typeof TOKENS.ErrorStart>;
    expect(t1).toBeInstanceOf(TOKENS.ErrorStart);
    expect(t1.kind).toBe("error-start");
    expect(t1.id).not.toBeUndefined();
    expect(typeof t1.id).toBe("symbol");

    const errorDataToken = tokens[2] as InstanceType<typeof TOKENS.ErrorData>;
    expect(errorDataToken).toBeInstanceOf(TOKENS.ErrorData);
    expect(errorDataToken.errorId).not.toBeUndefined();
    expect(errorDataToken.errorId).toBe(t1.id);
    expect(errorDataToken.name).toBe(err.name);
    expect(errorDataToken.message).toBe(err.message.length > 0 ? err.message : undefined);

    const t3 = tokens[3] as InstanceType<typeof TOKENS.StackTrace>;
    expect(t3).toBeInstanceOf(TOKENS.StackTrace);
    expect(t3.kind).toBe("stack-trace");
    expect(t3.lines).not.toBeUndefined();
    expect(Array.isArray(t3.lines)).toBe(true);
    expect(t3.ownership).toBe("error");

    const t4 = tokens[4] as InstanceType<typeof TOKENS.ErrorEnd>;
    expect(t4).toBeInstanceOf(TOKENS.ErrorEnd);
    expect(t4.kind).toBe("error-end");
    expect(t4.errorId).toBe(t1.id);

    const t5 = tokens[5] as InstanceType<typeof TOKENS.GroupEnd>;
    expect(t5).toBeInstanceOf(TOKENS.GroupEnd);
    expect(t5.kind).toBe("group-end");
    expect(t5.groupId).toBe(t0.id);
}

/**
 * Verifies that a token sequence represents an error containing a nested
 * cause error.
 *
 * Unlike {@link expectError}, this helper validates the additional
 * error-cause wrapper and ensures that the root error remains correctly
 * linked to its nested error subtree.
 *
 * The helper verifies:
 *
 * - the root error structure
 * - the presence of an `error-cause` section
 * - that the nested error is emitted as an independent error subtree
 * - identifier relationships between the root error and its cause wrapper
 * - correct termination of both the cause section and the root error
 *
 * The nested error itself is expected to have already been tokenized
 * independently within the overall sequence.
 *
 * @param tokens
 * Token sequence representing an error with a nested cause.
 *
 * @param err
 * Original root error.
 * 
 * @since 1.0.0
 */
const expectErrorWithCause = (tokens: Token[] | readonly Token[], err: Error) => {
    const kinds = extractKinds(tokens);

    const p1 = kinds.slice(0, 4);
    expect(p1).toEqual([
        'group-start',
        'error-start',
        'error-data',
        'error-cause-start'
    ]);

    const p1t0 = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
    expect(p1t0).toBeInstanceOf(TOKENS.GroupStart);
    expect(p1t0.kind).toBe("group-start");
    expect(typeof p1t0.id).toBe("symbol");

    const p1t1 = tokens[1] as InstanceType<typeof TOKENS.ErrorStart>;
    expect(p1t1).toBeInstanceOf(TOKENS.ErrorStart);
    expect(p1t1.kind).toBe("error-start");
    expect(p1t1.id).not.toBeUndefined();
    expect(typeof p1t1.id).toBe("symbol");

    const errorDataToken = tokens[2] as InstanceType<typeof TOKENS.ErrorData>;
    expect(errorDataToken).toBeInstanceOf(TOKENS.ErrorData);
    expect(errorDataToken.errorId).not.toBeUndefined();
    expect(errorDataToken.errorId).toBe(p1t1.id);
    expect(errorDataToken.name).toBe(err.name);
    expect(errorDataToken.message).toBe(err.message.length > 0 ? err.message : undefined);

    const p1t3 = tokens[3] as InstanceType<typeof TOKENS.ErrorCauseStart>;
    expect(p1t3).toBeInstanceOf(TOKENS.ErrorCauseStart);
    expect(p1t3.kind).toBe("error-cause-start");
    expect(p1t3.errorId).toBe(p1t1.id);


    const p2 = kinds.slice(-4);
    expect(p2).toEqual([
        'error-cause-end',
        'stack-trace',
        'error-end',
        'group-end'
    ]);

    const p2t0 = tokens[tokens.length - 4] as InstanceType<typeof TOKENS.ErrorCauseEnd>;
    expect(p2t0).toBeInstanceOf(TOKENS.ErrorCauseEnd);
    expect(p2t0.kind).toBe("error-cause-end");
    expect(p2t0.errorId).toBe(p1t1.id);

    const p2t3 = tokens[tokens.length - 3] as InstanceType<typeof TOKENS.StackTrace>;
    expect(p2t3).toBeInstanceOf(TOKENS.StackTrace);
    expect(p2t3.kind).toBe("stack-trace");
    expect(p2t3.lines).not.toBeUndefined();
    expect(Array.isArray(p2t3.lines)).toBe(true);
    expect(p2t3.errorId).toBe(p1t1.id);
    expect(p2t3.ownership).toBe("error");

    const p2t4 = tokens[tokens.length - 2] as InstanceType<typeof TOKENS.ErrorEnd>;
    expect(p2t4).toBeInstanceOf(TOKENS.ErrorEnd);
    expect(p2t4.kind).toBe("error-end");
    expect(p2t4.errorId).toBe(p1t1.id);

    const p2t5 = tokens[tokens.length - 1] as InstanceType<typeof TOKENS.GroupEnd>;
    expect(p2t5).toBeInstanceOf(TOKENS.GroupEnd);
    expect(p2t5.kind).toBe("group-end");
    expect(p2t5.groupId).toBe(p1t0.id);
}

/**
 * Verifies the token structure of an empty structured object.
 *
 * This helper asserts the canonical wrapper generated for empty structured
 * values such as:
 *
 * - object literals
 * - arrays
 * - sets
 * - maps
 * - custom class instances
 *
 * The helper validates:
 *
 * - group boundaries
 * - object-name token
 * - opening and closing delimiters
 * - indentation markers
 * - formatting tokens
 * - matching group identifiers
 *
 * When a class name is supplied, the helper additionally verifies the
 * emitted object name token and the appropriate delimiter pair for that
 * collection type.
 *
 * @param tokens
 * Token sequence representing an empty structured value.
 *
 * @param className
 * Optional container class name expected in the emitted `object-name`
 * token (e.g. `"Array"`, `"Set"`, or `"Map"`). When omitted, an object
 * literal is expected.
 * 
 * @since 1.0.0
 */
const expectEmptyObjectStructure = (tokens: Token[] | readonly Token[], className?: string) => {
    const kinds = _tokenization.extractKinds(tokens);

    expect(kinds).toEqual([
        'group-start',
        'object-name',
        'object-open',
        'soft-line',
        'indent-start',
        'indent-end',
        'soft-line',
        'object-close',
        'group-end'
    ]);

    const brackets = {
        Map: '()',
        Set: '()',
        Array: '[]'
    } as const;

    const t0 = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
    expect(t0).toBeInstanceOf(TOKENS.GroupStart);
    expect(t0.kind).toBe("group-start");
    expect(typeof t0.id).toBe("symbol");

    const objectName = tokens[1] as InstanceType<typeof TOKENS.ObjectName>;
    expect(objectName).toBeInstanceOf(TOKENS.ObjectName);
    if (className) {
        expect(objectName.className).toBe(className);
    } else {
        expect(objectName.className).toBeUndefined();
    }

    const objectOpen = tokens[2] as InstanceType<typeof TOKENS.ObjectOpen>;
    expect(objectOpen).toBeInstanceOf(TOKENS.ObjectOpen);
    expect(objectOpen.kind).toBe("object-open");
    expect(objectOpen.token).toBe(className && className in brackets ? brackets[className as keyof typeof brackets][0] : "{");

    const softLine = tokens[3] as InstanceType<typeof TOKENS.SoftLine>;
    expect(softLine).toBeInstanceOf(TOKENS.SoftLine);
    expect(softLine.kind).toBe("soft-line");

    const indentStart = tokens[4] as InstanceType<typeof TOKENS.IndentStart>;
    expect(indentStart).toBeInstanceOf(TOKENS.IndentStart);
    expect(indentStart.kind).toBe("indent-start");

    const indentEnd = tokens[5] as InstanceType<typeof TOKENS.IndentEnd>;
    expect(indentEnd).toBeInstanceOf(TOKENS.IndentEnd);
    expect(indentEnd.kind).toBe("indent-end");

    const softLine2 = tokens[6] as InstanceType<typeof TOKENS.SoftLine>;
    expect(softLine2).toBeInstanceOf(TOKENS.SoftLine);
    expect(softLine2.kind).toBe("soft-line");

    const objectClose = tokens[7] as InstanceType<typeof TOKENS.ObjectClose>;
    expect(objectClose).toBeInstanceOf(TOKENS.ObjectClose);
    expect(objectClose.kind).toBe("object-close");
    expect(objectClose.token).toBe(className && className in brackets ? brackets[className as keyof typeof brackets][1] : "}");

    const groupEnd = tokens[8] as InstanceType<typeof TOKENS.GroupEnd>;
    expect(groupEnd).toBeInstanceOf(TOKENS.GroupEnd);
    expect(groupEnd.kind).toBe("group-end");
    expect(groupEnd.groupId).toBe(t0.id);

    expect(tokens.length).toBe(9);
}

/**
 * Shared assertion helpers used by the tokenization test suites.
 *
 * These helpers encapsulate common structural assertions to keep the
 * individual test cases focused on behavior rather than repetitive token
 * validation logic.
 *
 * They intentionally verify both token ordering and important invariants
 * such as identifier relationships, runtime token types, and structural
 * correctness.
 * 
 * @since 1.0.0
 */
const _tokenization = {
    extractKinds,
    expectPrimitive,
    expectError,
    expectErrorWithCause,
    expectEmptyObjectStructure,
    tokenizers: [
        ["json", JSONTokenizer],
        ["ignoredCycles", (value: unknown) => DefaultTokenizer(value, "ignore")],
        ["markedCycles", (value: unknown) => DefaultTokenizer(value, "mark")],
    ] as const
};

export default _tokenization;