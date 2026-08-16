import DefaultTokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/default.tokenizer";
import DebugRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/debug/renderer";
import type { DebugOptions } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/debug/types";

/* ------------------------------------------------------------------ */
/* TEST UTIL                                                          */
/* ------------------------------------------------------------------ */

function render(value: unknown, options: DebugOptions = {}) {
    const tokens = DefaultTokenizer(value, options.cycles ?? "mark");
    return DebugRenderer.render(tokens, options);
}

/* ------------------------------------------------------------------ */
/* CORE PRIMITIVE BEHAVIOR                                           */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - primitives", () => {

    it("renders primitive numbers deterministically", () => {
        expect(render(123)).toBe("123");
    });

    it("renders booleans deterministically", () => {
        expect(render(true)).toBe("true");
        expect(render(false)).toBe("false");
    });

    it("renders null deterministically", () => {
        expect(render(null)).toBe("null");
    });

    it("renders undefined explicitly", () => {
        expect(render(undefined)).toBe("undefined");
    });

    it("renders bigint deterministically", () => {
        expect(render(BigInt(10))).toBe("10");
    });

    it("renders symbols deterministically", () => {
        expect(render(Symbol("test"))).toBe("Symbol(test)");
    });

    it("renders root strings without quotations", () => {
        expect(render("hello")).toBe("hello");
    });

    it("quotes strings when nested inside an object", () => {
        expect(
            render({ value: "hello" })
        ).toContain('"value": "hello"');
    });
});

/* ------------------------------------------------------------------ */
/* NUMBER EDGE CASES                                                  */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - numeric edge cases", () => {

    it("renders NaN explicitly", () => {
        expect(render(NaN)).toBe("NaN");
    });

    it("renders positive infinity explicitly", () => {
        expect(render(Infinity)).toBe("Infinity");
    });

    it("renders negative infinity explicitly", () => {
        expect(render(-Infinity)).toBe("-Infinity");
    });

    it("preserves numeric values inside structures", () => {
        const output = render({
            nan: NaN,
            positive: Infinity,
            negative: -Infinity
        });

        expect(output).toContain('"nan": NaN');
        expect(output).toContain('"positive": Infinity');
        expect(output).toContain('"negative": -Infinity');
    });
});

/* ------------------------------------------------------------------ */
/* STRUCTURAL RENDERING                                               */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - structural rendering", () => {

    it("renders objects structurally", () => {
        expect(
            render({ a: 1, b: 2 })
        ).toContain('"a": 1');

        expect(
            render({ a: 1, b: 2 })
        ).toContain('"b": 2');
    });

    it("renders arrays structurally", () => {
        const output = render([1, 2, 3]);

        expect(output).toContain("[");
        expect(output).toContain("1");
        expect(output).toContain("2");
        expect(output).toContain("3");
        expect(output).toContain("]");
    });

    it("renders deeply nested structures", () => {
        const output = render({
            a: {
                b: {
                    c: 1
                }
            }
        });

        expect(output).toContain('"a"');
        expect(output).toContain('"b"');
        expect(output).toContain('"c": 1');
    });

    it("preserves structural integrity", () => {
        const output = render({
            a: {
                b: 1
            }
        });

        const opens = (output.match(/\{/g) || []).length;
        const closes = (output.match(/\}/g) || []).length;

        expect(opens).toBe(closes);
    });

    it("renders class instances using their class name", () => {
        class User {
            name = "Ahmad";
        }

        const output = render(new User());

        expect(output).toContain("User");
        expect(output).toContain('"name": "Ahmad"');
    });
});

