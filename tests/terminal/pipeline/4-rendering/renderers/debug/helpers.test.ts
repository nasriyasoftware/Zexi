
import DebugRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/debug/renderer";
import DefaultTokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/default.tokenizer";
import type { DebugOptions } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/debug/types";

describe("DebugRenderer", () => {

    // -----------------------------------------------------------------
    // primitives
    // -----------------------------------------------------------------

    describe("primitives", () => {

        it("renders strings without quotes at the root scope", () => {
            expect(render("hello world")).toBe("hello world");
        });

        it("renders strings with quotes inside structures", () => {
            const output = render({
                value: "hello world"
            });

            expect(output).toContain('"value": "hello world"');
        });

        it("renders empty strings", () => {
            const output = render({
                value: ""
            });

            expect(output).toContain('"value": ""');
        });

        it("renders positive numbers", () => {
            expect(render(42)).toBe("42");
        });

        it("renders negative numbers", () => {
            expect(render(-42)).toBe("-42");
        });

        it("renders floating-point numbers", () => {
            expect(render(3.14159)).toBe("3.14159");
        });

        it("renders zero", () => {
            expect(render(0)).toBe("0");
        });

        it("renders NaN", () => {
            expect(render(NaN)).toBe("NaN");
        });

        it("renders positive infinity", () => {
            expect(render(Infinity)).toBe("Infinity");
        });

        it("renders negative infinity", () => {
            expect(render(-Infinity)).toBe("-Infinity");
        });

        it("renders bigint", () => {
            expect(render(9007199254740991n)).toBe("9007199254740991");
        });

        it("renders true", () => {
            expect(render(true)).toBe("true");
        });

        it("renders false", () => {
            expect(render(false)).toBe("false");
        });

        it("renders null", () => {
            expect(render(null)).toBe("null");
        });

        it("renders undefined", () => {
            expect(render(undefined)).toBe("undefined");
        });

        it("renders symbols", () => {
            expect(render(Symbol("target"))).toBe("Symbol(target)");
        });

        it("renders global symbols", () => {
            expect(render(Symbol.for("global_target"))).toBe(
                "Symbol(global_target)"
            );
        });
    });

    // -----------------------------------------------------------------
    // objects
    // -----------------------------------------------------------------

    describe("objects", () => {

        it("renders object properties", () => {
            const output = render({
                a: 1,
                b: 2,
                c: 3
            });

            expect(output).toContain('"a": 1');
            expect(output).toContain('"b": 2');
            expect(output).toContain('"c": 3');
        });

        it("renders nested objects", () => {
            const output = render({
                level1: {
                    level2: {
                        level3: {
                            value: "deep"
                        }
                    }
                }
            });

            expect(output).toContain('"value": "deep"');
        });

        it("renders objects with null prototypes", () => {
            const value = Object.create(null, {
                a: {
                    value: 1,
                    enumerable: true
                },
                b: {
                    value: 2,
                    enumerable: true
                }
            });

            const output = render(value);

            expect(output).toContain('"a": 1');
            expect(output).toContain('"b": 2');
        });

        it("renders inherited properties", () => {
            const value = Object.create(
                {
                    inherited: "value"
                },
                {
                    own: {
                        value: 123,
                        enumerable: true
                    }
                }
            );

            const output = render(value);

            expect(output).toContain('"inherited": "value"');
            expect(output).toContain('"own": 123');
        });

        it("does not invoke getters", () => {
            const getter = jest.fn(() => 42);

            const value = {
                get dangerous() {
                    return getter();
                }
            };

            const output = render(value);

            expect(getter).not.toHaveBeenCalled();
            expect(output).toBe('{ "dangerous": [Getter:dangerous] }');
        });

        it("renders symbol-keyed properties", () => {
            const first = Symbol("a");
            const second = Symbol("b");

            const value = {
                [first]: 1,
                [second]: 2
            };

            const output = render(value);

            expect(output).toContain("Symbol(a)");
            expect(output).toContain("Symbol(b)");
            expect(output).toContain("1");
            expect(output).toContain("2");
        });
    });

    // -----------------------------------------------------------------
    // arrays
    // -----------------------------------------------------------------

    describe("arrays", () => {

        it("renders arrays", () => {
            expect(render([1, 2, 3])).toContain("[1, 2, 3]");
        });

        it("renders nested arrays", () => {
            const output = render([
                [1, 2],
                [3, 4],
                [5, [6, 7]]
            ]);

            expect(output).toContain("[1, 2]");
            expect(output).toContain("[3, 4]");
            expect(output).toContain("[6, 7]");
        });

        it("renders undefined array elements", () => {
            const output = render([
                1,
                undefined,
                3
            ]);

            expect(output).toContain("undefined");
        });

        it("renders sparse arrays without inventing values", () => {
            const value = [1, , 3, , , 6];

            const output = render(value);

            expect(output).toContain("1");
            expect(output).toContain("3");
            expect(output).toContain("6");
        });

        it("renders arrays containing mixed values", () => {
            const output = render([
                1,
                "string",
                null,
                undefined,
                { a: 1 },
                [2, 3],
                new Date("2021-01-01"),
                /regex/
            ]);

            expect(output).toContain("1");
            expect(output).toContain('"string"');
            expect(output).toContain("null");
            expect(output).toContain("undefined");
            expect(output).toContain('"a": 1');
            expect(output).toContain("[2, 3]");
            expect(output).toContain("2021-01-01T00:00:00.000Z");
            expect(output).toContain("[RegExp:/regex/]");
        });
    });

    // -----------------------------------------------------------------
    // dates
    // -----------------------------------------------------------------

    describe("dates", () => {

        it("renders dates using ISO format", () => {
            const output = render(
                new Date("2020-01-01T00:00:00.000Z")
            );

            expect(output).toBe(
                "2020-01-01T00:00:00.000Z"
            );
        });

        it("renders nested dates as ISO strings", () => {
            const output = render({
                date: new Date("2020-01-01T00:00:00.000Z")
            });

            expect(output).toContain(
                '"date": "2020-01-01T00:00:00.000Z"'
            );
        });
    });

    // -----------------------------------------------------------------
    // functions
    // -----------------------------------------------------------------

    describe("functions", () => {

        it("renders anonymous functions", () => {
            const output = render(() => { });

            expect(output).toBe("[Function:anonymous]");
        });

        it("renders named functions", () => {
            const named = function named() { };

            expect(render(named)).toBe("[Function:named]");
        });

        it("renders arrow function names", () => {
            const func = () => { };

            expect(render(func)).toBe("[Function:func]");
        });

        it("renders async functions", () => {
            const asyncFunc = async () => { };

            expect(render(asyncFunc)).toBe("[Function:asyncFunc]");
        });

        it("renders generator functions", () => {
            const generatorFunc = function* generatorFunc() {
                yield 1;
            };

            expect(render(generatorFunc)).toBe(
                "[Function:generatorFunc]"
            );
        });

        it("renders methods using their function name", () => {
            const value = {
                method() {
                    return 123;
                }
            };

            const output = render(value);

            expect(output).toContain("[Function:method]");
        });
    });

    // -----------------------------------------------------------------
    // regular expressions
    // -----------------------------------------------------------------

    describe("regular expressions", () => {

        it("renders a regular expression", () => {
            expect(render(/target/gi)).toBe(
                "[RegExp:/target/gi]"
            );
        });

        it("renders regular expression flags", () => {
            expect(render(/target/gimuy)).toBe(
                "[RegExp:/target/gimuy]"
            );
        });

        it("preserves complex regular expression patterns", () => {
            const regex = /a+[\w]+\d{1,3}.*(test|prod)?/i;

            expect(render(regex)).toBe(
                "[RegExp:/a+[\\w]+\\d{1,3}.*(test|prod)?/i]"
            );
        });
    });

    // -----------------------------------------------------------------
    // collections
    // -----------------------------------------------------------------

    describe("collections", () => {

        it("renders sets", () => {
            const output = render(new Set([1, 2, 3, 3, 4]));

            expect(output).toContain("Set");
            expect(output).toContain("1");
            expect(output).toContain("2");
            expect(output).toContain("3");
            expect(output).toContain("4");
        });

        it("renders empty sets", () => {
            const output = render(new Set());

            expect(output).toContain("Set");
        });

        it("renders maps", () => {
            const output = render(new Map([
                ["a", 1],
                ["b", 2],
                ["c", 3]
            ]));

            expect(output).toContain("Map");
            expect(output).toContain('"a"');
            expect(output).toContain('"b"');
            expect(output).toContain('"c"');
            expect(output).toContain("1");
            expect(output).toContain("2");
            expect(output).toContain("3");
        });

        it("renders empty maps", () => {
            const output = render(new Map());

            expect(output).toContain("Map");
        });
    });

    // -----------------------------------------------------------------
    // errors
    // -----------------------------------------------------------------

    describe("errors", () => {

        it("renders the error name", () => {
            const output = render(new Error("target"));

            expect(output).toContain("Error");
        });

        it("renders the error message", () => {
            const output = render(new Error("target"));

            expect(output).toContain("target");
        });

        it("renders specific error types", () => {
            expect(render(new TypeError("type mismatch")))
                .toContain("TypeError");

            expect(render(new RangeError("out of range")))
                .toContain("RangeError");
        });

        it("renders the error description in compact mode", () => {
            const output = render(
                new Error("target"),
                {
                    mode: "compact"
                }
            );

            expect(output).toContain("Error");
            expect(output).toContain("target");
        });

        it("omits the stack trace in compact mode", () => {
            const output = render(
                new Error("target"),
                {
                    mode: "compact"
                }
            );

            expect(output).not.toContain("Stack Trace:");
        });

        it("omits the cause in compact mode", () => {
            const output = render(
                new Error("target", {
                    cause: new Error("cause")
                }),
                {
                    mode: "compact"
                }
            );

            expect(output).not.toContain("Caused by:");
            expect(output).not.toContain("cause");
        });

        it("renders the stack trace in pretty mode", () => {
            const output = render(
                new Error("target"),
                {
                    mode: "pretty"
                }
            );

            expect(output).toContain("Stack Trace:");
        });

        it("renders the cause in pretty mode", () => {
            const output = render(
                new Error("target", {
                    cause: new Error("cause")
                }),
                {
                    mode: "pretty"
                }
            );

            expect(output).toContain("Caused by:");
            expect(output).toContain("cause");
        });

        it("renders nested error causes", () => {
            const output = render(
                new Error("outer", {
                    cause: new Error("middle", {
                        cause: new Error("inner")
                    })
                }),
                {
                    mode: "pretty"
                }
            );

            expect(output).toContain("outer");
            expect(output).toContain("middle");
            expect(output).toContain("inner");
        });
    });

    // -----------------------------------------------------------------
    // references / cycles
    // -----------------------------------------------------------------

    describe("references", () => {

        it("renders a circular reference using the configured marker", () => {
            const value: Record<string, unknown> = {
                name: "circular"
            };

            value.self = value;

            const output = render(value, {
                cycles: "mark"
            });

            expect(output).toContain("[Circular:");
        });

        it("ignores circular references when configured to ignore", () => {
            const value: Record<string, unknown> = {
                name: "circular"
            };

            value.self = value;

            const output = render(value, {
                cycles: "ignore"
            });

            expect(output).not.toContain("[Reference:");
        });

        it("throws when circular references are configured to throw", () => {
            const value: Record<string, unknown> = {
                name: "circular"
            };

            value.self = value;

            expect(() => {
                render(value, {
                    cycles: "throw"
                });
            }).toThrow();
        });

        it("does not duplicate shared references", () => {
            const child = {
                value: 42
            };

            const value = {
                first: child,
                second: child
            };

            const output = render(value);

            expect(output).toContain('"first"');
            expect(output).toContain('"second"');

            expect(output).not.toContain("[Reference:");
            expect(output.match(/"value": 42/g)).toHaveLength(2);
        });
    });

    // -----------------------------------------------------------------
    // layout
    // -----------------------------------------------------------------

    describe("layout", () => {

        it("does not force simple objects into multiline output", () => {
            const output = render({
                a: 1,
                b: 2
            }, {
                mode: "pretty"
            });

            /*
             * Pretty mode does not mean "always multiline".
             * Simple structures may remain inline when the resolver
             * determines that they fit safely.
             */
            expect(output).not.toContain("\n");
        });

        it("renders complex structures using block layout when required", () => {
            const output = render({
                first: {
                    nested: {
                        value: "a sufficiently long value that contributes to layout pressure"
                    }
                },
                second: {
                    nested: {
                        value: "another sufficiently long value that contributes to layout pressure"
                    }
                }
            }, {
                mode: "pretty"
            });

            expect(output).toContain("\n");
        });

        it("respects indentation width for block layout", () => {
            const output = render({
                first: {
                    nested: {
                        value: "a sufficiently long value that contributes to layout pressure"
                    }
                },
                second: {
                    nested: {
                        value: "another sufficiently long value that contributes to layout pressure"
                    }
                }
            }, {
                mode: "pretty",
                spaces: 2
            });

            const lines = output.split("\n");
            const valueLines = lines.filter(l => l.includes('"value":'));

            expect(valueLines).toHaveLength(2);
            expect(valueLines.every(l => l.startsWith('    "nested": { "value": '))).toBe(true);
        });

        it("supports zero indentation for block layout", () => {
            const output = render({
                first: {
                    nested: {
                        value: "a sufficiently long value that contributes to layout pressure"
                    }
                },
                second: {
                    nested: {
                        value: "another sufficiently long value that contributes to layout pressure"
                    }
                }
            }, {
                mode: "pretty",
                spaces: 0
            });

            const valueLine = output
                .split("\n")
                .find(line => line.includes('"value":'));

            expect(valueLine).toBeDefined();
            expect(valueLine).toBe(valueLine!.trimStart());
        });
    });

    // -----------------------------------------------------------------
    // ANSI
    // -----------------------------------------------------------------

    describe("ANSI output", () => {

        it("renders without ANSI formatting by default", () => {
            const output = render({
                value: 42
            });

            expect(output).not.toMatch(/\x1b\[/);
        });

        it("supports ANSI formatting when enabled", () => {
            const output = render({
                value: 42
            }, {
                ansiEnabled: true
            });

            expect(output).toMatch(/\x1b\[/);
        });

        it("applies ANSI formatting to strings", () => {
            const output = render({
                value: "hello"
            }, {
                ansiEnabled: true
            });

            expect(output).toMatch(/\x1b\[/);
        });

        it("applies ANSI formatting to special numbers", () => {
            const output = render({
                value: Infinity
            }, {
                ansiEnabled: true
            });

            expect(output).toMatch(/\x1b\[/);
        });
    });

    // -----------------------------------------------------------------
    // configuration
    // -----------------------------------------------------------------

    describe("configuration", () => {

        it("uses pretty mode by default", () => {
            const output = render(new Error("target"));

            expect(output).toContain("Stack Trace:");
        });

        it("omits stack trace in compact mode", () => {
            const output = render(new Error("target"), {
                mode: "compact"
            });

            expect(output).not.toContain("Stack Trace:");
        });

        it("accepts pretty mode", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    mode: "pretty"
                });
            }).not.toThrow();
        });

        it("accepts compact mode", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    mode: "compact"
                });
            }).not.toThrow();
        });

        it("accepts zero indentation", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    mode: "pretty",
                    spaces: 0
                });
            }).not.toThrow();
        });

        it("accepts the maximum indentation width", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    mode: "pretty",
                    spaces: 8
                });
            }).not.toThrow();
        });

        it("rejects negative indentation", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    spaces: -1
                });
            }).toThrow(RangeError);
        });

        it("rejects indentation greater than eight spaces", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    spaces: 9
                });
            }).toThrow(RangeError);
        });

        it("rejects an invalid mode", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    mode: "invalid" as never
                });
            }).toThrow(TypeError);
        });

        it("rejects an invalid cycles policy", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    cycles: "invalid" as never
                });
            }).toThrow(RangeError);
        });

        it("rejects a non-boolean ansiEnabled value", () => {
            expect(() => {
                render({
                    value: 1
                }, {
                    ansiEnabled: "yes" as never
                });
            }).toThrow(TypeError);
        });
    });

});

function render(
    value: unknown,
    options: DebugOptions = {}
) {
    const tokens = DefaultTokenizer(value, options.cycles ?? 'mark');
    return DebugRenderer.render(tokens, options);
}