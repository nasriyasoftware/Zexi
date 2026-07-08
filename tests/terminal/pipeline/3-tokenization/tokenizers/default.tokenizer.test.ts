import _tokenization from "../helpers/helpers";
import DefaultTokenizer from "../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/default.tokenizer";
import TOKENS from "../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import CircularReferenceError from "../../../../../src/core/terminal/pipeline/1-graphing/identity/circular.error";
import type { Token } from "../../../../../src/core/terminal/pipeline/3-tokenization/types";

describe("DefaultTokenizer", () => {
    const primitives = ["Ahmad", 123, true, false, null, undefined, Symbol("test")]

    describe("tokenization with cyclic policy (throw)", () => {
        const tokenize = (value: unknown) => DefaultTokenizer(value, 'throw');

        it("tokenizes a date value", () => {
            const date = new Date('1996-01-01T00:00:00.000Z');
            const tokens = tokenize(date);

            expect(tokens.length).toBe(1);
            const token = tokens[0] as InstanceType<typeof TOKENS.Date>;

            expect(token.kind).toBe("date");
            expect(token.value).not.toBe(date);
            expect(token.value).toEqual(date);
        });

        it("tokenizes a regex value", () => {
            const regex = /abc/gi;
            const tokens = tokenize(regex);

            expect(tokens.length).toBe(1);
            const token = tokens[0] as InstanceType<typeof TOKENS.RegExp>;

            expect(token.kind).toBe("regex");
            expect(token.value.source).toBe(regex.source);
            expect(token.value.flags).toBe(regex.flags);
            expect(token.value).not.toBe(regex);
        });

        it("tokenizes functions", () => {
            const fn = () => { };
            const tokens = tokenize(fn);

            expect(tokens.length).toBe(1);
            const token = tokens[0] as InstanceType<typeof TOKENS.Function>;

            expect(token.kind).toBe("function");
            expect(token.value).toBe(fn);
        });

        describe.each(primitives.map(v => {
            return [
                v === null ? 'null' : typeof v,
                v
            ];
        }))("tokenizes %s primitives", (type, value) => {
            const tokens = tokenize(value);
            expect(tokens.length).toBe(1);
            const token = tokens[0] as InstanceType<typeof TOKENS.Primitive>;

            expect(token.kind).toBe("primitive");
            expect(token.type).toBe(type);
            expect(token.value).toBe(value);
        })

        describe("object literals and class instances", () => {
            const primitives = ["Ahmad", 123, true, false, null, undefined, Symbol("test")];

            it("throws on circular references", () => {
                const obj: any = {};
                obj.self = obj;

                expect(() =>
                    tokenize(obj)
                ).toThrow(CircularReferenceError);
            });

            it("allows shared references", () => {
                const shared = { name: 'Ahmad' };
                const obj = { a: shared, b: shared };

                expect(() => tokenize(obj)).not.toThrow();
            });

            it("tokenizes an empty object literal correctly", () => {
                const tokens = tokenize({});
                _tokenization.expectEmptyObjectStructure(tokens);
            });

            it("tokenizes empty class instances correctly", () => {
                class User { };
                const tokens = tokenize(new User());
                _tokenization.expectEmptyObjectStructure(tokens, 'User');
            });

            it("tokenizes object literals with a single property correctly", () => {
                for (const p of primitives) {
                    const tokens = tokenize({ prop: p });
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
                        'group-end',

                        'indent-end',
                        'soft-line',
                        'object-close',
                        'group-end'
                    ]);

                    const t5 = tokens[5] as InstanceType<typeof TOKENS.GroupStart>;
                    expect(t5).toBeInstanceOf(TOKENS.GroupStart);
                    expect(t5.kind).toBe("group-start");
                    expect(typeof t5.id).toBe("symbol");

                    const property = tokens[6] as InstanceType<typeof TOKENS.Property>;
                    expect(property).toBeInstanceOf(TOKENS.Property);
                    expect(property.kind).toBe("property");
                    expect(property.type).toBe("property");
                    expect(property.value).toBe("prop");

                    const keyValueSeparator = tokens[7] as InstanceType<typeof TOKENS.KeyValueSeparator>;
                    expect(keyValueSeparator).toBeInstanceOf(TOKENS.KeyValueSeparator);
                    expect(keyValueSeparator.kind).toBe("key-value-separator");
                    expect(keyValueSeparator.value).toBe(":");

                    const space = tokens[8] as InstanceType<typeof TOKENS.SoftSpace>;
                    expect(space).toBeInstanceOf(TOKENS.SoftSpace);

                    _tokenization.expectPrimitive(tokens[9], p);

                    const separator = tokens[10] as InstanceType<typeof TOKENS.GroupEnd>;
                    expect(separator).toBeInstanceOf(TOKENS.GroupEnd);
                    expect(separator.kind).toBe("group-end");
                    expect(separator.groupId).toBe(t5.id);
                }

                // Teseting dates
                const date = new Date();
                const tokens = tokenize({ prop: date });

                const t9 = tokens[9] as InstanceType<typeof TOKENS.Date>;
                expect(t9).toBeInstanceOf(TOKENS.Date);
                expect(t9.kind).toBe("date");
                expect(t9.value).not.toBe(date);
                expect(t9.value).toEqual(date);
            });

            it("tokenizes class instances with a single property correctly", () => {
                class User {
                    prop: unknown;

                    constructor(prop: unknown) {
                        this.prop = prop;
                    }
                }

                for (const p of primitives) {
                    const tokens = tokenize(new User(p));
                    _tokenization.expectPrimitive(tokens[9], p);
                }
            });

            it("tokenizes object literals with multiple properties correctly", () => {
                const tokens = tokenize({ a: 1, b: 2 });
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
                    'group-end',

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                const t6 = tokens[6] as InstanceType<typeof TOKENS.Property>;
                expect(t6).toBeInstanceOf(TOKENS.Property);
                expect(t6.kind).toBe("property");
                expect(t6.type).toBe("property");
                expect(t6.value).toBe("a");

                _tokenization.expectPrimitive(tokens[9], 1);

                const t10 = tokens[10] as InstanceType<typeof TOKENS.Separator>;
                expect(t10).toBeInstanceOf(TOKENS.Separator);
                expect(t10.kind).toBe("separator");
                expect(t10.value).toBe(",");

                const t11 = tokens[11] as InstanceType<typeof TOKENS.SoftLine>;
                expect(t11).toBeInstanceOf(TOKENS.SoftLine);
                expect(t11.kind).toBe("soft-line");

                _tokenization.expectPrimitive(tokens[17], 2);
            });

            it("tokenizes class instances with multiple properties correctly", () => {
                class User {
                    a: unknown;
                    b: unknown;

                    constructor(a: unknown, b: unknown) {
                        this.a = a;
                        this.b = b;
                    }
                }

                const tokens = tokenize(new User(1, 2));

                _tokenization.expectPrimitive(tokens[9], 1);
                _tokenization.expectPrimitive(tokens[17], 2);
            });

            it("tokenizes all class instances' properties correctly", () => {
                class User {
                    #_username: string;
                    name: string;

                    constructor(username: string, name: string) {
                        this.#_username = username;
                        this.name = name;
                    }

                    set username(name: string) {
                        // noop
                    }

                    get username() {
                        return this.#_username;
                    }

                    login() {
                        // noop
                    }
                }

                const tokens = tokenize(new User("ghost123", "Ahmad"));
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    'group-start',
                    'property',                 // name
                    'key-value-separator', 'soft-space', 'primitive', 'separator', 'soft-line', 'group-end',

                    'group-start',
                    'property',                 // username (setter)
                    'key-value-separator', 'soft-space', 'function', 'separator', 'soft-line', 'group-end',

                    'group-start',
                    'property',                 // username (getter)
                    'key-value-separator', 'soft-space', 'function', 'separator', 'soft-line', 'group-end',

                    'group-start',              // login
                    'property',
                    'key-value-separator', 'soft-space', 'function', 'group-end',

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                const expectLogin = (index: number) => {
                    const t = tokens[index] as InstanceType<typeof TOKENS.Property>;
                    expect(t).toBeInstanceOf(TOKENS.Property);
                    expect(t.kind).toBe("property");
                    expect(t.type).toBe("method");
                    expect(t.value).toBe("login");
                }

                const expectName = (index: number) => {
                    const t = tokens[index] as InstanceType<typeof TOKENS.Property>;
                    expect(t).toBeInstanceOf(TOKENS.Property);
                    expect(t.kind).toBe("property");
                    expect(t.type).toBe("property");
                    expect(t.value).toBe("name");
                }

                const expectUsername = (index: number, type: "getter" | "setter") => {
                    const t = tokens[index] as InstanceType<typeof TOKENS.Property>;
                    expect(t).toBeInstanceOf(TOKENS.Property);
                    expect(t.kind).toBe("property");
                    expect(t.value).toBe("username");
                    expect(t.type).toBe(type);
                }

                expectName(6)
                // Getters always come before setters regardless of order
                expectUsername(14, 'getter');
                expectUsername(22, 'setter');
                expectLogin(30);
            });

            it("tokenize inherited class instances' properties correctly", () => {
                class Person {
                    readonly #_name: string;

                    constructor(name: string) {
                        this.#_name = name;
                    }

                    get name() {
                        return this.#_name;
                    }
                }

                class User extends Person {
                    readonly #_email: string;

                    constructor(name: string, email: string) {
                        super(name);
                        this.#_email = email;
                    }

                    get email() {
                        return this.#_email;
                    }
                }

                const tokens = tokenize(new User("Ahmad", "9B2Hs@example.com"));

                const t6 = tokens[6] as InstanceType<typeof TOKENS.Property>;
                expect(t6).toBeInstanceOf(TOKENS.Property);
                expect(t6.kind).toBe("property");
                expect(t6.type).toBe("getter");
                expect(t6.value).toBe("email");

                const t14 = tokens[14] as InstanceType<typeof TOKENS.Property>;
                expect(t14).toBeInstanceOf(TOKENS.Property);
                expect(t14.kind).toBe("property");
                expect(t14.type).toBe("getter");
                expect(t14.value).toBe("name");
            });

            it("tokenizes nested objects correctly", () => {
                const user = {
                    name: "Ahmad",
                    address: {}
                }

                const tokens = tokenize(user);
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
                    // Nested object: start
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',
                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end',
                    // Nested object: end
                    'group-end',

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ])
            });

            it("tokenizes objects preserving insertion order", () => {
                const tokens = tokenize({ z: 1, a: 2, m: 3 });
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
                    "z",
                    "a",
                    "m"
                ]);
            });

        });

        describe("arrays", () => {

            it("throws on circular references", () => {
                const arr: any = [1, 2, 3];
                arr.push(arr);

                expect(() =>
                    tokenize(arr)
                ).toThrow(CircularReferenceError);
            });

            it("tokenizes an empty array", () => {
                const tokens = tokenize([]);
                _tokenization.expectEmptyObjectStructure(tokens, 'Array');
            });

            it("tokenizes an array with one element correctly", () => {
                {
                    const tokens = tokenize([1]);
                    const kinds = _tokenization.extractKinds(tokens);

                    expect(kinds).toEqual([
                        'group-start',
                        'object-name',
                        'object-open',
                        'soft-line',
                        'indent-start',

                        'primitive',

                        'indent-end',
                        'soft-line',
                        'object-close',
                        'group-end'
                    ]);

                    const valueToken = tokens[5] as InstanceType<typeof TOKENS.Primitive>;
                    expect(valueToken.kind).toBe("primitive");
                    expect(valueToken.type).toBe("number");
                    expect(valueToken.value).toBe(1);
                }

                {
                    const tokens = tokenize([{ a: 1 }]);
                    const kinds = _tokenization.extractKinds(tokens);

                    expect(kinds).toEqual([
                        'group-start',
                        'object-name',
                        'object-open',
                        'soft-line',
                        'indent-start',
                        //
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
                        'group-end',

                        'indent-end',
                        'soft-line',
                        'object-close',
                        'group-end',
                        //
                        'indent-end',
                        'soft-line',
                        'object-close',
                        'group-end'
                    ]);
                }
            });

            it("tokenizes an array with multiple elements correctly", () => {
                const tokens = tokenize([1, 2, 3]);
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    'primitive',
                    'separator',
                    'soft-line',
                    'primitive',
                    'separator',
                    'soft-line',
                    'primitive',

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);
            });

            it("tokenizes nested arrays correctly", () => {
                const arr1 = [1, 2, 3];
                const arr2 = [4, 5, 6];
                const arr = [arr1, arr2];

                const tokens = tokenize(arr);
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    // Array 1
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',
                    "primitive",
                    "separator",
                    "soft-line",
                    "primitive",
                    "separator",
                    "soft-line",
                    "primitive",
                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end',

                    'separator',
                    'soft-line',

                    // Array 2
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',
                    "primitive",
                    "separator",
                    "soft-line",
                    "primitive",
                    "separator",
                    "soft-line",
                    "primitive",
                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end',

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end',
                ]);
            });

        });

        describe("sets", () => {

            it("throws on circular references", () => {
                const obj: any = {};
                obj.self = obj;

                expect(() =>
                    tokenize(new Set([obj]))
                ).toThrow(CircularReferenceError);

                const set = new Set();
                set.add(set);

                expect(() =>
                    tokenize(set)
                ).toThrow(CircularReferenceError);
            });

            it("tokenizes an empty set correctly", () => {
                const tokens = tokenize(new Set());
                _tokenization.expectEmptyObjectStructure(tokens, 'Set');
            });

            it("tokenizes a set with a single element correctly", () => {
                const tokens = tokenize(new Set([1]));
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    "primitive",

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                _tokenization.expectPrimitive(tokens[5], 1);
            });

            it("tokenizes a set with multiple elements correctly", () => {
                const tokens = tokenize(new Set([1, 2]));
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    "primitive",
                    "separator",
                    "soft-line",
                    "primitive",

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                _tokenization.expectPrimitive(tokens[5], 1);

                const t6 = tokens[6] as InstanceType<typeof TOKENS.Separator>;
                expect(t6).toBeInstanceOf(TOKENS.Separator);
                expect(t6.kind).toBe("separator");
                expect(t6.value).toBe(",");

                const t7 = tokens[7] as InstanceType<typeof TOKENS.SoftLine>;
                expect(t7).toBeInstanceOf(TOKENS.SoftLine);
                expect(t7.kind).toBe("soft-line");

                _tokenization.expectPrimitive(tokens[8], 2);
            });

            it("tokenizes nested sets correctly", () => {
                const nSet = new Set();
                const set = new Set([nSet]);

                const tokens = tokenize(set);
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',
                    'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',
                    'indent-end', 'soft-line', 'object-close', 'group-end', 'indent-end',
                    'soft-line', 'object-close', 'group-end'
                ]);
            });

        });

        describe("maps", () => {

            it("throws on circular references", () => {
                const obj: any = {};
                obj.self = obj;

                expect(() =>
                    tokenize(new Map([["self", obj]]))
                ).toThrow(CircularReferenceError);

                const map = new Map();
                map.set("self", map);

                expect(() =>
                    tokenize(map)
                ).toThrow(CircularReferenceError);
            });

            it("tokenizes an empty map correctly", () => {
                const tokens = tokenize(new Map());
                _tokenization.expectEmptyObjectStructure(tokens, 'Map');
            });

            it("tokenizes a map with a single key-value pair correctly", () => {
                const tokens = tokenize(new Map([["a", 1]]));
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    "group-start",
                    "primitive",
                    "hard-space",
                    "key-value-separator",
                    "hard-space",
                    "primitive",
                    "group-end",

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                const t5 = tokens[5] as InstanceType<typeof TOKENS.GroupStart>;
                expect(t5).toBeInstanceOf(TOKENS.GroupStart);
                expect(t5.kind).toBe("group-start");

                _tokenization.expectPrimitive(tokens[6], "a");

                const hardSpaces = [tokens[7], tokens[9]];
                hardSpaces.forEach(hardSpace => {
                    const hs = hardSpace as InstanceType<typeof TOKENS.HardSpace>;
                    expect(hs).toBeInstanceOf(TOKENS.HardSpace);
                    expect(hs.kind).toBe("hard-space");
                });

                const keyValueSeparator = tokens[8] as InstanceType<typeof TOKENS.KeyValueSeparator>;
                expect(keyValueSeparator).toBeInstanceOf(TOKENS.KeyValueSeparator);
                expect(keyValueSeparator.kind).toBe("key-value-separator");
                expect(keyValueSeparator.value).toBe("=>");

                _tokenization.expectPrimitive(tokens[10], 1);
            });

            it("tokenizes a map with multiple key-value pairs correctly", () => {
                const tokens = tokenize(new Map([["a", 1], ["b", 2]]));
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    "group-start",
                    "primitive",
                    "hard-space",
                    "key-value-separator",
                    "hard-space",
                    "primitive",
                    "separator",
                    "soft-line",
                    "group-end",

                    "group-start",
                    "primitive",
                    "hard-space",
                    "key-value-separator",
                    "hard-space",
                    "primitive",
                    "group-end",

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);

                _tokenization.expectPrimitive(tokens[6], "a");
                _tokenization.expectPrimitive(tokens[10], 1);

                const t11 = tokens[11] as InstanceType<typeof TOKENS.Separator>;
                expect(t11).toBeInstanceOf(TOKENS.Separator);
                expect(t11.kind).toBe("separator");
                expect(t11.value).toBe(";");

                const t12 = tokens[12] as InstanceType<typeof TOKENS.SoftLine>;
                expect(t12).toBeInstanceOf(TOKENS.SoftLine);
                expect(t12.kind).toBe("soft-line");

                _tokenization.expectPrimitive(tokens[15], "b");
                _tokenization.expectPrimitive(tokens[19], 2);
            });

            it("tokenizes nested maps correctly", () => {
                const nMap = new Map();
                const map = new Map([["nested", nMap]]);

                const tokens = tokenize(map);
                const kinds = _tokenization.extractKinds(tokens);

                expect(kinds).toEqual([
                    'group-start',
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',

                    'group-start',              // The map key-value pair opening group
                    'primitive',
                    'hard-space',
                    'key-value-separator',
                    'hard-space',

                    'group-start',              // The nested map opening group
                    'object-name',
                    'object-open',
                    'soft-line',
                    'indent-start',
                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end',                // The nested map closing group

                    'group-end',                // The map key-value pair closing group

                    'indent-end',
                    'soft-line',
                    'object-close',
                    'group-end'
                ]);
            });

        });

        describe("errors", () => {

            it("tokenizes any error correctly", () => {
                const errors = [
                    new Error("boom"),
                    new TypeError(),
                    new SyntaxError("wow"),
                    new RangeError("wut")
                ]

                for (const err of errors) {
                    const tokens = tokenize(err);
                    _tokenization.expectError(tokens, err);
                }

            });

            it("tokenizes errors with causes correctly", () => {
                const error = new Error("boom", { cause: new TypeError("root cause") });
                const tokens = tokenize(error);

                _tokenization.expectErrorWithCause(tokens, error);

                const causeTokens = tokens.slice(4, -4);
                _tokenization.expectError(causeTokens, error.cause as Error);
            });

        });

    });

    describe("tokenization with cyclic policy (ignore)", () => {
        const tokenize = (value: unknown) => DefaultTokenizer(value, 'ignore');
        const expectIgnoredToken = (token: unknown) => {
            const t = token as InstanceType<typeof TOKENS.Primitive>;

            expect(t).toBeInstanceOf(TOKENS.Primitive);
            expect(t.kind).toBe("primitive");
            expect(t.type).toBe("null");
            expect(t.value).toBeNull();
        }

        const expectIgnored = (tokens: readonly Token[]) => {
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',
                "primitive", // The reference group was replaced with null
                'indent-end', 'soft-line', 'object-close', 'group-end'
            ]);

            const selfValue = tokens[5] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(selfValue);
        }

        it("ignores cyclic references in objects", () => {
            const obj: any = { name: 'Ahmad' };
            obj.self = obj;

            expect(obj.self).toBe(obj);

            const tokens = tokenize(obj);
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name',
                'object-open', 'soft-line',
                'indent-start', 'group-start',
                'property', 'key-value-separator',
                'soft-space', 'primitive',
                'separator', 'soft-line',
                'group-end', 'group-start',
                'property', 'key-value-separator',
                'soft-space', 'primitive',
                'group-end', 'indent-end',
                'soft-line', 'object-close',
                'group-end'
            ]);

            const selfProp = tokens[14] as InstanceType<typeof TOKENS.Property>;
            expect(selfProp).toBeInstanceOf(TOKENS.Property);
            expect(selfProp.kind).toBe("property");
            expect(selfProp.type).toBe("property");
            expect(selfProp.value).toBe("self");

            const selfValue = tokens[17] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(selfValue);
        });

        it("ignores cyclic references in arrays", () => {
            const arr: any[] = [];
            arr.push(arr);

            expect(arr[0]).toBe(arr);

            const tokens = tokenize(arr);
            expectIgnored(tokens);
        });

        it("ignores cyclic references in sets", () => {
            const set = new Set();
            set.add(set);

            expect(set.has(set)).toBe(true);

            const tokens = tokenize(set);
            expectIgnored(tokens);
        });

        it("ignores cyclic references in maps", () => {
            const map = new Map();
            map.set("self", map);

            expect(map.get("self")).toBe(map);

            const tokens = tokenize(map);
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',

                'group-start', 'primitive',
                'hard-space', 'key-value-separator',
                'hard-space', 'primitive',
                'group-end',

                'indent-end', 'soft-line', 'object-close', 'group-end'
            ]);

            const key = tokens[6] as InstanceType<typeof TOKENS.Primitive>;
            expect(key).toBeInstanceOf(TOKENS.Primitive);
            expect(key.kind).toBe("primitive");
            expect(key.type).toBe("string");
            expect(key.value).toBe("self");

            const value = tokens[10] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(value);
        });
    });

    describe("tokenization with cyclic policy (mark)", () => {
        const tokenize = (value: unknown) => DefaultTokenizer(value, 'mark');
        const expectIgnoredToken = (
            token: unknown,
            className: string,
            occurrenceCount: number = 1
        ) => {
            const t = token as InstanceType<typeof TOKENS.Primitive>;

            expect(t).toBeInstanceOf(TOKENS.Primitive);
            expect(t.kind).toBe("primitive");
            expect(t.type).toBe("string");
            expect(t.value).toBe(`[Circular:${className}:${occurrenceCount}]`);
        }

        const expectIgnored = (
            tokens: readonly Token[],
            className: string,
            occurrenceCount?: number
        ) => {
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',
                "primitive", // The reference group was replaced with null
                'indent-end', 'soft-line', 'object-close', 'group-end'
            ]);

            const selfValue = tokens[5] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(selfValue, className, occurrenceCount);
        }

        it("marks cyclic references in objects", () => {
            const obj: any = { name: 'Ahmad' };
            obj.self = obj;

            expect(obj.self).toBe(obj);

            const tokens = tokenize(obj);
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name',
                'object-open', 'soft-line',
                'indent-start', 'group-start',
                'property', 'key-value-separator',
                'soft-space', 'primitive',
                'separator', 'soft-line',
                'group-end', 'group-start',
                'property', 'key-value-separator',
                'soft-space', 'primitive',
                'group-end', 'indent-end',
                'soft-line', 'object-close',
                'group-end'
            ]);

            const selfProp = tokens[14] as InstanceType<typeof TOKENS.Property>;
            expect(selfProp).toBeInstanceOf(TOKENS.Property);
            expect(selfProp.kind).toBe("property");
            expect(selfProp.type).toBe("property");
            expect(selfProp.value).toBe("self");

            const selfValue = tokens[17] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(selfValue, 'Record');
        });

        it("marks cyclic references in arrays", () => {
            const arr: any[] = [];
            arr.push(arr);

            expect(arr[0]).toBe(arr);

            const tokens = tokenize(arr);
            expectIgnored(tokens, 'Array');
        });

        it("marks cyclic references in sets", () => {
            const set = new Set();
            set.add(set);

            expect(set.has(set)).toBe(true);

            const tokens = tokenize(set);
            expectIgnored(tokens, 'Set');
        });

        it("marks cyclic references in maps", () => {
            const map = new Map();
            map.set("self", map);

            expect(map.get("self")).toBe(map);

            const tokens = tokenize(map);
            const kinds = _tokenization.extractKinds(tokens);

            expect(kinds).toEqual([
                'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',

                'group-start', 'primitive',
                'hard-space', 'key-value-separator',
                'hard-space', 'primitive',
                'group-end',

                'indent-end', 'soft-line', 'object-close', 'group-end'
            ]);

            const key = tokens[6] as InstanceType<typeof TOKENS.Primitive>;
            expect(key).toBeInstanceOf(TOKENS.Primitive);
            expect(key.kind).toBe("primitive");
            expect(key.type).toBe("string");
            expect(key.value).toBe("self");

            const value = tokens[10] as InstanceType<typeof TOKENS.Primitive>;
            expectIgnoredToken(value, 'Map');
        });

    });
    
});