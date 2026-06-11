import { StackTraceToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/stack.trace.token";
import { ErrorStartToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/error";

describe("StackTraceToken", () => {

    it("defaults ownership to standalone", () => {
        const token = new StackTraceToken(
            "at fn (/app/file.js:10:5)"
        );

        expect(token.ownership).toBe("standalone");
        expect(token.errorId).toBeUndefined();
    });

    it("inherits ownership from an error token", () => {
        const error = new ErrorStartToken();

        const token = new StackTraceToken(
            "at fn (/app/file.js:10:5)",
            error
        );

        expect(token.ownership).toBe("error");
        expect(token.errorId).toBe(error.id);
    });

    it("parses a simple stack trace into structured frames", () => {
        const stack = `
            at fn (/app/file.js:10:5)
            at /app/file2.js:20:15
        `;

        const token = new StackTraceToken(stack);

        expect(token.lines).toHaveLength(2);

        expect(token.lines[0]).toEqual({
            source: "/app/file.js",
            line: 10,
            column: 5,
            type: "file",
            functionName: "fn"
        });

        expect(token.lines[1]).toEqual({
            source: "/app/file2.js",
            line: 20,
            column: 15,
            type: "file",
            functionName: undefined
        });
    });

    it("parses native stack frames correctly", () => {
        const token = new StackTraceToken("at something (native)");

        expect(token.lines).toEqual([
            {
                source: "native",
                line: 0,
                column: 0,
                type: "native"
            }
        ]);
    });

    it("parses eval stack frames correctly", () => {
        const token = new StackTraceToken("at eval code (/app/file.js:1:1)");

        expect(token.lines[0].type).toBe("eval");
        expect(token.lines[0].source).toContain("eval");
    });

    it("filters invalid stack lines", () => {
        const stack = `
            Error: boom
            at valid (/app/file.js:10:5)
            random garbage line
        `;

        const token = new StackTraceToken(stack);

        expect(token.lines).toHaveLength(1);
        expect(token.lines[0].source).toBe("/app/file.js");
    });

    it("filters internal framework frames (zexi namespace)", () => {
        const stack = `
            at fn (/app/file.js:10:5)
            at internal (@nasriya/zexi/core.js:1:1)
        `;

        const token = new StackTraceToken(stack);

        expect(token.lines).toHaveLength(1);
        expect(token.lines[0].source).toBe("/app/file.js");
    });

    it("returns empty array for undefined stack", () => {
        const token = new StackTraceToken(undefined);

        expect(token.lines).toEqual([]);
    });

    it("freezes normalized stack lines", () => {
        const token = new StackTraceToken(
            "at fn (/app/file.js:10:5)"
        );

        expect(Object.isFrozen(token.lines)).toBe(true);
    });

    it("preserves immutability of parsed lines reference", () => {
        const token = new StackTraceToken("at fn (/app/file.js:10:5)");

        const lines = token.lines;

        expect(() => {
            (lines as any).push({
                source: "hack",
                line: 1,
                column: 1,
                type: "file"
            });
        }).toThrow();

        // core assertion: original token still stable
        expect(token.lines[0].source).toBe("/app/file.js");
    });

    it("preserves ownership after stack normalization", () => {
        const error = new ErrorStartToken();

        const token = new StackTraceToken(`
            at fn (/app/file.js:10:5)
            at fn2 (/app/file2.js:20:10)
        `, error);

        expect(token.ownership).toBe("error");
        expect(token.errorId).toBe(error.id);

        expect(token.lines).toHaveLength(2);
    });
});