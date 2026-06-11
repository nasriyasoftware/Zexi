import { AnchorToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/rendering/anchor.token";

describe("AnchorToken", () => {

    // --------------------------------------------------
    // Construction
    // --------------------------------------------------

    it("creates an anchor token", () => {
        const token = new AnchorToken("set:end");

        expect(token.kind).toBe("anchor");
    });

    it("stores the provided purpose", () => {
        const token = new AnchorToken("map:entries");

        expect(token.purpose).toBe("map:entries");
    });

    // --------------------------------------------------
    // Identity
    // --------------------------------------------------

    it("creates a symbol identifier", () => {
        const token = new AnchorToken("test");

        expect(typeof token.id).toBe("symbol");
    });

    it("creates a unique identifier per anchor instance", () => {
        const a = new AnchorToken("test");
        const b = new AnchorToken("test");

        expect(a.id).not.toBe(b.id);
    });

    it("preserves identifier stability", () => {
        const token = new AnchorToken("test");

        const first = token.id;
        const second = token.id;

        expect(first).toBe(second);
    });

    // --------------------------------------------------
    // Purpose semantics
    // --------------------------------------------------

    it("allows identical purposes across different anchors", () => {
        const a = new AnchorToken("set:end");
        const b = new AnchorToken("set:end");

        expect(a.purpose).toBe(b.purpose);
        expect(a.id).not.toBe(b.id);
    });

    it("does not use purpose as identity", () => {
        const a = new AnchorToken("a");
        const b = new AnchorToken("b");

        expect(a.id).not.toBe(b.id);
    });
});