/* ------------------------------------------------------------------ */
/* SPECIAL OBJECT TYPES                                               */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - special objects", () => {

    it("renders Date values using their ISO representation", () => {
        const date = new Date("2020-01-01T00:00:00.000Z");

        const output = render({ date });

        expect(output).toContain(
            "2020-01-01T00:00:00.000Z"
        );
    });

    it("renders regular expressions using debug representation", () => {
        const output = render(/abc/gi);

        expect(output).toBe("[RegExp:/abc/gi]");
    });

    it("renders regular expressions without flags", () => {
        expect(
            render(/abc/)
        ).toBe("[RegExp:/abc/]");
    });

    it("renders functions using debug representation", () => {
        function testFn() { }

        expect(
            render({ fn: testFn })
        ).toContain("[Function:testFn]");
    });

    it("renders anonymous functions safely", () => {
        const output = render({
            fn: () => 1
        });

        expect(typeof output).toBe("string");
        expect(output.length).toBeGreaterThan(0);
    });

    it("renders getter functions using Getter label", () => {
        const descriptor = {
            get value() {
                return 42;
            }
        };

        const output = render(descriptor);

        expect(output).toContain("[Getter:value]");
    });

    it("renders setter functions using Setter label", () => {
        const descriptor = {
            set value(value: number) { }
        };

        const output = render(descriptor);

        expect(output).toContain("[Setter:value]");
    });

    it("renders Set values structurally", () => {
        const output = render(new Set([1, 2, 3]));

        expect(output).toContain("Set");
        expect(output).toContain("1");
        expect(output).toContain("2");
        expect(output).toContain("3");
    });

    it("renders Map values structurally", () => {
        const output = render(
            new Map([
                ["a", 1],
                ["b", 2]
            ])
        );

        expect(output).toContain("Map");
        expect(output).toContain('"a"');
        expect(output).toContain("1");
        expect(output).toContain('"b"');
        expect(output).toContain("2");
    });
});

/* ------------------------------------------------------------------ */
/* ERROR BEHAVIOR                                                     */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - errors", () => {

    it("renders an error name and message", () => {
        const output = render(new Error("boom"));

        expect(output).toContain("Error: boom");
    });

    it("renders specific error types", () => {
        const output = render(
            new TypeError("invalid value")
        );

        expect(output).toContain("TypeError: invalid value");
    });

    it("renders the stack trace in pretty mode", () => {
        const output = render(
            new Error("boom"),
            { mode: "pretty" }
        );

        expect(output).toContain("Stack Trace:");
        expect(output).toContain("- at");
    });

    it("omits the stack trace in compact mode", () => {
        const output = render(
            new Error("boom"),
            { mode: "compact" }
        );

        expect(output).not.toContain("Stack Trace:");
        expect(output).not.toContain("- at");
    });

    it("renders error causes in pretty mode", () => {
        const output = render(
            new Error("outer", {
                cause: new TypeError("inner")
            }),
            { mode: "pretty" }
        );

        expect(output).toContain("Caused by:");
        expect(output).toContain("TypeError: inner");
    });

    it("omits error causes in compact mode", () => {
        const output = render(
            new Error("outer", {
                cause: new TypeError("inner")
            }),
            { mode: "compact" }
        );

        expect(output).not.toContain("Caused by:");
        expect(output).not.toContain("TypeError: inner");
    });

    it("renders nested error causes in pretty mode", () => {
        const output = render(
            new TypeError("outer", {
                cause: new SyntaxError("middle", {
                    cause: new Error("inner")
                })
            }),
            { mode: "pretty" }
        );

        expect(output).toContain("TypeError: outer");
        expect(output).toContain("SyntaxError: middle");
        expect(output).toContain("Error: inner");
        expect(output).toContain("Caused by:");
    });

    it("keeps compact errors focused on the primary error", () => {
        const output = render(
            new TypeError("outer", {
                cause: new SyntaxError("inner")
            }),
            { mode: "compact" }
        );

        expect(output).toContain("TypeError: outer");
        expect(output).not.toContain("SyntaxError: inner");
        expect(output).not.toContain("Stack Trace:");
    });
});

/* ------------------------------------------------------------------ */
/* CIRCULAR REFERENCES                                                */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - circular references", () => {

    it("marks circular references by default", () => {
        const value: Record<string, unknown> = {
            name: "root"
        };

        value.self = value;

        const output = render(value);

        expect(output).toContain("[Circular:Record:1]");
    });

    it("renders circular references according to the mark policy", () => {
        const value: Record<string, unknown> = {
            name: "root"
        };

        value.self = value;

        const output = render(value, {
            cycles: "mark"
        });

        expect(output).toBe('{ "name": "root", "self": "[Circular:Record:1]" }')
    });

    it("replaces circular references with null when ignored", () => {
        const value: Record<string, unknown> = {
            name: "root"
        };

        value.self = value;

        const output = render(value, {
            cycles: "ignore"
        });

        expect(output).toContain('"self": null');
        expect(output).not.toContain("[Reference:");
    });

    it("throws when circular references are configured to throw", () => {
        const value: Record<string, unknown> = {
            name: "root"
        };

        value.self = value;

        expect(() => {
            render(value, {
                cycles: "throw"
            });
        }).toThrow();
    });

    it("expands shared references independently", () => {
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

        const occurrences = output.match(/"value": 42/g);

        expect(occurrences).toHaveLength(2);
    });
});

