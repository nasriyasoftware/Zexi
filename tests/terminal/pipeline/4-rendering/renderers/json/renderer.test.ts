import JSONTokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizers/json.tokenizer";
import JSONRenderer from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/renderer";
import type { JsonOptions } from "../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/types";

import path from 'path';
import fs from 'fs';

const stableVersion = (() => {
    try {
        const pkgPath = path.join(process.cwd(), 'package.json');

        const pkgStr = fs.readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgStr);

        const versionSegments = (pkg?.version || "0.0.0").split(".");
        return `${versionSegments[0]}.${versionSegments[1]}`;
    } catch (err) {
        return "0.0";
    }
})();

/* ------------------------------------------------------------------ */
/* TEST UTIL                                                          */
/* ------------------------------------------------------------------ */

function render(value: unknown, options: JsonOptions = {}) {
    const tokens = JSONTokenizer(value);
    return JSONRenderer.render(tokens, options);
}

/* ------------------------------------------------------------------ */
/* CORE PRIMITIVE BEHAVIOR                                           */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - primitives", () => {
    it("renders primitive numbers deterministically", () => {
        expect(render(123)).toBe("123");
    });

    it("renders primitive strings (root vs nested behavior)", () => {
        const root = render("abc");
        expect(root).toBe("abc");

        const obj = { a: "abc" }
        const objStr = '{ "a": "abc" }';
        const nested = render(obj, { mode: 'pretty' });
        expect(nested).toBe(objStr);

        const nestedCompact = render(obj);
        expect(nestedCompact).toBe(objStr.replace(/ /g, ''));
    });

    it("renders booleans and null deterministically", () => {
        expect(render(true)).toBe("true");
        expect(render(false)).toBe("false");
        expect(render(null)).toBe("null");
    });

    it("renders undefined as explicit primitive", () => {
        expect(render(undefined)).toBe("undefined");
    });

    it("renders bigint deterministically", () => {
        expect(render(BigInt(10))).toBe("10");
    });
});

/* ------------------------------------------------------------------ */
/* NUMBER EDGE CASES                                                  */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - numeric edge cases", () => {
    it("renders NaN and infinities deterministically", () => {
        const out = render({ a: NaN, b: Infinity, c: -Infinity });
        const expected = `{"a":{"$codec":"zexi@${stableVersion}","$kind":"number","$payload":{"value":"NaN"}},"b":{"$codec":"zexi@${stableVersion}","$kind":"number","$payload":{"value":"Infinity"}},"c":{"$codec":"zexi@${stableVersion}","$kind":"number","$payload":{"value":"-Infinity"}}}`;
        expect(out).toBe(expected);
    });
});

/* ------------------------------------------------------------------ */
/* STRUCTURES                                                         */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - structural rendering", () => {
    it("renders arrays deterministically", () => {
        const out = render([1, 2, 3]);
        expect(out).toBe("[1,2,3]");
    });

    it("renders deeply nested structures", () => {
        const out = render({ a: { b: { c: 1 } } });
        expect(typeof out).toBe("string");
        expect(out.includes("c")).toBe(true);
        expect(out.includes("1")).toBe(true);
    });

    it("preserves structural integrity (balanced braces)", () => {
        const out = render({ a: { b: 1 } });

        const opens = (out.match(/\{/g) || []).length;
        const closes = (out.match(/\}/g) || []).length;

        expect(opens).toBe(closes);
    });
});

