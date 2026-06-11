import GraphBuilder from "../../../../src/core/terminal/pipeline/1-graphing/builder";
import GRAPH_NODES from "../../../../src/core/terminal/pipeline/1-graphing/nodes";

import CircularReferenceError from "../../../../src/core/terminal/pipeline/1-graphing/identity/circular.error";

const throwConfig = {
    cycles: 'throw' as const,
    references: 'inline' as const
};

const ignoreConfig = {
    cycles: 'ignore' as const,
    references: 'inline' as const
};

const markConfig = {
    cycles: 'mark' as const,
    references: 'inline' as const
};

/* ------------------------------------------------------------------ */
/* PRIMITIVES */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (primitives)", () => {

    it("handles string", () => {
        const node = GraphBuilder.build("hello", throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("string");
        expect(node.value).toBe("hello");
    });

    it("handles number", () => {
        const node = GraphBuilder.build(123, throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("number");
        expect(node.value).toBe(123);
    });

    it("handles boolean", () => {
        const node = GraphBuilder.build(true, throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("boolean");
        expect(node.value).toBe(true);
    });

    it("handles null", () => {
        const node = GraphBuilder.build(null, throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("null");
        expect(node.value).toBe(null);
    });

    it("handles undefined", () => {
        const node = GraphBuilder.build(undefined, throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("undefined");
        expect(node.value).toBe(undefined);
    });

    it("handles symbol", () => {
        const s = Symbol("x");
        const node = GraphBuilder.build(s, throwConfig) as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(node.type).toBe("symbol");
        expect(node.value).toBe(s);
    });

});

/* ------------------------------------------------------------------ */
/* ARRAY */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (arrays)", () => {

    it("builds array structure", () => {
        const node = GraphBuilder.build([1, "x", true], throwConfig) as any;

        expect(node).toBeInstanceOf(GRAPH_NODES.Array);
        expect(node.value.length).toBe(3);

        const firstNode = node.value[0] as InstanceType<typeof GRAPH_NODES.Primitive>;
        const secondNode = node.value[1] as InstanceType<typeof GRAPH_NODES.Primitive>;
        const thirdNode = node.value[2] as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(firstNode).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(firstNode.type).toBe("number");
        expect(firstNode.value).toBe(1);

        expect(secondNode).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(secondNode.type).toBe("string");
        expect(secondNode.value).toBe("x");

        expect(thirdNode).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(thirdNode.type).toBe("boolean");
        expect(thirdNode.value).toBe(true);
    });

    it("preserves nested arrays", () => {
        const node = GraphBuilder.build([[1, 2]], throwConfig) as InstanceType<typeof GRAPH_NODES.Array>;

        expect(node.type).toBe("array");
        expect(node.value.length).toBe(1);
        expect(node.value[0]).toBeInstanceOf(GRAPH_NODES.Array);

        const child = node.value[0] as InstanceType<typeof GRAPH_NODES.Array>;
        const firstNode = child.value[0] as InstanceType<typeof GRAPH_NODES.Primitive>;
        const secondNode = child.value[1] as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(firstNode).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(firstNode.type).toBe("number");
        expect(firstNode.value).toBe(1);

        expect(secondNode).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(secondNode.type).toBe("number");
        expect(secondNode.value).toBe(2);
    });

});

/* ------------------------------------------------------------------ */
/* SET */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (set)", () => {

    it("builds set node", () => {
        const node = GraphBuilder.build(new Set([1, 2, 3]), throwConfig) as InstanceType<typeof GRAPH_NODES.Set>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Set);
        expect(node.size).toBe(3);

        const items = [...node.value] as InstanceType<typeof GRAPH_NODES.Primitive>[];

        expect(items[0]).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(items[0].type).toBe("number");
        expect(items[0].value).toBe(1);

        expect(items[1]).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(items[1].type).toBe("number");
        expect(items[1].value).toBe(2);

        expect(items[2]).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(items[2].type).toBe("number");
        expect(items[2].value).toBe(3);
    });

});

