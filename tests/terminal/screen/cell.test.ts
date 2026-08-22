import ScreenCell from "../../../src/core/terminal/screen/cell";
import type { ScreenCellEngineEvents } from "../../../src/core/terminal/screen/types";

const createEvents = (): ScreenCellEngineEvents => ({
    onUpdate: () => { },
    onRemove: () => { }
});

describe("ScreenCell", () => {
    describe("construction", () => {
        it("creates an empty cell when no options are provided", () => {
            const cell = new ScreenCell(createEvents());

            expect(cell.value).toBe("");
            expect(cell.final).toBe(false);
            expect(cell.height).toBe(0);
            expect(cell.template).toBeUndefined();
            expect(cell.params).toEqual({});
        });

        it("creates a cell with a direct string value", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(cell.value).toBe("Hello");
            expect(cell.height).toBe(1);
            expect(cell.final).toBe(false);
        });

        it("creates a cell with a direct value and template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello",
                template: "Hello ${name}"
            });

            expect(cell.value).toBe("Hello");
            expect(cell.template).toBe("Hello ${name}");
            expect(cell.params).toEqual({});
        });

        it("creates a cell with template parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: { name: "World" },
                template: "Hello ${name}"
            });

            expect(cell.value).toBe("Hello World");
            expect(cell.template).toBe("Hello ${name}");
            expect(cell.params).toEqual({ name: "World" });
        });

        it("creates a finalized cell when final is true", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Done",
                final: true
            });

            expect(cell.value).toBe("Done");
            expect(cell.final).toBe(true);

            expect(() => {
                cell.update("Changed");
            }).toThrow();
        });

        it("does not emit update events during construction", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            new ScreenCell(events, {
                value: "Hello"
            });

            expect(updateCount).toBe(0);
        });
    });

    describe("construction validation", () => {
        it("throws when events is not an object", () => {
            expect(() => {
                new ScreenCell(null as any);
            }).toThrow(
                "Expected `events` to be an object"
            );
        });

        it("throws when events.onUpdate is missing", () => {
            expect(() => {
                new ScreenCell({
                    onRemove: () => { }
                } as any);
            }).toThrow(
                "Expected `events.onUpdate` to be a function"
            );
        });

        it("throws when events.onUpdate is not a function", () => {
            expect(() => {
                new ScreenCell({
                    onUpdate: null,
                    onRemove: () => { }
                } as any);
            }).toThrow(
                "Expected `events.onUpdate` to be a function"
            );
        });

        it("throws when events.onRemove is missing", () => {
            expect(() => {
                new ScreenCell({
                    onUpdate: () => { }
                } as any);
            }).toThrow(
                "Expected `events.onRemove` to be a function"
            );
        });

        it("throws when events.onRemove is not a function", () => {
            expect(() => {
                new ScreenCell({
                    onUpdate: () => { },
                    onRemove: null
                } as any);
            }).toThrow(
                "Expected `events.onRemove` to be a function"
            );
        });

        it("throws when options are not an object", () => {
            expect(() => {
                new ScreenCell(createEvents(), "invalid" as any);
            }).toThrow(
                "Terminal entry options (when provided) must be an object"
            );
        });

        it("throws when final is not a boolean", () => {
            expect(() => {
                new ScreenCell(createEvents(), {
                    value: "Hello",
                    final: "true"
                } as any);
            }).toThrow(
                "Terminal entry options.final must be a boolean"
            );
        });

        it("throws when value is not a string", () => {
            expect(() => {
                new ScreenCell(createEvents(), {
                    value: 123
                } as any);
            }).toThrow(
                "Terminal entry options.value must be a string"
            );
        });

        it("throws when template is not a string", () => {
            expect(() => {
                new ScreenCell(createEvents(), {
                    value: "Hello",
                    template: 123
                } as any);
            }).toThrow(
                "Terminal entry options.template must be a string"
            );
        });

        it("throws when params are not an object", () => {
            expect(() => {
                new ScreenCell(createEvents(), {
                    params: "invalid",
                    template: "${value}"
                } as any);
            }).toThrow(
                "Terminal entry options.params must be an object"
            );
        });

        it("throws when params are provided without a template", () => {
            expect(() => {
                new ScreenCell(createEvents(), {
                    params: { value: 1 }
                } as any);
            }).toThrow(
                "Terminal entry template is required when creating with parameters object"
            );
        });

        it("throws when neither value nor params is provided", () => {
            expect(() => {
                new ScreenCell(createEvents(), {} as any);
            }).toThrow(
                "Terminal entry requires either a string `value` or a `params` object to be provided"
            );
        });
    });

    describe("direct updates", () => {
        it("replaces the current rendered value", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.update("B");

            expect(cell.value).toBe("B");
        });

        it("preserves the active template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A",
                template: "Hello ${name}"
            });

            cell.update("B");

            expect(cell.template).toBe("Hello ${name}");
        });

        it("preserves stored template parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: { name: "World" },
                template: "Hello ${name}"
            });

            cell.update("Plain text");

            expect(cell.params).toEqual({ name: "World" });
            expect(cell.template).toBe("Hello ${name}");
        });

        it("allows template rendering to resume after a direct update", () => {
            const cell = new ScreenCell(createEvents(), {
                params: { name: "World" },
                template: "Hello ${name}"
            });

            cell.update("Plain text");
            cell.updateParams({ name: "Alice" });

            expect(cell.value).toBe("Hello Alice");
        });

        it("recalculates height after an update", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.update("A\nB\nC");

            expect(cell.height).toBe(3);
        });

        it("finalizes the cell after applying the update when final is true", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.update("B", {
                final: true
            });

            expect(cell.value).toBe("B");
            expect(cell.final).toBe(true);

            expect(() => {
                cell.update("C");
            }).toThrow();
        });
    });

    describe("template rendering", () => {
        it("renders a single parameter", () => {
            const cell = new ScreenCell(createEvents(), {
                params: { name: "Ahmad" },
                template: "Hello ${name}"
            });

            expect(cell.value).toBe("Hello Ahmad");
        });

        it("renders multiple parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    a: 1,
                    b: 2
                },
                template: "${a}+${b}"
            });

            expect(cell.value).toBe("1+2");
        });

        it("replaces every occurrence of a parameter", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    name: "World"
                },
                template: "${name}, ${name}!"
            });

            expect(cell.value).toBe("World, World!");
        });

        it("stringifies parameter values", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    count: 42,
                    enabled: true,
                    value: null
                },
                template: "${count} ${enabled} ${value}"
            });

            expect(cell.value).toBe("42 true null");
        });

        it("supports parameter names containing regular-expression characters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    "a.b": "value"
                },
                template: "${a.b}"
            });

            expect(cell.value).toBe("value");
        });

        it("leaves placeholders without parameters unchanged", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    name: "World"
                },
                template: "${name} ${missing}"
            });

            expect(cell.value).toBe("World ${missing}");
        });
    });

    describe("parameter updates", () => {
        it("updates template parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "Value: ${value}"
            });

            cell.updateParams({
                value: 2
            });

            expect(cell.value).toBe("Value: 2");
            expect(cell.params).toEqual({
                value: 2
            });
        });

        it("merges parameters in patch mode", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1,
                    y: 2
                },
                template: "${x}-${y}"
            });

            cell.updateParams({
                x: 10
            });

            expect(cell.value).toBe("10-2");
            expect(cell.params).toEqual({
                x: 10,
                y: 2
            });
        });

        it("merges parameters when patch is explicitly true", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1,
                    y: 2
                },
                template: "${x}-${y}"
            });

            cell.updateParams(
                { x: 10 },
                { patch: true }
            );

            expect(cell.value).toBe("10-2");
        });

        it("replaces all existing parameters when patch is false", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1,
                    y: 2
                },
                template: "${x}-${y}"
            });

            cell.updateParams(
                { x: 9 },
                { patch: false }
            );

            expect(cell.value).toBe("9-${y}");
            expect(cell.params).toEqual({
                x: 9
            });
        });

        it("recalculates height after rendering parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: "A"
                },
                template: "${value}"
            });

            cell.updateParams({
                value: "A\nB\nC"
            });

            expect(cell.height).toBe(3);
        });

        it("finalizes after applying parameter updates when final is true", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "Value: ${value}"
            });

            cell.updateParams(
                { value: 100 },
                { final: true }
            );

            expect(cell.value).toBe("Value: 100");
            expect(cell.params).toEqual({
                value: 100
            });
            expect(cell.final).toBe(true);

            expect(() => {
                cell.updateParams({ value: 200 });
            }).toThrow();
        });

        it("throws when updating parameters without a template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(() => {
                cell.updateParams({
                    value: "World"
                });
            }).toThrow(
                "Terminal entry template is required when updating with an object"
            );
        });
    });

    describe("template lifecycle", () => {
        it("returns undefined when no template is assigned", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(cell.template).toBeUndefined();
        });

        it("assigns a template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            cell.template = "Value: ${value}";

            expect(cell.template).toBe("Value: ${value}");
        });

        it("clears parameters when a template is assigned", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "Value: ${value}"
            });

            cell.template = "Other: ${value}";

            expect(cell.params).toEqual({});
        });

        it("clears the template and parameters when assigned undefined", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "Value: ${value}"
            });

            cell.template = undefined;

            expect(cell.template).toBeUndefined();
            expect(cell.params).toEqual({});
        });

        it("clears the template and parameters when assigned null", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "Value: ${value}"
            });

            cell.template = null;

            expect(cell.template).toBeUndefined();
            expect(cell.params).toEqual({});
        });

        it("rejects an empty template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(() => {
                cell.template = "";
            }).toThrow(
                "Terminal entry template must not be empty"
            );
        });

        it("rejects a whitespace-only template", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(() => {
                cell.template = "   ";
            }).toThrow(
                "Terminal entry template must not be empty"
            );
        });

        it("rejects non-string template assignments", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(() => {
                cell.template = 123 as any;
            }).toThrow(
                "Terminal entry template must be a string"
            );
        });

        it("rejects template changes after finalization", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            cell.finalize();

            expect(() => {
                cell.template = "Changed";
            }).toThrow(
                "Cannot modify template of a finalized entry"
            );
        });
    });

    describe("height calculation", () => {
        it("reports zero height for an empty cell", () => {
            const cell = new ScreenCell(createEvents());

            expect(cell.height).toBe(0);
        });

        it("counts a single line as one row", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "Hello"
            });

            expect(cell.height).toBe(1);
        });

        it("counts multiple lines correctly", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A\nB\nC"
            });

            expect(cell.height).toBe(3);
        });

        it("counts an empty string as one line when explicitly rendered", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.update("");

            expect(cell.value).toBe("");
            expect(cell.height).toBe(1);
        });

        it("counts trailing newlines as additional rows", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A\n\n"
            });

            expect(cell.height).toBe(3);
        });

        it("counts a value consisting only of newlines correctly", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "\n\n"
            });

            expect(cell.height).toBe(3);
        });
    });

    describe("finalization", () => {
        it("starts as non-finalized", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            expect(cell.final).toBe(false);
        });

        it("finalizes the cell", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.finalize();

            expect(cell.final).toBe(true);
        });

        it("prevents direct updates after finalization", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.finalize();

            expect(() => {
                cell.update("B");
            }).toThrow(
                "Unable to update a terminal entry that has already been finalized"
            );
        });

        it("prevents parameter updates after finalization", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    value: 1
                },
                template: "${value}"
            });

            cell.finalize();

            expect(() => {
                cell.updateParams({
                    value: 2
                });
            }).toThrow(
                "Unable to update a terminal entry that has already been finalized"
            );
        });

        it("prevents template changes after finalization", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.finalize();

            expect(() => {
                cell.template = "B";
            }).toThrow();
        });

        it("is idempotent", () => {
            const cell = new ScreenCell(createEvents(), {
                value: "A"
            });

            cell.finalize();
            cell.finalize();

            expect(cell.final).toBe(true);
        });
    });

    describe("update notifications", () => {
        it("emits an update event after a direct update", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            const cell = new ScreenCell(events, {
                value: "A"
            });

            updateCount = 0;

            cell.update("B");

            expect(updateCount).toBe(1);
        });

        it("emits an update event after a parameter update", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            const cell = new ScreenCell(events, {
                params: {
                    value: 1
                },
                template: "${value}"
            });

            updateCount = 0;

            cell.updateParams({
                value: 2
            });

            expect(updateCount).toBe(1);
        });

        it("does not emit an update event when finalize is called directly", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            const cell = new ScreenCell(events, {
                value: "A"
            });

            updateCount = 0;

            cell.finalize();

            expect(updateCount).toBe(0);
        });

        it("does not emit an update event during construction", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            new ScreenCell(events, {
                params: {
                    value: 1
                },
                template: "${value}"
            });

            expect(updateCount).toBe(0);
        });
    });

    describe("removal", () => {
        it("emits a removal event when removed", () => {
            let removed = false;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => { },
                onRemove: () => {
                    removed = true;
                }
            };

            const cell = new ScreenCell(events, {
                value: "A"
            });

            cell.remove();

            expect(removed).toBe(true);
        });

        it("does not emit the removal event more than once", () => {
            let removeCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => { },
                onRemove: () => {
                    removeCount++;
                }
            };

            const cell = new ScreenCell(events, {
                value: "A"
            });

            cell.remove();
            cell.remove();
            cell.remove();

            expect(removeCount).toBe(1);
        });

        it("ignores updates after removal", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            const cell = new ScreenCell(events, {
                value: "A"
            });

            cell.remove();

            updateCount = 0;
            cell.update("B");

            expect(cell.value).toBe("A");
            expect(updateCount).toBe(0);
        });

        it("ignores parameter updates after removal", () => {
            let updateCount = 0;

            const events: ScreenCellEngineEvents = {
                onUpdate: () => {
                    updateCount++;
                },
                onRemove: () => { }
            };

            const cell = new ScreenCell(events, {
                params: {
                    value: 1
                },
                template: "${value}"
            });

            cell.remove();

            updateCount = 0;
            cell.updateParams({
                value: 2
            });

            expect(cell.value).toBe("1");
            expect(cell.params).toEqual({
                value: 1
            });
            expect(updateCount).toBe(0);
        });
    });

    describe("params exposure", () => {
        it("returns the current parameters", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1,
                    y: 2
                },
                template: "${x}-${y}"
            });

            expect(cell.params).toEqual({
                x: 1,
                y: 2
            });
        });

        it("returns a frozen snapshot", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1
                },
                template: "${x}"
            });

            const params = cell.params;

            expect(Object.isFrozen(params)).toBe(true);
        });

        it("prevents mutation of the returned snapshot", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1
                },
                template: "${x}"
            });

            const params = cell.params;

            expect(() => {
                (params as any).x = 999;
            }).toThrow();

            expect(cell.params).toEqual({
                x: 1
            });
        });

        it("returns a new snapshot for each access", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1
                },
                template: "${x}"
            });

            expect(cell.params).not.toBe(cell.params);
        });

        it("reflects parameter updates in subsequent snapshots", () => {
            const cell = new ScreenCell(createEvents(), {
                params: {
                    x: 1
                },
                template: "${x}"
            });

            const before = cell.params;

            cell.updateParams({
                x: 2
            });

            const after = cell.params;

            expect(before).toEqual({
                x: 1
            });

            expect(after).toEqual({
                x: 2
            });
        });
    });
});