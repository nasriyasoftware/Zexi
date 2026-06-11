import TokensBuffer from "../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import TOKENS from "../../../../src/core/terminal/pipeline/3-tokenization/tokens";

// Builders
import GraphBuilder from "../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../src/core/terminal/pipeline/2-representation/builder";
import Tokenizer from "../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";

import type { GraphNode } from "../../../../src/core/terminal/pipeline/1-graphing/types";
import type { RepresentationNode } from "../../../../src/core/terminal/pipeline/2-representation/types";

// Helpers (ONLY allowed pipeline entry point)
const buildGraph = (value: unknown) => GraphBuilder.build(value, { cycles: "throw", });
const buildRep = (graph: GraphNode) => RepresentationBuilder.build(graph);
const tokenizeRep = (rep: RepresentationNode) => Tokenizer.tokenize(rep);
const tokenize = (value: unknown) => tokenizeRep(buildRep(buildGraph(value)));
const extractKinds = (tokens: readonly any[]) => tokens.map(t => t.kind);

// -----------------------------
// Tests
// -----------------------------
describe("Tokenizer", () => {
    it("tokenizes a primitive node", () => {
        const buffer = tokenize('hello');
        const tokens = TokensBuffer.toArray(buffer);

        expect(tokens.length).toBe(1);
        const token = tokens[0] as InstanceType<typeof TOKENS.Primitive>;

        expect(token.kind).toBe("primitive");
        expect(token.type).toBe("string");
        expect(token.value).toBe("hello");
    });

    it("tokenizes a simple array node", () => {
        const buffer = tokenize([1, 'A']);
        const tokens = TokensBuffer.toArray(buffer);

        expect(extractKinds(tokens)).toEqual([
            // array object opener
            'group-start',
            'object-name',
            'object-open',
            'soft-line',
            'indent-start',

            // array elements
            'primitive',
            'separator',
            'soft-line',
            'primitive',

            // array object closer
            'indent-end',
            'soft-line',
            'object-close',
            'group-end'
        ]);

        const firstElement = tokens[5] as InstanceType<typeof TOKENS.Primitive>;
        const separator = tokens[6] as InstanceType<typeof TOKENS.Separator>;
        const separatorLine = tokens[7] as InstanceType<typeof TOKENS.SoftLine>;
        const secondElement = tokens[8] as InstanceType<typeof TOKENS.Primitive>;

        expect(firstElement).toBeInstanceOf(TOKENS.Primitive);
        expect(firstElement.type).toBe("number");
        expect(firstElement.value).toBe(1);

        expect(separator).toBeInstanceOf(TOKENS.Separator);
        expect(separator.value).toBe(",");

        expect(separatorLine).toBeInstanceOf(TOKENS.SoftLine);

        expect(secondElement).toBeInstanceOf(TOKENS.Primitive);
        expect(secondElement.type).toBe("string");
        expect(secondElement.value).toBe("A");
    });

    it("tokenizes object representation node correctly", () => {
        class User {
            name = 'Ahmad'
        }

        const buffer = tokenize(new User());
        const tokens = TokensBuffer.toArray(buffer);

        // MUST be structurally wrapped
        expect(tokens[0].kind).toBe("group-start");
        expect(tokens[tokens.length - 1].kind).toBe("group-end");

        // MUST contain object structure tokens in order
        const kinds = extractKinds(tokens);

        expect(kinds).toEqual([
            'group-start',
            'object-name',
            'object-open',
            'soft-line',
            'indent-start',

            'group-start',
            "property",
            "key-value-separator",
            "soft-space",
            "primitive",
            'group-end',

            'indent-end',
            'soft-line',
            'object-close',
            'group-end'
        ]);

        const propGroupStart = tokens[5] as InstanceType<typeof TOKENS.GroupStart>;
        expect(propGroupStart).toBeInstanceOf(TOKENS.GroupStart);

        const prop = tokens[6] as InstanceType<typeof TOKENS.Property>;
        expect(prop).toBeInstanceOf(TOKENS.Property);
        expect(prop.value).toBe("name");

        const separator = tokens[7] as InstanceType<typeof TOKENS.KeyValueSeparator>;
        expect(separator).toBeInstanceOf(TOKENS.KeyValueSeparator);
        expect(separator.value).toBe(':');

        const space = tokens[8] as InstanceType<typeof TOKENS.Primitive>;
        expect(space).toBeInstanceOf(TOKENS.SoftSpace);

        const value = tokens[9] as InstanceType<typeof TOKENS.Primitive>;
        expect(value).toBeInstanceOf(TOKENS.Primitive);
        expect(value.type).toBe("string");
        expect(value.value).toBe("Ahmad");

        const propGroupEnd = tokens[10] as InstanceType<typeof TOKENS.GroupEnd>;
        expect(propGroupEnd).toBeInstanceOf(TOKENS.GroupEnd);
        expect(propGroupEnd.groupId).toBe(propGroupStart.id);
    });

    it("tokenizes map with key-value structure", () => {
        const map = new Map();
        map.set('k', 1);

        const buffer = tokenize(map);
        const tokens = TokensBuffer.toArray(buffer);

        const kinds = extractKinds(tokens);

        expect(kinds).toEqual([
            // array object opener
            'group-start',
            'object-name',
            'object-open',
            'soft-line',
            'indent-start',

            // array elements
            'primitive',
            'hard-space',
            'key-value-separator',
            'hard-space',
            'primitive',

            // array object closer
            'indent-end',
            'soft-line',
            'object-close',
            'group-end',
        ]);

        const objectName = tokens[1] as InstanceType<typeof TOKENS.ObjectName>;
        expect(objectName).toBeInstanceOf(TOKENS.ObjectName);
        expect(objectName.className).toBe("Map");

        const key = tokens[5] as InstanceType<typeof TOKENS.Primitive>;
        expect(key).toBeInstanceOf(TOKENS.Primitive);
        expect(key.type).toBe("string");
        expect(key.value).toBe("k");

        const space1 = tokens[6] as InstanceType<typeof TOKENS.HardSpace>;
        expect(space1).toBeInstanceOf(TOKENS.HardSpace);

        const separator = tokens[7] as InstanceType<typeof TOKENS.KeyValueSeparator>;
        expect(separator).toBeInstanceOf(TOKENS.KeyValueSeparator);
        expect(separator.value).toBe('=>');

        const space2 = tokens[8] as InstanceType<typeof TOKENS.HardSpace>;
        expect(space2).toBeInstanceOf(TOKENS.HardSpace);

        const value = tokens[9] as InstanceType<typeof TOKENS.Primitive>;
        expect(value).toBeInstanceOf(TOKENS.Primitive);
        expect(value.type).toBe("number");
        expect(value.value).toBe(1);
    });

    it("produces deterministic output for identical input", () => {
        const arr = [1, 2];

        const a = TokensBuffer.toArray(tokenize(arr));
        const b = TokensBuffer.toArray(tokenize(arr));


        expect(a.length).toBe(b.length);
        expect(extractKinds(a)).toEqual(extractKinds(b));
    });

    it("always wraps structured nodes with group tokens", () => {
        const tokens = TokensBuffer.toArray(tokenize(new Set([true])));

        expect(tokens[0]).toBeInstanceOf(TOKENS.GroupStart);
        expect(tokens[tokens.length - 1]).toBeInstanceOf(TOKENS.GroupEnd);
    });

    it("handles nested structures recursively with full group nesting", () => {
        const tokens = TokensBuffer.toArray(tokenize([[1]]));

        const kinds = extractKinds(tokens);
        expect(kinds).toEqual([
            // array object opener
            'group-start',
            'object-name',
            'object-open',
            'soft-line',
            'indent-start',

            // content
            // nested array object opener
            'group-start',
            'object-name',
            'object-open',
            'soft-line',
            'indent-start',

            // content
            'primitive',

            // nested array object closer
            'indent-end',
            'soft-line',
            'object-close',
            'group-end',

            // array object closer
            'indent-end',
            'soft-line',
            'object-close',
            'group-end'
        ])

    });

    it("includes object name and delimiters in correct order", () => {
        const tokens = TokensBuffer.toArray(tokenize([]));
        const kinds = extractKinds(tokens);

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

        const objectName = tokens[1] as InstanceType<typeof TOKENS.ObjectName>;
        expect(objectName).toBeInstanceOf(TOKENS.ObjectName);
        expect(objectName.className).toBe("Array");
    });

    it("tokenizes explicit Error values into structured error tokens", () => {
        const err = new SyntaxError("boom");

        const buffer = tokenize(err);
        const tokens = TokensBuffer.toArray(buffer);

        const kinds = extractKinds(tokens);

        // Must produce full error structure
        expect(kinds).toEqual([
            'group-start',
            'error-start',
            'error-data',
            'stack-trace',
            'error-end',
            'group-end'
        ]);

        // Extract error scope root
        const errorStart = tokens[1] as InstanceType<typeof TOKENS.ErrorStart>;
        expect(errorStart).toBeInstanceOf(TOKENS.ErrorStart);

        const errorId = errorStart.id;

        // -----------------------------
        // Error data token
        // -----------------------------
        const errorDataToken = tokens[2] as InstanceType<typeof TOKENS.ErrorData>;
        expect(errorDataToken).toBeInstanceOf(TOKENS.ErrorData);
        expect(errorDataToken.errorId).toBe(errorId);
        expect(errorDataToken.name).toBe("SyntaxError");
        expect(errorDataToken.message).toBe("boom");

        // -----------------------------
        // Stack trace token
        // -----------------------------
        const stackTraceToken = tokens[3] as InstanceType<typeof TOKENS.StackTrace>;
        expect(stackTraceToken).toBeInstanceOf(TOKENS.StackTrace);

        expect(stackTraceToken.errorId).toBe(errorId);
        expect(stackTraceToken.ownership).toBe("error");

        // Every internal line remains valid even under ownership mode
        expect(Array.isArray(stackTraceToken.lines)).toBe(true);

        // -----------------------------
        // Error end token
        // -----------------------------
        const errorEnd = tokens[4] as InstanceType<typeof TOKENS.ErrorEnd>;
        expect(errorEnd).toBeInstanceOf(TOKENS.ErrorEnd);
        expect(errorEnd.errorId).toBe(errorId);

        // -----------------------------
        // Global invariants (important)
        // -----------------------------

        // All error-scoped tokens must share same errorId
        const scoped = [errorDataToken, stackTraceToken, errorEnd];
        for (const t of scoped) {
            expect((t as any).errorId).toBe(errorId);
        }
    });

    it("tokenizes Error with nested cause as a full error subtree", () => {
        const cause = new TypeError("root cause");
        const err = new Error("boom", { cause });

        const buffer = tokenize(err);
        const tokens = TokensBuffer.toArray(buffer);

        const kinds = extractKinds(tokens);

        expect(kinds).toEqual([
            // root error
            'group-start',
            'error-start',
            'error-data',

            // cause (FULL independent error subtree)
            'error-cause-start',
            'group-start',
            'error-start',
            'error-data',
            'stack-trace',
            'error-end',
            'group-end',
            'error-cause-end',

            // root continuation
            'stack-trace',
            'error-end',
            'group-end'
        ]);

        // -----------------------------
        // Root error
        // -----------------------------
        const rootErrorStart = tokens[1] as InstanceType<typeof TOKENS.ErrorStart>;
        const rootErrorId = rootErrorStart.id;

        const rootData = tokens[2] as InstanceType<typeof TOKENS.ErrorData>;
        expect(rootData.errorId).toBe(rootErrorId);
        expect(rootData.name).toBe("Error");
        expect(rootData.message).toBe("boom");

        // -----------------------------
        // Cause start
        // -----------------------------
        const causeStart = tokens[3] as InstanceType<typeof TOKENS.ErrorCauseStart>;
        expect(causeStart).toBeInstanceOf(TOKENS.ErrorCauseStart);
        expect(causeStart.errorId).toBe(rootErrorId);

        // -----------------------------
        // Nested cause error scope
        // -----------------------------
        const causeGroupStart = tokens[4];
        expect(causeGroupStart.kind).toBe("group-start");

        const causeErrorStart = tokens[5] as InstanceType<typeof TOKENS.ErrorStart>;
        const causeErrorId = causeErrorStart.id;

        expect(causeErrorId).not.toBe(rootErrorId);

        const causeData = tokens[6] as InstanceType<typeof TOKENS.ErrorData>;
        expect(causeData.errorId).toBe(causeErrorId);
        expect(causeData.name).toBe("TypeError");
        expect(causeData.message).toBe("root cause");

        const causeStack = tokens[7] as InstanceType<typeof TOKENS.StackTrace>;
        expect(causeStack.errorId).toBe(causeErrorId);

        const causeErrorEnd = tokens[8] as InstanceType<typeof TOKENS.ErrorEnd>;
        expect(causeErrorEnd.errorId).toBe(causeErrorId);

        const causeGroupEnd = tokens[9];
        expect(causeGroupEnd.kind).toBe("group-end");

        // -----------------------------
        // Cause closure
        // -----------------------------
        const causeEnd = tokens[10] as InstanceType<typeof TOKENS.ErrorCauseEnd>;
        expect(causeEnd.errorId).toBe(rootErrorId);
        expect(causeEnd.causeId).toBe(causeStart.id);

        // -----------------------------
        // Root stack + end
        // -----------------------------
        const rootStack = tokens[11] as InstanceType<typeof TOKENS.StackTrace>;
        expect(rootStack.errorId).toBe(rootErrorId);

        const rootErrorEnd = tokens[12] as InstanceType<typeof TOKENS.ErrorEnd>;
        expect(rootErrorEnd.errorId).toBe(rootErrorId);
    });

});