/* ------------------------------------------------------------------ */
/* MAP */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (map)", () => {

    it("builds map node", () => {
        const node = GraphBuilder.build(new Map([["a", 1]]), throwConfig) as InstanceType<typeof GRAPH_NODES.Map>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Map);
        expect(node.type).toBe("map");
        expect(node.size).toBe(1);

        const entry = [...node.value][0];
        const key = entry[0] as InstanceType<typeof GRAPH_NODES.Primitive>;
        const value = entry[1] as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(key).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(key.type).toBe("string");
        expect(key.value).toBe("a");

        expect(value).toBeInstanceOf(GRAPH_NODES.Primitive);
        expect(value.type).toBe("number");
        expect(value.value).toBe(1);
    });

    it("recursively graphs keys and values", () => {
        class User {
            get id() { return 1; }
            set id(id: number) { }
            remind() { }
            readonly name = "Ahmad";
        };

        const record = {
            get id() { return 1; },
            set id(id: number) { },
            remind() { },
            name: "Omar"
        }

        const node = GraphBuilder.build(
            new Map([[record, new User]]),
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Map>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Map);
        expect(node.size).toBe(1);

        const entry = [...node.value.entries()][0] as [
            InstanceType<typeof GRAPH_NODES.Object>,
            InstanceType<typeof GRAPH_NODES.Object>
        ];

        expect(entry).toBeDefined();
        const mapKey = entry[0] as InstanceType<typeof GRAPH_NODES.Object>;
        const mapValue = entry[1] as InstanceType<typeof GRAPH_NODES.Object>;

        {
            expect(mapKey).toBeInstanceOf(GRAPH_NODES.Object);
            expect(mapKey.type).toBe("record");
            expect(mapKey.className).toBe('Record');

            const recEntries = [...mapKey.data];

            {
                const [prop, v] = recEntries[0];
                expect(prop.kind).toBe('getter');
                expect(prop.name).toBe('id');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }

            {
                const [prop, v] = recEntries[1];
                expect(prop.kind).toBe('setter');
                expect(prop.name).toBe('id');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }

            {
                const [prop, v] = recEntries[2];
                expect(prop.kind).toBe('method');
                expect(prop.name).toBe('remind');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }

            {
                const [prop, v] = recEntries[3];
                expect(prop.kind).toBe('property');
                expect(prop.name).toBe('name');

                const value = v as InstanceType<typeof GRAPH_NODES.Primitive>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Primitive);
                expect(value.type).toBe("string");
                expect(value.value).toBe("Omar");
            }
        }

        {
            expect(entry[1]).toBeInstanceOf(GRAPH_NODES.Object);
            expect(entry[1].type).toBe("object");
            expect(entry[1].className).toBe('User');

            const recEntries = [...entry[1].data];

            {
                /*
                 * NOTE:
                 * Object literals and class instances expose members differently at runtime.
                 *
                 * Object literals store properties, methods, getters, and setters directly
                 * on the object itself, so `Object.getOwnPropertyDescriptors()` preserves
                 * declaration order for all members.
                 *
                 * Class instances only store instance fields as own properties. Methods,
                 * getters, and setters are stored on the prototype instead. This means
                 * runtime reflection observes:
                 *
                 *   1. instance fields first
                 *   2. prototype members afterward
                 *
                 * even if the original class declaration mixed them together.
                 *
                 * Because of this prototype separation, JavaScript reflection cannot
                 * reliably reconstruct the original source declaration order of class
                 * members.
                 */
                const [prop, v] = recEntries[0];
                expect(prop.kind).toBe('property');
                expect(prop.name).toBe('name');

                const value = v as InstanceType<typeof GRAPH_NODES.Primitive>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Primitive);
                expect(value.type).toBe("string");
                expect(value.value).toBe("Ahmad");
            }

            {
                const [prop, v] = recEntries[1];
                expect(prop.kind).toBe('getter');
                expect(prop.name).toBe('id');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }

            {
                const [prop, v] = recEntries[2];
                expect(prop.kind).toBe('setter');
                expect(prop.name).toBe('id');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }

            {
                const [prop, v] = recEntries[3];
                expect(prop.kind).toBe('method');
                expect(prop.name).toBe('remind');

                const value = v as InstanceType<typeof GRAPH_NODES.Function>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Function);
                expect(value.type).toBe("function");
            }
        }
    });

});

