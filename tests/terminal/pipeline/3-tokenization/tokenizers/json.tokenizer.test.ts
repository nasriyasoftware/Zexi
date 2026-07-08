import _tokenization from "../helpers/helpers";
import JSONTokenizer from "../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import TOKENS from "../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import CircularReferenceError from "../../../../../src/core/terminal/pipeline/1-graphing/identity/circular.error";

describe("JSONTokenizer", () => {

    describe("object literals and class instances", () => {

        it("JSONTokenizer objects canonically", () => {
            const tokens = JSONTokenizer({ z: 1, a: 2, m: 3 });
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start',
                'object-name',
                'object-open',
                'soft-line',
                'indent-start',

                'group-start',
                'property',
                'key-value-separator',
                'soft-space',
                'primitive',
                'separator',
                'soft-line',
                'group-end',

                'group-start',
                'property',
                'key-value-separator',
                'soft-space',
                'primitive',
                'separator',
                'soft-line',
                'group-end',

                'group-start',
                'property',
                'key-value-separator',
                'soft-space',
                'primitive',
                'group-end',

                'indent-end',
                'soft-line',
                'object-close',
                'group-end'
            ])

            const properties = tokens.filter(
                (t): t is InstanceType<typeof TOKENS.Property> =>
                    t instanceof TOKENS.Property
            );

            expect(properties.map(p => p.value)).toEqual([
                "a",
                "m",
                "z"
            ]);
        });

        it("throws on circular references", () => {
            const obj: any = {};
            obj.self = obj;

            expect(() =>
                JSONTokenizer(obj)
            ).toThrow(CircularReferenceError);
        });

    });

    describe("arrays", () => {

        it("throws on circular references", () => {
            const arr: any = [1, 2, 3];
            arr.push(arr);

            expect(() =>
                JSONTokenizer(arr)
            ).toThrow(CircularReferenceError);
        });

    })


    describe("sets", () => {
        it("throws on circular references", () => {
            const obj: any = {};
            obj.self = obj;

            expect(() =>
                JSONTokenizer(new Set([obj]))
            ).toThrow(CircularReferenceError);

            const set = new Set();
            set.add(set);

            expect(() =>
                JSONTokenizer(set)
            ).toThrow(CircularReferenceError);
        });
    });

    describe("maps", () => {

        it("throws on circular references", () => {
            const obj: any = {};
            obj.self = obj;

            expect(() =>
                JSONTokenizer(new Map([["self", obj]]))
            ).toThrow(CircularReferenceError);

            const map = new Map();
            map.set("self", map);

            expect(() =>
                JSONTokenizer(map)
            ).toThrow(CircularReferenceError);
        });

    });
});