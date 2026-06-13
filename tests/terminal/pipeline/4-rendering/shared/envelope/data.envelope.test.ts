import GraphBuilder from "../../../../../../src/core/terminal/pipeline/1-graphing/builder";
import RepresentationBuilder from "../../../../../../src/core/terminal/pipeline/2-representation/builder";
import TokensBuffer from "../../../../../../src/core/terminal/pipeline/3-tokenization/container/tokens.buffer";
import Tokenizer from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokenizer";
import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";
import { Token } from "../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import DataEnvelope from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/data.envelope";
import { EnvelopeKind } from "../../../../../../src/core/terminal/pipeline/4-rendering/shared/envelope/types";
import { GraphConfig } from "../../../../../../src/core/terminal/pipeline/4-rendering/types/types";
import contracts from "./assets/contracts";

describe("DataEnvelope", () => {

    describe("construction", () => {

        it("produces correct envelope kind", () => {
            const data = [
                { kind: 'set' as EnvelopeKind, payload: { size: 2, values: [] } },
                { kind: 'map' as EnvelopeKind, payload: { size: 5, entries: [] } },
                { kind: 'regex' as EnvelopeKind, payload: { pattern: 'abc', flags: 'i' } },
                { kind: 'error' as EnvelopeKind, payload: {} },
                { kind: 'function' as EnvelopeKind, payload: { name: 'testFn' } }
            ]

            for (const entry of data) {
                const env = new DataEnvelope(entry.kind, entry.payload);
                expect(env.debug.$kind).toBe(entry.kind);
            }
        });

        it("accepts valid map envelope", () => {
            const env = new DataEnvelope("map", {
                size: 2,
                entries: [{ key: "a", value: 1 }]
            });

            expect(env.debug.$payload.size).toBe(2);
        });

        it("accepts valid set envelope", () => {
            const env = new DataEnvelope("set", {
                size: 2,
                values: [1, 2, 3]
            });

            expect(env.debug.$payload.values).toEqual([]);
        });

        it("accepts regex envelope", () => {
            const env = new DataEnvelope("regex", {
                pattern: "abc",
                flags: "g"
            });

            expect(env.debug.$payload.pattern).toBe("abc");
        });

        it("accepts function envelope", () => {
            const env = new DataEnvelope("function", {
                name: "testFn"
            });

            expect(env.debug.$payload.name).toBe("testFn");
        });

        it("generates a stable codec string", () => {
            const env = new DataEnvelope("regex", {
                pattern: "abc",
                flags: "g"
            });

            expect(env.debug.$codec).toMatch(/^zexi@\d+\.\d+$/);
        });
    });

    describe("payload validation", () => {

        it("accepts valid plain object payload for set envelope", () => {
            const payload = {
                size: 2,
                values: [1, 2]
            };

            const env = new DataEnvelope("set", payload);

            expect(env.debug.$payload.size).toBe(2);
            expect(Array.isArray(env.debug.$payload.values)).toBe(true);
        });

        it("freezes payload object", () => {
            const payload = {
                name: "test"
            };

            const env = new DataEnvelope("function", payload);

            expect(Object.isFrozen(env.debug.$payload)).toBe(true);
        });

        it("rejects null payload", () => {
            expect(() => {
                // @ts-expect-error intentional invalid input
                new DataEnvelope("error", null);
            }).toThrow();
        });

        it("rejects undefined payload", () => {
            expect(() => {
                new DataEnvelope("error", undefined as any);
            }).toThrow();
        });

        it("rejects array payload", () => {
            expect(() => {
                new DataEnvelope("error", [1, 2, 3] as any);
            }).toThrow();
        });

        it("rejects non-object primitive payload", () => {
            expect(() => {
                new DataEnvelope("error", 123 as any);
            }).toThrow();
        });

        it("accepts empty object payload", () => {
            const env = new DataEnvelope("error", {});

            expect(env.debug.$payload).toEqual({});
        });
    });

    describe("immutability", () => {
        it("freezes the envelope object", () => {
            const env = new DataEnvelope("error", {});

            expect(Object.isFrozen(env.debug)).toBe(true);
        });

        it("freezes the payload object", () => {
            const env = new DataEnvelope("function", {
                name: "test"
            });

            expect(Object.isFrozen(env.debug.$payload)).toBe(true);
        });

        it("prevents payload mutation", () => {
            const env = new DataEnvelope("function", {
                name: "test"
            });

            expect(() => {
                (env.debug.$payload as any).name = "changed";
            }).toThrow();
        });
    });

    describe("serialization", () => {
        it("serializes correctly via JSON.stringify", () => {
            const env = new DataEnvelope("regex", {
                pattern: "abc",
                flags: "gi"
            });

            const parsed = JSON.parse(
                JSON.stringify(env.debug)
            );

            expect(parsed.$kind).toBe("regex");
            expect(parsed.$payload.pattern).toBe("abc");
            expect(parsed.$payload.flags).toBe("gi");
            expect(typeof parsed.$codec).toBe("string");
        });
    });

    describe("tokenization", () => {
        // Helpers (ONLY allowed pipeline entry point)
        const tokenize = (
            value: unknown,
            preset: 'json' | 'ignoredCycles' | 'markedCycles'
        ): readonly Token[] => {
            const config: GraphConfig = {
                cycles: 'ignore',
                canonical: false
            };

            switch (preset) {
                case 'json': {
                    config.canonical = true;
                    config.cycles = 'throw';
                    break;
                }

                case 'ignoredCycles': {
                    config.cycles = 'ignore';
                    break;
                }

                case 'markedCycles': {
                    config.cycles = 'mark';
                    break;
                }
            }

            const graph = GraphBuilder.build(value, config);
            const rep = RepresentationBuilder.build(graph);
            const buffer = Tokenizer.tokenize(rep);
            return TokensBuffer.toArray(buffer);
        }

        const extractKinds = (tokens: readonly any[]) => tokens.map(t => t.kind);

        const tokenizer = {
            json: (value: unknown) => tokenize(value, "json"),
            ignoredCycles: (value: unknown) => tokenize(value, "ignoredCycles"),
            markedCycles: (value: unknown) => tokenize(value, "markedCycles"),
        } as const;

        const tokenizers = [
            tokenizer.json,
            tokenizer.ignoredCycles,
            tokenizer.markedCycles
        ] as const;

        describe("deferred envelopes", () => {
            it.each(tokenizers)(
                "tokenizes set envelopes as deferred",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 2
                    });

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(true);

                    if (result.deferred) {
                        expect(result.tokens.start.length).toBeGreaterThan(0);
                        expect(result.tokens.trailing.length).toBeGreaterThan(0);
                    }
                }
            );

            it.each(tokenizers)(
                "tokenizes map envelopes as deferred",
                (tokenizer) => {
                    const env = new DataEnvelope("map", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(true);

                    if (result.deferred) {
                        expect(result.tokens.start.length).toBeGreaterThan(0);
                        expect(result.tokens.trailing.length).toBeGreaterThan(0);
                    }
                }
            );

            it.each(tokenizers)(
                "returns anchor tokens",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    expect(result.anchors.start).toBeInstanceOf(TOKENS.Anchor);
                    expect(result.anchors.end).toBeInstanceOf(TOKENS.Anchor);
                }
            );

            it.each(tokenizers)(
                "places start anchor inside start partition",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    expect(
                        result.tokens.start.includes(result.anchors.start)
                    ).toBe(true);
                }
            );

            it.each(tokenizers)(
                "places end anchor inside trailing partition",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    expect(
                        result.tokens.trailing.includes(result.anchors.end)
                    ).toBe(true);
                }
            );

            it.each(tokenizers)(
                "uses identical anchor instances in partitions and anchor map",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    const startAnchor = result.tokens.start.find(
                        t => t === result.anchors.start
                    );

                    const endAnchor = result.tokens.trailing.find(
                        t => t === result.anchors.end
                    );

                    expect(startAnchor).toBe(result.anchors.start);
                    expect(endAnchor).toBe(result.anchors.end);
                }
            );

            it.each(tokenizers)(
                "returns frozen token partitions",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    expect(
                        Object.isFrozen(result.tokens.start)
                    ).toBe(true);

                    expect(
                        Object.isFrozen(result.tokens.trailing)
                    ).toBe(true);
                }
            );

            it.each(tokenizers)(
                "creates fresh anchor instances for every tokenization",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 1
                    });

                    const first = env.tokenize(tokenizer);
                    const second = env.tokenize(tokenizer);

                    if (!first.deferred || !second.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    expect(first.anchors.start)
                        .not.toBe(second.anchors.start);

                    expect(first.anchors.end)
                        .not.toBe(second.anchors.end);
                }
            );

            it.each(tokenizers)(
                "places start and end anchors adjacent for empty body envelopes",
                (tokenizer) => {
                    const env = new DataEnvelope("set", {
                        size: 0
                    });

                    const result = env.tokenize(tokenizer);

                    if (!result.deferred) {
                        throw new Error("Expected deferred tokenization.");
                    }

                    const lastStart =
                        result.tokens.start[
                        result.tokens.start.length - 1
                        ];

                    const firstTrailing =
                        result.tokens.trailing[0];

                    expect(lastStart).toBe(result.anchors.start);
                    expect(firstTrailing).toBe(result.anchors.end);
                }
            );
        });

        describe("complete envelopes", () => {
            it.each(tokenizers)(
                "tokenizes regex envelopes as complete",
                (tokenizer) => {
                    const env = new DataEnvelope("regex", {
                        pattern: "abc",
                        flags: "g"
                    });

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(false);

                    if (!result.deferred) {
                        expect(result.tokens.length)
                            .toBeGreaterThan(0);
                    }
                }
            );

            it.each(tokenizers)(
                "tokenizes function envelopes as complete",
                (tokenizer) => {
                    const env = new DataEnvelope("function", {
                        name: "testFn"
                    });

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(false);

                    if (!result.deferred) {
                        expect(result.tokens.length)
                            .toBeGreaterThan(0);
                    }
                }
            );

            it.each(tokenizers)(
                "tokenizes error envelopes as incomplete",
                (tokenizer) => {
                    const env = new DataEnvelope("error", {});

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(true);
                }
            );

            it.each(tokenizers)(
                "returns frozen token stream",
                (tokenizer) => {
                    const env = new DataEnvelope("regex", {
                        pattern: "abc",
                        flags: ""
                    });

                    const result = env.tokenize(tokenizer);

                    if (result.deferred) {
                        throw new Error("Expected complete tokenization.");
                    }

                    expect(
                        Object.isFrozen(result.tokens)
                    ).toBe(true);
                }
            );

            it.each(tokenizers)(
                "does not expose anchors",
                (tokenizer) => {
                    const env = new DataEnvelope("regex", {
                        pattern: "abc",
                        flags: ""
                    });

                    const result = env.tokenize(tokenizer);

                    expect(result.deferred).toBe(false);

                    if (!result.deferred) {
                        expect(
                            "anchors" in result
                        ).toBe(false);
                    }
                }
            );
        });

        describe("tokenization mode selection", () => {
            it.each(tokenizers)(
                "uses deferred tokenization for all deferred envelope kinds",
                (tokenizer) => {
                    expect(
                        new DataEnvelope("set", {
                            size: 1
                        }).tokenize(tokenizer).deferred
                    ).toBe(true);

                    expect(
                        new DataEnvelope("map", {
                            size: 1
                        }).tokenize(tokenizer).deferred
                    ).toBe(true);
                }
            );

            it.each(tokenizers)(
                "uses complete tokenization for all non-deferred envelope kinds",
                (tokenizer) => {
                    expect(
                        new DataEnvelope("regex", {
                            pattern: "",
                            flags: ""
                        }).tokenize(tokenizer).deferred
                    ).toBe(false);

                    expect(
                        new DataEnvelope("function", {
                            name: "fn"
                        }).tokenize(tokenizer).deferred
                    ).toBe(false);

                    expect(
                        new DataEnvelope("error", {})
                            .tokenize(tokenizer).deferred
                    ).toBe(true);
                }
            );
        });

        describe("tokenization contracts", () => {
            it.each(contracts)(
                "contracts are valid",
                (contract) => {
                    const env = new DataEnvelope(contract.kind, contract.payload);
                    expect(env.debug.$kind).toBe(contract.kind);
                    expect(env.debug.$codec).toMatch(/zexi@[0-9].[0-9]/);

                    for (const tokenization of contract.tokenizers) {
                        const result = env.tokenize(tokenizer[tokenization.name as keyof typeof tokenizer]);
                        const tokens = result.deferred ? [...result.tokens.start, ...result.tokens.trailing] : result.tokens;

                        if (result.deferred) {
                            if (contract.kind === 'map') {
                                console.debug({
                                    contract: contract.kind,
                                    tokenizer: tokenization.name,
                                    inspect: [5, 8, 13, 16, 21, 30, 33].map(i => {
                                        const token = tokens[i]
                                        return {
                                            token: token.kind,
                                            value: token.kind === 'property' ? token.value : 'N/A',
                                            index: i
                                        }
                                    }).sort((a, b) => {
                                        if (a.index < b.index) { return -1; }
                                        if (a.index > b.index) { return 1; }
                                        return 0;
                                    })
                                })
                            }
                            const stream = tokenization.stream as unknown as {
                                full: Token[];
                                start: Token[];
                                trailing: Token[];
                            }

                            expect(stream.start).toEqual(extractKinds(result.tokens.start));
                            expect(stream.trailing).toEqual(extractKinds(result.tokens.trailing));

                            expect(result.tokens.start[result.tokens.start.length - 1]).toBeInstanceOf(TOKENS.Anchor);
                            expect(result.tokens.trailing[0]).toBeInstanceOf(TOKENS.Anchor);

                            if ('anchors' in tokenization.positions) {
                                for (const anchorIndex of tokenization.positions.anchors) {
                                    const token = tokens[anchorIndex] as InstanceType<typeof TOKENS.Anchor>;
                                    expect(token).toBeInstanceOf(TOKENS.Anchor);
                                }
                            }
                        } else {
                            expect(tokenization.stream).toEqual(extractKinds(result.tokens));

                        }

                        for (const prop of tokenization.positions.props) {
                            const propToken = tokens[prop.index] as InstanceType<typeof TOKENS.Property>;
                            expect(propToken).toBeInstanceOf(TOKENS.Property);
                            expect(propToken.kind).toBe('property');
                            expect(propToken.type).toBe('property');
                            expect(propToken.value).toBe(prop.name);

                            if (prop.value) {
                                const valueToken = tokens[prop.value.index] as InstanceType<typeof TOKENS.Primitive>;

                                expect(valueToken).toBeInstanceOf(TOKENS.Primitive);
                                expect(valueToken.kind).toBe('primitive');
                                expect(valueToken.type).toBe(prop.value!.type);

                                if ('value' in prop.value) {
                                    expect(valueToken.value).toBe(prop.value.value);
                                }
                            }
                        }
                    }
                }
            )
        });
    });
});