/* ------------------------------------------------------------------ */
/* SPECIAL NODES */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (special objects)", () => {
    it("Date", () => {
        const date = new Date();
        const node = GraphBuilder.build(date, throwConfig) as InstanceType<typeof GRAPH_NODES.Date>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Date);
        expect(node.type).toBe("date");
        expect(node.value).not.toBe(date);
        expect(node.value.getTime()).toBe(date.getTime());
        expect(node.value).toEqual(date);
    });

    it("RegExp", () => {
        const node = GraphBuilder.build(/abc/, throwConfig);

        expect(node).toBeInstanceOf(GRAPH_NODES.RegExp);
        expect(node.type).toBe("regex");
    });

    it("Error", () => {
        {
            const node = GraphBuilder.build(new Error("x"), throwConfig) as InstanceType<typeof GRAPH_NODES.Error>;

            expect(node).toBeInstanceOf(GRAPH_NODES.Error);
            expect(node.type).toBe("error");

            expect(node.data).toBeDefined();
            expect(node.data.message).toBe("x");
            expect(node.data.name).toBe("Error");
            expect(node.data.cause).toBeUndefined();
        }

        {
            const originalError = new TypeError('Cannot read property "x" of undefined');
            const error = new SyntaxError('Something went wrong', { cause: originalError });

            const node = GraphBuilder.build(error, throwConfig) as InstanceType<typeof GRAPH_NODES.Error>;

            expect(node.type).toBe("error");
            expect(node.data.name).toBe("SyntaxError");
            expect(node.data.message).toBe("Something went wrong");
            expect(node.data.cause).toBeInstanceOf(GRAPH_NODES.Error);

            const cause = node.data.cause as InstanceType<typeof GRAPH_NODES.Error>;
            expect(cause.type).toBe("error");
            expect(cause.data.name).toBe("TypeError");
            expect(cause.data.message).toBe("Cannot read property \"x\" of undefined");
            expect(cause.data.cause).toBeUndefined();
        }
    });

    it("Function", () => {
        const node = GraphBuilder.build(() => { }, throwConfig);

        expect(node).toBeInstanceOf(GRAPH_NODES.Function);
        expect(node.type).toBe("function");
    });

});

/* ------------------------------------------------------------------ */
/* OBJECTS + PROTOTYPES */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (objects)", () => {

    it("builds object graph", () => {
        const node = GraphBuilder.build(
            { a: 1, b: 2 },
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Object>;

        expect(node).toBeInstanceOf(GRAPH_NODES.Object);
        expect(node.type).toBe("record");
    });

    it("extracts methods", () => {
        class A {
            doSomething() { }
        }

        const node = GraphBuilder.build(new A(), throwConfig) as InstanceType<typeof GRAPH_NODES.Object>;

        const keys = [...node.data].map(i => i[0]);
        const method = keys[0];

        expect(method).toBeDefined();
        expect(method.kind).toBe("method");
        expect(method.name).toBe("doSomething");
    });

    it("extracts getters/setters", () => {
        class A {
            get x() { return 1; }
            set y(v: number) { }
        }

        const node = GraphBuilder.build(new A(), throwConfig) as InstanceType<typeof GRAPH_NODES.Object>;

        const keys = [...node.data].map(i => i[0]);
        const getter = keys[0];
        const setter = keys[1];

        expect(getter.kind).toBe("getter");
        expect(getter.name).toBe("x");

        expect(setter.kind).toBe("setter");
        expect(setter.name).toBe("y");
    });

});