/* ------------------------------------------------------------------ */
/* OBJECT SEMANTICS (PASS BEHAVIOR, NOT JSON.STRINGIFY)              */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - object semantics", () => {
    it("is deterministic across identical inputs", () => {
        const v = { a: 1, b: 2 };

        const r1 = render(v);
        const r2 = render(v);

        expect(r1).toBe(r2);
    });

    it("handles re-ordered input objects consistently", () => {
        const a = render({ a: 1, b: 2 });
        const b = render({ b: 2, a: 1 });

        expect(typeof a).toBe("string");
        expect(typeof b).toBe("string");

        // ordering is normalized by pipeline, not JS insertion order
        expect(a).toBe(b);
    });

    it("collapses class instances into structural output", () => {
        class A {
            x = 1;
        }

        const out = render(new A());
        expect(typeof out).toBe("string");
        expect(out.includes("x")).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* MAP / SET ENVELOPES                                                */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - Map/Set envelopes", () => {
    it("renders Map with envelope structure", () => {
        const map = new Map([["a", 1]]);
        const out = render(map);

        expect(out.includes("$codec")).toBe(true);
        expect(out.includes("$kind")).toBe(true);
        expect(out.includes("$payload")).toBe(true);
        expect(out.includes("map")).toBe(true);
    });

    it("renders Set with envelope structure", () => {
        const set = new Set([1, 2]);

        const out = render(set);

        expect(out.includes("$codec")).toBe(true);
        expect(out.includes("$kind")).toBe(true);
        expect(out.includes("set")).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* FUNCTION ENVELOPES                                                 */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - function envelopes", () => {
    it("wraps functions into envelope representation", () => {
        const fn = function testFn() { };

        const out = render({ fn });

        expect(out.includes("$codec")).toBe(true);
        expect(out.includes("$kind")).toBe(true);
        expect(out.includes("function")).toBe(true);
    });

    it("handles anonymous functions safely", () => {
        const out = render({ fn: () => 1 });

        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
    });
});

/* ------------------------------------------------------------------ */
/* ERROR ENVELOPE BEHAVIOR                                            */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - error envelopes", () => {
    it("renders basic error structure", () => {
        const err = new Error("boom");

        const out = render(err);

        expect(typeof out).toBe("string");
        expect(out.length).toBeGreaterThan(0);
        expect(out.includes("Error") || out.includes("boom")).toBe(true);
    });

    it("renders nested error causes", () => {
        const err = new TypeError("outer", {
            cause: new SyntaxError("inner")
        });

        const out = render(err);

        expect(out.includes("$codec")).toBe(true);
        expect(out.includes("$kind")).toBe(true);
        expect(out.includes("TypeError")).toBe(true);
        expect(out.includes("SyntaxError")).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* LAYOUT MODE BEHAVIOR                                               */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - layout modes", () => {
    it("compact mode removes structural line breaks", () => {
        const out = render({ a: 1, b: 2 }, { mode: "compact" });

        expect(out.includes("\n")).toBe(false);
        expect(typeof out).toBe("string");
    });

    it("pretty mode does not break correctness", () => {
        const out = render({ a: 1 }, { mode: "pretty", spaces: 2 });

        expect(typeof out).toBe("string");
        expect(out.includes("a")).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* DATE HANDLING                                                      */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - date handling", () => {
    it("serializes dates deterministically", () => {
        const date = new Date("2020-01-01T00:00:00.000Z");

        const out = render({ d: date });

        expect(out.includes("2020-01-01")).toBe(true);
    });
});

/* ------------------------------------------------------------------ */
/* REGRESSION SAFETY                                                  */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - regression safety", () => {
    it("always returns a string", () => {
        expect(typeof render(1)).toBe("string");
        expect(typeof render({ a: 1 })).toBe("string");
        expect(typeof render([1, 2])).toBe("string");
    });

    it("does not crash on deeply nested input", () => {
        const deep = { a: { b: { c: { d: { e: 1 } } } } };
        expect(() => render(deep)).not.toThrow();
    });

    it("is deterministic across repeated calls", () => {
        const v = { a: 1, b: 2, c: 3 };

        expect(render(v)).toBe(render(v));
        expect(render(v)).toBe(render(v));
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - INLINE LAYOUT                                        */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - pretty inline layout", () => {
    it("renders small objects inline", () => {
        expect(
            render({ a: 1 }, { mode: "pretty" })
        ).toBe('{ "a": 1 }');
    });

    it("renders small arrays inline", () => {
        expect(
            render([1, 2, 3], { mode: "pretty" })
        ).toBe("[1, 2, 3]");
    });

    it("keeps nested inline structures inline when they fit", () => {
        expect(
            render(
                { a: [1, 2] },
                { mode: "pretty" }
            )
        ).toBe('{\n  "a": [1, 2]\n}');
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - BLOCK LAYOUT                                         */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - pretty block layout", () => {
    it("breaks objects that exceed max width", () => {
        expect(
            render(
                {
                    alpha: 1,
                    beta: 2,
                    gamma: 3
                },
                {
                    mode: "pretty",
                    maxWidth: 10
                }
            )
        ).toBe('{\n  "alpha": 1,\n  "beta": 2,\n  "gamma": 3\n}')
    });

    it("breaks arrays that exceed max width", () => {
        expect(
            render(
                [1, 2, 3, 4, 5, 6],
                {
                    mode: "pretty",
                    maxWidth: 8
                }
            )
        ).toBe([
            '[',
            '  1, 2, 3,',
            '  4, 5, 6',
            ']'
        ].join('\n'));
    });

    it("indents nested block layouts", () => {
        const out = render(
            {
                a: {
                    b: {
                        c: 1
                    }
                }
            },
            {
                mode: "pretty",
                maxWidth: 10
            }
        );

        expect(out).toBe('{\n  "a": {\n    "b": {\n      "c": 1\n    }\n  }\n}');
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - INDENTATION                                          */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - indentation", () => {
    it("uses the configured indentation width", () => {
        const out = render(
            {
                a: {
                    b: 1
                }
            },
            {
                mode: "pretty",
                spaces: 4,
                maxWidth: 10
            }
        );

        expect(out).toContain("\n    ");
    });

    it("supports zero indentation", () => {
        const out = render(
            {
                a: {
                    b: 1
                }
            },
            {
                mode: "pretty",
                spaces: 0,
                maxWidth: 10
            }
        );

        expect(out).toBe(`{\n"a": {\n"b": 1\n}\n}`);
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - ROLLBACK                                             */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - inline rollback", () => {
    it("falls back to block layout when an inline object overflows", () => {
        const out = render(
            {
                a: "abcdefghijklmnopqrstuvwxyz"
            },
            {
                mode: "pretty",
                maxWidth: 8
            }
        );

        expect(out).toBe('{\n  "a": "abcdefghijklmnopqrstuvwxyz"\n}');
    });

    it("falls back to block layout for nested arrays", () => {
        const out = render(
            {
                values: [1, 2, 3, 4, 5, 6]
            },
            {
                mode: "pretty",
                maxWidth: 10
            }
        );

        expect(out).toContain("\n");
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - SPECIAL VALUES                                       */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - pretty special values", () => {
    it("renders function envelopes correctly", () => {
        const out = render(
            {
                fn: function () { }
            },
            {
                mode: "pretty"
            }
        );

        const expectedParts = [
            '{',
            '  "fn": {',
            `    "$codec": "zexi@${stableVersion}",`,
            '    "$kind": "function",',
            '    "$payload": { "name": "fn" }',
            '  }',
            '}'
        ]

        const lines = out.split("\n");
        expect(lines[0]).toBe('{');

        const l3 = lines[2];
        const prop = l3.substring(0, 15);
        const code = l3.split("").slice(15, -2).join("");

        expect(prop).toBe('    "$codec": "');
        expect(code).toMatch(/zexi@[0-9].[0-9]/);

        expect(lines.slice(3)).toEqual(expectedParts.slice(3));
    });

    it("renders error envelopes correctly", () => {
        const out = render(new Error("boom"), { mode: "pretty" });

        const expectedParts = [
            '{',
            `  "$codec": "zexi@${stableVersion}",`,
            '  "$kind": "error",',
            '  "$payload": {',
            '    "message": "boom",',
            '    "name": "Error",',
            '    "stack": [',
            '      { "column": 28, "functionName": "Object.<anonymous>", "line": 461, "source": "/workspace/tests/terminal/pipeline/4-rendering/renderers/json/renderer.test.ts", "type": "file" },',
            '      { "column": 28, "functionName": "Promise.finally.completed", "line": 1557, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 10, "functionName": "callAsyncCircusFn", "line": 1497, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 40, "functionName": "_callCircusTest", "line": 1007, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 3, "functionName": "_runTest", "line": 947, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 7, "line": 849, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 11, "functionName": "_runTestsForDescribeBlock", "line": 862, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 11, "functionName": "_runTestsForDescribeBlock", "line": 857, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 3, "functionName": "run", "line": 761, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 21, "functionName": "runAndTransformResultsToJestFormat", "line": 1918, "source": "/workspace/node_modules/jest-circus/build/jestAdapterInit.js", "type": "file" },',
            '      { "column": 19, "functionName": "jestAdapter", "line": 101, "source": "/workspace/node_modules/jest-circus/build/runner.js", "type": "file" },',
            '      { "column": 16, "functionName": "runTestInternal", "line": 275, "source": "/workspace/node_modules/jest-runner/build/index.js", "type": "file" },',
            '      { "column": 7, "functionName": "runTest", "line": 343, "source": "/workspace/node_modules/jest-runner/build/index.js", "type": "file" }',
            '    ]',
            '  },',
            '}'
        ]

        const lines = out.split("\n");
        expect(lines.slice(2, 7)).toEqual(expectedParts.slice(2, 7));

        const l2 = lines[1];
        const prop = l2.substring(0, 13);
        const code = l2.split("").slice(13, -2).join("");

        expect(prop).toBe('  "$codec": "');
        expect(code).toMatch(/zexi@[0-9].[0-9]/);
    });

    it("renders regex envelopes correctly", () => {
        const out = render(/abc/gi, { mode: "pretty" });

        const expectedParts = [
            '{',
            `  "$codec": "zexi@${stableVersion}",`,
            '  "$kind": "regex",',
            '  "$payload": { "flags": "gi", "pattern": "abc" }',
            '}'
        ]

        const lines = out.split("\n");
        expect(lines.slice(2)).toEqual(expectedParts.slice(2));

        const l2 = lines[1];
        const prop = l2.substring(0, 13);
        const code = l2.split("").slice(13, -2).join("");

        expect(prop).toBe('  "$codec": "');
        expect(code).toMatch(/zexi@[0-9].[0-9]/);
    });
});

/* ------------------------------------------------------------------ */
/* PRETTY MODE - DETERMINISM                                          */
/* ------------------------------------------------------------------ */

describe("JSONRenderer - pretty determinism", () => {
    it("produces identical output across repeated renders", () => {
        const value = {
            alpha: [1, 2, 3],
            beta: {
                gamma: true
            }
        };

        expect(
            render(value, { mode: "pretty" })
        ).toBe(
            render(value, { mode: "pretty" })
        );
    });

    it("produces structurally valid output", () => {
        const out = render(
            {
                a: [1, 2],
                b: { c: 3 }
            },
            {
                mode: "pretty"
            }
        );

        const expectedParts = [
            '{',
            '  "a": [1, 2],',
            '  "b": { "c": 3 }',
            '}'
        ]

        const lines = out.split("\n");
        expect(lines).toEqual(expectedParts);
    });
});