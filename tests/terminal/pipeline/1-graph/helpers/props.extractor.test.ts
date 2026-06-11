import PropsExtractor from "../../../../../src/core/terminal/pipeline/1-graphing/helpers/props.extractor";

describe("PropsExtractor", () => {
    it("should be defined", () => {
        expect(PropsExtractor).toBeDefined();
    });

    it("should extract plain properties and function-valued properties correctly", () => {
        const obj = {
            field: "Ahmad",
            fn1: () => { },
            fn2: function () { },
            fn3: function x() { },
            method() { }
        };

        const props = PropsExtractor.extract(obj);

        expect(props).toEqual([
            { name: "field", kind: "property", value: "Ahmad" },
            { name: "fn1", kind: "property", value: obj.fn1 },
            { name: "fn2", kind: "property", value: obj.fn2 },
            { name: "fn3", kind: "property", value: obj.fn3 },
            { name: "method", kind: "method", value: obj.method }
        ]);
    });

    it("should extract getters and setters correctly", () => {
        const obj = {
            _x: 1,
            get x() {
                return this._x;
            },
            set x(v: number) {
                this._x = v;
            }
        };

        const props = PropsExtractor.extract(obj);

        expect(props).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: "x",
                    kind: "getter",
                    // @ts-ignore
                    value: obj.__lookupGetter__("x")
                }),
                expect.objectContaining({
                    name: "x",
                    kind: "setter",
                    // @ts-ignore
                    value: obj.__lookupSetter__("x")
                }),
                expect.objectContaining({
                    name: "_x",
                    kind: "property",
                    value: 1
                })
            ])
        );
    });

    it("should include inherited prototype properties", () => {
        class Base {
            baseField = 1;
            baseMethod() { }
        }

        class Child extends Base {
            childField = 2;
            childMethod() { }
        }

        const obj = new Child();
        const props = PropsExtractor.extract(obj);

        const names = props.map(p => p.name);

        expect(names).toContain("childField");
        expect(names).toContain("baseField");
        expect(names).toContain("childMethod");
        expect(names).toContain("baseMethod");
    });

    it("should NOT duplicate shadowed prototype properties", () => {
        class Base {
            value = "base";
        }

        class Child extends Base {
            override value = "child";
        }

        const obj = new Child();
        const props = PropsExtractor.extract(obj);

        const values = props.filter(p => p.name === "value");

        expect(values.length).toBe(1);
        expect(values[0].value).toBe("child");
    });

    it("should stop before Object.prototype", () => {
        const obj = {};
        const props = PropsExtractor.extract(obj);

        const names = props.map(p => p.name);

        expect(names).not.toContain("toString");
        expect(names).not.toContain("hasOwnProperty");
    });

    it("should support symbol properties", () => {
        const sym = Symbol("test");

        const obj = {
            [sym]: 123
        };

        const props = PropsExtractor.extract(obj);

        expect(props.some(p => p.name.includes("Symbol(test)"))).toBe(true);
    });

    it("should deduplicate across prototype chain", () => {
        class A {
            shared = 1;
        }

        class B extends A {
            override shared = 2;
        }

        const obj = new B();
        const props = PropsExtractor.extract(obj);

        const sharedProps = props.filter(p => p.name === "shared");

        expect(sharedProps.length).toBe(1);
        expect(sharedProps[0].value).toBe(2);
    });

    it("should classify object-literal method syntax as method", () => {
        const obj = {
            foo() { },
            bar: function () { }
        };

        const props = PropsExtractor.extract(obj);

        const foo = props.find(p => p.name === "foo");
        const bar = props.find(p => p.name === "bar");

        expect(foo?.kind).toBe("method");
        expect(bar?.kind).toBe("property");
    });

    it("should respect canonical sorting", () => {
        const obj = {
            z: 1,
            a: 2,
            m: 3
        };

        const props = PropsExtractor.extract(obj, { canonical: true });

        const names = props.map(p => p.name);

        expect(names).toEqual(["a", "m", "z"]);
    });

    it("should handle null-prototype objects", () => {
        const obj = Object.create(null);
        obj.a = 1;
        obj.b = 2;

        const props = PropsExtractor.extract(obj);

        expect(props.map(p => p.name)).toEqual(
            expect.arrayContaining(["a", "b"])
        );
    });

    it("should correctly handle mixed prototype + own property overrides", () => {
        class Base {
            value = "base";
        }

        class Mid extends Base {
            override value = "mid";
        }

        class Child extends Mid {
            override value = "child";
        }

        const obj = new Child();
        const props = PropsExtractor.extract(obj);

        const valueProps = props.filter(p => p.name === "value");

        expect(valueProps.length).toBe(1);
        expect(valueProps[0].value).toBe("child");
    });
});