/* ------------------------------------------------------------------ */
/* LAYOUT MODE BEHAVIOR                                               */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - layout modes", () => {

    it("uses pretty mode by default", () => {
        const output = render(
            new Error("boom")
        );

        expect(output).toContain("Stack Trace:");
    });

    it("compact mode changes diagnostic detail rather than forcing one-line output", () => {
        const output = render(
            new Error("boom"),
            { mode: "compact" }
        );

        expect(output).toContain("Error: boom");
        expect(output).not.toContain("Stack Trace:");
    });

    it("pretty mode still renders simple objects inline when they fit", () => {
        const output = render(
            { a: 1, b: 2 },
            { mode: "pretty" }
        );

        expect(output).toBe('{ "a": 1, "b": 2 }');
    });

    it("pretty mode expands structures when layout pressure requires it", () => {
        const output = render(
            {
                alpha: "a".repeat(150),
                beta: "b".repeat(150)
            },
            { mode: "pretty" }
        );

        expect(output).toContain("\n");
    });

    it("pretty mode does not imply that every nested object gets its own lines", () => {
        const output = render(
            {
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
            },
            {
                mode: "pretty",
                spaces: 2
            }
        );

        expect(output).toBe([
            '{',
            '  "first": {',
            '    "nested": { "value": "a sufficiently long value that contributes to layout pressure" }',
            '  },',
            '  "second": {',
            '    "nested": { "value": "another sufficiently long value that contributes to layout pressure" }',
            '  }',
            '}'
        ].join("\n"));
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - INDENTATION                                          */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - indentation", () => {

    it("uses the configured indentation width", () => {
        const output = render(
            {
                a: {
                    b: {
                        value: "a sufficiently long value that contributes to layout pressure"
                    }
                }
            },
            {
                mode: "pretty",
                spaces: 4
            }
        );

        expect(output).toContain("\n    ");
    });

    it("supports zero indentation", () => {
        const output = render(
            {
                a: {
                    b: {
                        value: "a sufficiently long value that contributes to layout pressure"
                    }
                }
            },
            {
                mode: "pretty",
                spaces: 0
            }
        );

        expect(output).not.toContain("  ");
    });

    it("uses indentation according to actual block nesting", () => {
        const output = render(
            {
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
            },
            {
                mode: "pretty",
                spaces: 2
            }
        );

        /*
         * `nested` remains inline with its `value`, so the value is
         * indented only to the level of the `nested` object itself.
         */
        expect(
            output.match(/^    "nested": \{ "value":/gm)
        ).toHaveLength(2);
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - INLINE LAYOUT                                        */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - pretty inline layout", () => {

    it("renders small objects inline", () => {
        expect(
            render(
                { a: 1 },
                { mode: "pretty" }
            )
        ).toBe('{ "a": 1 }');
    });

    it("renders small arrays inline", () => {
        expect(
            render(
                [1, 2, 3],
                { mode: "pretty" }
            )
        ).toBe("[1, 2, 3]");
    });

    describe("DebugRenderer - pretty inline layout", () => {
        it("renders simple objects inline", () => {
            expect(
                render(
                    { a: 1, b: 2 },
                    { mode: "pretty" }
                )
            ).toBe('{ "a": 1, "b": 2 }');
        });
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - BLOCK LAYOUT                                         */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - pretty block layout", () => {

    it("renders nested object structures using block layout", () => {
        const output = render(
            {
                a: {
                    b: 1
                }
            },
            { mode: "pretty", spaces: 2 }
        );

        expect(output).toBe([
            '{',
            '  "a": { "b": 1 }',
            '}'
        ].join("\n"));
    });

    it("breaks an object when its content exceeds the available width", () => {
        const output = render(
            {
                alpha: "a sufficiently long value that contributes to layout pressure",
                beta: "another sufficiently long value that contributes to layout pressure"
            },
            {
                mode: "pretty"
            }
        );

        expect(output).toContain("\n");
        expect(output).toContain('"alpha"');
        expect(output).toContain('"beta"');
    });

    it("breaks nested structures when layout pressure requires it", () => {
        const output = render(
            {
                a: {
                    b: {
                        c: "a sufficiently long value that contributes to layout pressure"
                    }
                }
            },
            {
                mode: "pretty"
            }
        );

        expect(output).toContain("\n");
        expect(output).toContain('"c": "a sufficiently long value');
    });

    it("renders a simple nested object within a block parent", () => {
        const output = render(
            {
                a: {
                    b: 1
                }
            },
            {
                mode: "pretty"
            }
        );

        expect(output).toBe([
            '{',
            '    "a": { "b": 1 }',
            '}'
        ].join("\n"));
    });
});

/* ------------------------------------------------------------------ */
/* ANSI STYLING                                                       */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - ANSI styling", () => {

    it("renders normally when ANSI styling is disabled", () => {
        const output = render(
            {
                value: 123
            },
            {
                ansiEnabled: false
            }
        );

        expect(output).not.toMatch(/\x1b\[/);
    });

    it("applies ANSI styling when enabled", () => {
        const output = render(
            {
                value: 123
            },
            {
                ansiEnabled: true
            }
        );

        expect(output).toMatch(/\x1b\[/);
    });

    it("styles function output when ANSI is enabled", () => {
        function testFn() { }

        const output = render(
            { fn: testFn },
            {
                ansiEnabled: true
            }
        );

        expect(output).toMatch(/\x1b\[/);
        expect(output).toContain("testFn");
    });

    it("styles regular expressions when ANSI is enabled", () => {
        const output = render(
            /abc/gi,
            {
                ansiEnabled: true
            }
        );

        expect(output).toMatch(/\x1b\[/);
        expect(output).toContain("/abc/");
        expect(output).toContain("gi");
    });
});

/* ------------------------------------------------------------------ */
/* OPTION VALIDATION                                                  */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - option validation", () => {

    it("rejects non-object options", () => {
        expect(() => {
            DebugRenderer.render(
                DefaultTokenizer(1, 'throw'),
                "invalid" as unknown as DebugOptions
            );
        }).toThrow(TypeError);
    });

    it("rejects invalid mode", () => {
        expect(() => {
            render(1, {
                mode: "invalid" as DebugOptions["mode"]
            });
        }).toThrow(TypeError);
    });

    it("rejects non-string cycles option", () => {
        expect(() => {
            render(1, {
                cycles: 123 as unknown as DebugOptions["cycles"]
            });
        }).toThrow(TypeError);
    });

    it("rejects unsupported cycles policy", () => {
        expect(() => {
            render(1, {
                cycles: "invalid" as DebugOptions["cycles"]
            });
        }).toThrow(RangeError);
    });

    it("rejects non-numeric spaces", () => {
        expect(() => {
            render(1, {
                spaces: "2" as unknown as number
            });
        }).toThrow(TypeError);
    });

    it("rejects negative spaces", () => {
        expect(() => {
            render(1, {
                spaces: -1
            });
        }).toThrow(RangeError);
    });

    it("rejects spaces greater than eight", () => {
        expect(() => {
            render(1, {
                spaces: 9
            });
        }).toThrow(RangeError);
    });

    it("rejects non-boolean ansiEnabled", () => {
        expect(() => {
            render(1, {
                ansiEnabled: "true" as unknown as boolean
            });
        }).toThrow(TypeError);
    });
});

/* ------------------------------------------------------------------ */
/* DETERMINISM                                                        */
/* ------------------------------------------------------------------ */

describe("DebugRenderer - determinism", () => {

    it("produces identical output across repeated renders", () => {
        const value = {
            alpha: [1, 2, 3],
            beta: {
                gamma: true
            }
        };

        expect(
            render(value)
        ).toBe(
            render(value)
        );
    });

    it("always returns a string", () => {
        expect(typeof render(1)).toBe("string");
        expect(typeof render({ a: 1 })).toBe("string");
        expect(typeof render([1, 2])).toBe("string");
        expect(typeof render(new Date())).toBe("string");
        expect(typeof render(/abc/)).toBe("string");
        expect(typeof render(() => 1)).toBe("string");
    });

    it("does not crash on deeply nested input", () => {
        const deep = {
            a: {
                b: {
                    c: {
                        d: {
                            e: 1
                        }
                    }
                }
            }
        };

        expect(() => render(deep)).not.toThrow();
    });

    it("is deterministic across repeated calls", () => {
        const value = {
            a: 1,
            b: 2,
            c: 3
        };

        expect(render(value)).toBe(render(value));
        expect(render(value)).toBe(render(value));
    });
});