/* ------------------------------------------------------------------ */
/* IDENTITY (CRITICAL) */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (identity)", () => {

    it("preserves shared object identity", () => {
        const shared = { x: 1 };

        const node = GraphBuilder.build(
            { a: shared, b: shared },
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Object>;

        const values = [...node.data].map(i => i[1] as InstanceType<typeof GRAPH_NODES.Object>);
        expect(values[0]).toBe(values[1]);
    });

    it("preserves shared array identity", () => {
        const shared = [1, 2];

        const node = GraphBuilder.build(
            { a: shared, b: shared },
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Object>;

        const values = [...node.data].map(i => i[1] as InstanceType<typeof GRAPH_NODES.Array>);
        expect(values[0]).toBe(values[1]);
    });

    it("preserves shared map identity", () => {
        const shared = new Map([[1, 2]]);

        const node = GraphBuilder.build(
            { a: shared, b: shared },
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Object>;

        const values = [...node.data].map(i => i[1] as InstanceType<typeof GRAPH_NODES.Map>);
        expect(values[0]).toBe(values[1]);
    });

    it("preserves shared set identity", () => {
        const shared = new Set([1, 2]);

        const node = GraphBuilder.build(
            { a: shared, b: shared },
            throwConfig
        ) as InstanceType<typeof GRAPH_NODES.Object>;

        const values = [...node.data].map(i => i[1] as InstanceType<typeof GRAPH_NODES.Set>);
        expect(values[0]).toBe(values[1]);
    });

});

/* ------------------------------------------------------------------ */
/* CYCLES */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (cycles)", () => {

    it("throw mode", () => {
        const obj: any = {};
        obj.self = obj;

        expect(() =>
            GraphBuilder.build(obj, throwConfig)
        ).toThrow(CircularReferenceError);
    });

    it("ignore mode replaces circular with null", () => {
        const obj: any = {};
        obj.self = obj;

        const node = GraphBuilder.build(obj, ignoreConfig) as InstanceType<typeof GRAPH_NODES.Object>;
        const entries = [...node.data];

        const selfValue = entries.find(i => i[0].kind === 'property' && i[0].name === 'self')![1] as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(selfValue.type).toBe("null");
        expect(selfValue.value).toBeNull();
    });

    it("mark mode annotates circular reference", () => {
        const obj: any = {};
        obj.self = obj;

        const node = GraphBuilder.build(obj, markConfig) as InstanceType<typeof GRAPH_NODES.Object>;
        const entries = [...node.data];

        const selfValue = entries.find(i => i[0].kind === 'property' && i[0].name === 'self')![1] as InstanceType<typeof GRAPH_NODES.Primitive>;

        expect(selfValue.type).toBe("string");
        expect(selfValue.value).toContain("Circular:");
        expect(selfValue.value).toBe("[Circular:Record:1]");
    });

});

/* ------------------------------------------------------------------ */
/* MIXED STRUCTURES */
/* ------------------------------------------------------------------ */

