import ScreenCell from "../../../src/core/terminal/screen/cell";

const noop = () => {};

describe("ScreenCell", () => {
    describe("construction", () => {
        it("creates empty cell when no options are provided", () => {
            const cell = new ScreenCell(noop, undefined as any);

            expect(cell.value).toBe("");
            expect(cell.final).toBe(false);
            expect(cell.height).toBe(0);
        });

        it("creates cell with direct string value", () => {
            const cell = new ScreenCell(noop, {
                value: "Hello"
            });

            expect(cell.value).toBe("Hello");
            expect(cell.height).toBe(1);
        });

        it("creates cell with template and params-ready state", () => {
            const cell = new ScreenCell(noop, {
                value: { name: "World" },
                template: "Hello ${name}"
            });

            expect(cell.value).toBe("Hello World");
        });

        it("throws if object value is used without template", () => {
            expect(() => {
                new ScreenCell(noop, {
                    value: { a: 1 }
                } as any);
            }).toThrow();
        });
    });

    describe("direct updates", () => {
        it("overrides value without touching template", () => {
            const cell = new ScreenCell(noop, {
                value: "A",
                template: "Hello ${x}"
            });

            cell.update("B");

            expect(cell.value).toBe("B");
            expect(cell.template).toBe("Hello ${x}");
        });

        it("resets params only in direct mode", () => {
            const cell = new ScreenCell(noop, {
                value: { x: 1 },
                template: "X=${x}"
            });

            cell.update("plain text");

            expect(cell.value).toBe("plain text");
        });
    });

    describe("template rendering", () => {
        it("renders template with parameters", () => {
            const cell = new ScreenCell(noop, {
                value: { name: "AI" },
                template: "Hello ${name}"
            });

            expect(cell.value).toBe("Hello AI");
        });

        it("supports multiple params", () => {
            const cell = new ScreenCell(noop, {
                value: { a: 1, b: 2 },
                template: "${a}+${b}"
            });

            expect(cell.value).toBe("1+2");
        });

        it("supports incremental updates (patch mode)", () => {
            const cell = new ScreenCell(noop, {
                value: { x: 1, y: 2 },
                template: "${x}-${y}"
            });

            cell.update({ x: 10 }, { patch: true });

            expect(cell.value).toBe("10-2");
        });

        it("replaces all params when patch is false", () => {
            const cell = new ScreenCell(noop, {
                value: { x: 1, y: 2 },
                template: "${x}-${y}"
            });

            expect(cell.value).toBe("1-2");
            
            cell.update({ x: 9 }, { patch: false });

            expect(cell.value).toBe("9-${y}");
        });
    });

    describe("template lifecycle", () => {
        it("clears params when template changes", () => {
            const cell = new ScreenCell(noop, {
                value: { x: 1 },
                template: "${x}"
            });

            cell.template = "${x}${y}";

            expect(cell.params).toEqual({});
        });

        it("prevents template modification after finalization", () => {
            const cell = new ScreenCell(noop, {
                value: "A",
                template: "X"
            });

            cell.finalize();

            expect(() => {
                cell.template = "Y";
            }).toThrow();
        });
    });

    describe("height calculation", () => {
        it("counts single line correctly", () => {
            const cell = new ScreenCell(noop, {
                value: "Hello"
            });

            expect(cell.height).toBe(1);
        });

        it("counts multiple lines correctly", () => {
            const cell = new ScreenCell(noop, {
                value: "A\nB\nC"
            });

            expect(cell.height).toBe(3);
        });

        it("counts trailing newlines as empty lines", () => {
            const cell = new ScreenCell(noop, {
                value: "A\n\n"
            });

            expect(cell.height).toBe(3);
        });
    });

    describe("finalization", () => {
        it("prevents updates after finalize", () => {
            const cell = new ScreenCell(noop, {
                value: "A"
            });

            cell.finalize();

            expect(() => {
                cell.update("B");
            }).toThrow();
        });

        it("does nothing if finalize is called twice", () => {
            const cell = new ScreenCell(noop, {
                value: "A"
            });

            cell.finalize();
            cell.finalize();

            expect(cell.final).toBe(true);
        });
    });

    describe("params exposure", () => {
        it("returns immutable params snapshot", () => {
            const cell = new ScreenCell(noop, {
                value: { x: 1 },
                template: "${x}"
            });

            const params = cell.params;

            expect(() => {
                (params as any).x = 999;
            }).toThrow();
        });
    });
});