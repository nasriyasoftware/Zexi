import TokensBuffer from "../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";

// minimal token mock (since tokens are immutable in our system)
const createToken = (id: string) => Object.freeze({ id }) as unknown as any;

describe("TokensBuffer", () => {

    describe("add()", () => {

        it("adds a single token", () => {
            const buffer = new TokensBuffer();

            buffer.add(createToken("a"));

            expect(TokensBuffer.toArray(buffer).length).toBe(1);
            expect((TokensBuffer.toArray(buffer) as any)[0].id).toBe("a");
        });

        it("adds multiple tokens", () => {
            const buffer = new TokensBuffer();

            buffer.add([createToken("a"), createToken("b")]);

            const tokens = TokensBuffer.toArray(buffer);

            expect(tokens.length).toBe(2);
            expect((tokens[0] as any).id).toBe("a");
            expect((tokens[1] as any).id).toBe("b");
        });

        it("returns itself for chaining", () => {
            const buffer = new TokensBuffer();

            const result = buffer.add(createToken("a"));

            expect(result).toBe(buffer);
        });

        it("throws if buffer is finalized", () => {
            const buffer = new TokensBuffer();
            buffer.finalize();

            expect(
                () => buffer.add(createToken("a"))
            ).toThrow("Unable to add tokens to finalized buffers");
        });

    });

    describe("consume()", () => {

        it("merges tokens from another buffer", () => {
            const a = new TokensBuffer().add(createToken("a"));
            const b = new TokensBuffer().add(createToken("b"));

            a.consume(b);

            const tokens = TokensBuffer.toArray(a);

            expect((tokens as any[]).map(t => t.id)).toEqual(["a", "b"]);
        });

        it("finalizes consumed buffer", () => {
            const a = new TokensBuffer();
            const b = new TokensBuffer().add(createToken("x"));

            a.consume(b);

            expect(() => b.add(createToken("y")))
                .toThrow("Unable to add tokens to finalized buffer");
        });

        it("throws if target buffer is finalized", () => {
            const a = new TokensBuffer();
            const b = new TokensBuffer();

            a.finalize();

            expect(() => a.consume(b))
                .toThrow("Finalized buffers cannot comsume other buffers");
        });

        it("throws if source buffer is already finalized", () => {
            const a = new TokensBuffer();
            const b = new TokensBuffer();

            b.finalize();

            expect(
                () => a.consume(b)
            ).toThrow("Finalized buffers cannot be comsumed by other buffers");
        });

    });

    describe("finalize()", () => {

        it("marks buffer as finalized", () => {
            const buffer = new TokensBuffer();

            buffer.add(createToken("a"));
            buffer.finalize();

            expect(() => buffer.add(createToken("b")))
                .toThrow();
        });

        it("allows safe read after finalization", () => {
            const buffer = new TokensBuffer();

            buffer.add(createToken("a"));
            buffer.finalize();

            const tokens = TokensBuffer.toArray(buffer);

            expect(tokens.length).toBe(1);
            expect((tokens[0] as any).id).toBe("a");
        });

    });

    describe("from()", () => {

        it("clones buffer content", () => {
            const original = new TokensBuffer();
            original.add([createToken("a"), createToken("b")]);

            const clone = TokensBuffer.from(original);

            const tokens = TokensBuffer.toArray(clone);

            expect((tokens as any[]).map(t => t.id)).toEqual(["a", "b"]);
        });

        it("does not share mutation state", () => {
            const original = new TokensBuffer();
            original.add(createToken("a"));

            const clone = TokensBuffer.from(original);

            clone.add(createToken("b"));

            expect(TokensBuffer.toArray(original).length).toBe(1);
            expect(TokensBuffer.toArray(clone).length).toBe(2);
        });

    });

    describe("toArray()", () => {

        it("returns frozen token array", () => {
            const buffer = new TokensBuffer();

            buffer.add([createToken("a"), createToken("b")]);

            const arr = TokensBuffer.toArray(buffer);

            expect(Object.isFrozen(arr)).toBe(true);
        });

        it("reflects buffer state correctly", () => {
            const buffer = new TokensBuffer();

            buffer.add(createToken("x"));

            const arr = TokensBuffer.toArray(buffer);

            expect(arr.length).toBe(1);
            expect((arr[0] as any).id).toBe("x");
        });

    });

});