describe("GraphBuilder (complex structures)", () => {

    it("handles deeply nested mixed input", () => {
        const input = {
            user: {
                tags: ["a", "b"],
                meta: new Map([["active", true]]),
                created: new Date()
            }
        };

        const refs: Partial<{
            input: InstanceType<typeof GRAPH_NODES.Object>;
            user: InstanceType<typeof GRAPH_NODES.Object>;
            tags: InstanceType<typeof GRAPH_NODES.Array>;
            meta: InstanceType<typeof GRAPH_NODES.Map>;
            created: InstanceType<typeof GRAPH_NODES.Date>;
        }> = {};

        // Process "input"
        {
            refs.input = GraphBuilder.build(input, throwConfig) as InstanceType<typeof GRAPH_NODES.Object>;
            expect(refs.input).toBeInstanceOf(GRAPH_NODES.Object);

            const inputEntries = [...refs.input.data];
            const entry = inputEntries[0];

            const prop = entry[0];
            expect(prop.kind).toBe("property");
            expect(prop.name).toBe("user");

            const value = entry[1] as InstanceType<typeof GRAPH_NODES.Object>;
            expect(value).toBeInstanceOf(GRAPH_NODES.Object);
            refs.user = value;
        }

        // Process "input.user"
        {
            const userEntries = [...refs.user.data];

            {
                const tagsEntry = userEntries[0];

                const prop = tagsEntry[0];
                expect(prop.kind).toBe("property");
                expect(prop.name).toBe("tags");

                const value = tagsEntry[1] as InstanceType<typeof GRAPH_NODES.Array>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Array);
                expect(value.type).toBe("array");

                refs.tags = value;
            }


            {
                const metaEntry = userEntries[1];

                const prop = metaEntry[0];
                expect(prop.kind).toBe("property");
                expect(prop.name).toBe("meta");

                const value = metaEntry[1] as InstanceType<typeof GRAPH_NODES.Map>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Map);
                expect(value.type).toBe("map");

                refs.meta = value;
            }

            {
                const createdEntry = userEntries[2];

                const prop = createdEntry[0];
                expect(prop.kind).toBe("property");
                expect(prop.name).toBe("created");

                const value = createdEntry[1] as InstanceType<typeof GRAPH_NODES.Date>;
                expect(value).toBeInstanceOf(GRAPH_NODES.Date);
                expect(value.type).toBe("date");

                refs.created = value;
            }
        }

        // Process "input.user.tags"
        {
            const tagsItems = [...refs.tags.value] as InstanceType<typeof GRAPH_NODES.Primitive>[];

            const firstTag = tagsItems[0];
            expect(firstTag).toBeInstanceOf(GRAPH_NODES.Primitive);
            expect(firstTag.type).toBe("string");
            expect(firstTag.value).toBe("a");

            const secondTag = tagsItems[1];
            expect(secondTag).toBeInstanceOf(GRAPH_NODES.Primitive);
            expect(secondTag.type).toBe("string");
            expect(secondTag.value).toBe("b");
        }

        // Process "input.user.meta"
        {
            const metaEntries = [...refs.meta.value] as InstanceType<typeof GRAPH_NODES.Primitive>[][];
            const entry = metaEntries[0];

            const key = entry[0] as InstanceType<typeof GRAPH_NODES.Primitive>;
            expect(key).toBeInstanceOf(GRAPH_NODES.Primitive);
            expect(key.type).toBe("string");
            expect(key.value).toBe("active");

            const value = entry[1] as InstanceType<typeof GRAPH_NODES.Primitive>;
            expect(value).toBeInstanceOf(GRAPH_NODES.Primitive);
            expect(value.type).toBe("boolean");
            expect(value.value).toBe(true);
        }

    });

    it("maintains identity in deep structures", () => {
        class A { }
        const shared = new A();

        const input = {
            a: shared,
            b: { inner: shared }
        };

        const node = GraphBuilder.build(input, throwConfig) as InstanceType<typeof GRAPH_NODES.Object>;
        const a = [...node.data][0][1] as InstanceType<typeof GRAPH_NODES.Object>;

        expect(a).toBeInstanceOf(GRAPH_NODES.Object);
        expect(a.className).toBe("A");

        const nested = [...node.data][1][1] as InstanceType<typeof GRAPH_NODES.Object>;
        const b = [...nested.data][0][1] as InstanceType<typeof GRAPH_NODES.Object>;

        expect(b).toBeInstanceOf(GRAPH_NODES.Object);
        expect(b.className).toBe("A");

        expect(a).toBe(b);
    });

});