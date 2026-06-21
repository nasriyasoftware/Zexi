import type { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import JSONTokenizer from "../../../../../../../src/core/terminal/pipeline/4-rendering/renderers/json/helpers/tokenizer";
import _rendering from "../../../helpers/helpers";

describe("JSONTokenizer - canonical object serialization", () => {

    /* -------------------------------------------------------- */
    /* 1. OBJECT LITERALS                                       */
    /* -------------------------------------------------------- */

    it("tokenizes object literals in canonical key order", () => {
        const tokens = JSONTokenizer({ b: 2, a: 1 });

        const kinds = _rendering.extractKinds(tokens);

        expect(kinds).toEqual([
            "group-start",
            "object-name",
            "object-open",
            "soft-line",
            "indent-start",

            "group-start",
            "property",
            "key-value-separator",
            "soft-space",
            "primitive",
            "separator",
            "soft-line",
            "group-end",

            "group-start",
            "property",
            "key-value-separator",
            "soft-space",
            "primitive",
            "group-end",

            "indent-end",
            "soft-line",
            "object-close",
            "group-end"
        ]);

        const props = tokens.filter(t => t.kind === "property");

        expect(props.map(p => (p as any).value)).toEqual(["a", "b"]);

        const values = tokens.filter(t => t.kind === "primitive");

        expect(values.map(v => (v as any).value)).toEqual([1, 2]);
    });


    /* -------------------------------------------------------- */
    /* 2. CLASS INSTANCES (OWN PROPERTIES ONLY)                */
    /* -------------------------------------------------------- */

    class User {
        name = "z";
        age = 30;
    }

    it("tokenizes class instances using own enumerable properties only", () => {
        const tokens = JSONTokenizer(new User());

        const props = tokens.filter(t => t.kind === "property");

        expect(props.map(p => (p as any).value)).toEqual(["age", "name"]);
    });


    /* -------------------------------------------------------- */
    /* 3. INHERITED PROPERTIES                                 */
    /* -------------------------------------------------------- */

    it("includes inherited class properties (excluding Object base)", () => {
        class Base {
            base = 1;
        }

        class Child extends Base {
            child = 2;
        }

        const tokens = JSONTokenizer(new Child());

        const props = tokens.filter(t => t.kind === "property");

        expect(props.map(p => (p as any).value)).toEqual([
            "base",
            "child"
        ]);
    });


    /* -------------------------------------------------------- */
    /* 4. ORDER STABILITY FOR INSTANCES                        */
    /* -------------------------------------------------------- */

    it("preserves canonical ordering for class instances", () => {
        class X {
            z = 3;
            a = 1;
            m = 2;
        }

        const tokens = JSONTokenizer(new X());

        const props = tokens.filter(t => t.kind === "property");

        expect(props.map(p => (p as any).value)).toEqual(["a", "m", "z"]);
    });

});