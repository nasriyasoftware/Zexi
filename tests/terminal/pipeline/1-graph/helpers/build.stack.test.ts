import buildStack from "../../../../../src/core/terminal/pipeline/1-graphing/helpers/build.stack";

describe("buildStack", () => {
    it("parses a standard V8 stack trace correctly", () => {
        const stack = `
            at myFunction (/app/file.js:10:5)
            at /app/file2.js:20:15
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(2);

        expect(result[0]).toEqual({
            source: "/app/file.js",
            line: 10,
            column: 5,
            type: "file",
            functionName: "myFunction"
        });

        expect(result[1]).toEqual({
            source: "/app/file2.js",
            line: 20,
            column: 15,
            type: "file",
            functionName: undefined
        });
    });

    it("filters out non 'at' lines", () => {
        const stack = `
            Error: boom
            at myFunction (/app/file.js:10:5)
            random noise
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(1);
        expect(result[0].source).toBe("/app/file.js");
    });

    it("filters internal framework frames", () => {
        const stack = `
            at myFunction (/app/file.js:10:5)
            at internalFn (@nasriya/zexi/core.js:1:1)
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(1);
        expect(result[0].source).toBe("/app/file.js");
    });

    it("parses native frames correctly", () => {
        const stack = `
            at something (native)
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            source: "native",
            line: 0,
            column: 0,
            type: "native"
        });
    });

    it("parses eval frames correctly", () => {
        const stack = `
            at eval code (/app/file.js:1:1)
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("eval");
        expect(result[0].source).toContain("eval");
    });

    it("returns empty array for undefined input", () => {
        expect(buildStack(undefined)).toEqual([]);
    });

    it("drops invalid stack lines safely", () => {
        const stack = `
            at valid (/app/file.js:10:5)
            at invalid_line_without_format
        `;

        const result = buildStack(stack);

        expect(result).toHaveLength(1);
    });
});