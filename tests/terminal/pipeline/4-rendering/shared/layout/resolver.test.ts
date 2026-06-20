import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import ZexiRenderingContext from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/context/context";
import LayoutResolver from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/layout/resolver";
import contracts from "./contracts";


const groupStart = (id: string): any => ({ kind: 'group-start', id });
const groupEnd = (id: string): any => ({ kind: 'group-end', groupId: id });

describe("LayoutResolver", () => {

    describe.each(contracts)(
        "basic inline behavior (%s)",
        (_name, contract) => {

            test("simple primitive object stays inline", () => {
                const tokens = contract.tokenize({ a: 1 });
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("inline");
            });

            test("array of primitives stays inline", () => {
                const tokens = contract.tokenize([1, 2, 3]);
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("inline");
            });
        }
    );

    describe.each(contracts)(
        "block forcing conditions (%s)",
        (_name, contract) => {

            test("nested objects force block", () => {
                const tokens = contract.tokenize({ a: { b: 1 } });
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });

            test("map always forces block", () => {
                const tokens = contract.tokenize(new Map());
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });

            test("deferred envelope forces block", () => {
                const tokens = contract.tokenize(new Error('custom message'));
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });
        }
    );

    describe.each(contracts)(
        "object rules (%s)",
        (_name, contract) => {

            test("non-inline-safe property value forces block", () => {
                const tokens = contract.tokenize({ a: [1] });
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });

            test("function property does force block", () => {
                const tokens = contract.tokenize({ fn: () => { } });
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });

            test("methods do not force block", () => {
                const tokens = contract.tokenize({ fn() { } });
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("inline");
            })
        }
    );

    describe.each(contracts)(
        "set rules (%s)",
        (_name, contract) => {

            test("sets always rendered as block", () => {
                const tokens = contract.tokenize(new Set([1, 2, 3]));
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });
        }
    );

    describe.each(contracts)(
        "map rules (%s)",
        (_name, contract) => {

            test("maps always rendered as block", () => {
                const tokens = contract.tokenize(new Map([[1, 2], [3, 4]]));
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });
        }
    );

    describe.each(contracts)(
        "array rules (%s)",
        (_name, contract) => {

            test("inline-safe array element stays inline", () => {
                const tokens = contract.tokenize([1, 2, 3]);
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("inline");
            });

            test("non-inline-safe array element forces block", () => {
                const tokens = contract.tokenize([1, [2, 3]]);
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });
        }
    );

    describe.each(contracts)(
        "envelope + error rules (%s)",
        (_name, contract) => {
            test("error tokens force block immediately", () => {
                const tokens = contract.tokenize(new Error('custom message'));
                const ctx = makeCtx(tokens);

                const start = tokens[0] as InstanceType<typeof TOKENS.GroupStart>;
                expect(start).toBeInstanceOf(TOKENS.GroupStart);

                const result = LayoutResolver.resolve(start, {
                    context: ctx,
                    inlineSafe: contract.inlineSafe
                });

                expect(result).toBe("block");
            });
        }
    );

    describe("early termination rules", () => {

        test("stops at matching group-end", () => {
            const tokens = [
                groupStart("g1"),
                new TOKENS.Primitive("string", "value"),
                groupEnd("g1"),
                new TOKENS.Primitive("number", 5) // should not matter
            ];

            const ctx = makeCtx(tokens);

            const result = LayoutResolver.resolve(tokens[0], {
                context: ctx,
                inlineSafe: new Set()
            });

            expect(result).toBe("inline");
        });
    }
    );
});

function makeCtx(tokens: readonly Token[]) {
    return new ZexiRenderingContext(tokens, {
        spaces: 2,
        maxWidth: Infinity
    });
}