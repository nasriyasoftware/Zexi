import { Token } from "../../../../../../../src/core/terminal/pipeline/3-tokenization/types";
import { Contract, DeferredStream, GenerateFunctions, PropItem } from "./types";
/**
 * Envelope tokenization contracts.
 *
 * This file acts as the canonical specification for envelope emission.
 *
 * Every contract describes the exact token stream expected from each
 * tokenizer implementation. Tests consume these definitions and verify
 * that emitted output matches the specification exactly.
 *
 * These contracts are intentionally strict:
 *
 * - token additions are breaking
 * - token removals are breaking
 * - token reordering is breaking
 * - layout changes are breaking
 * - anchor movement is breaking
 *
 * Any intentional change to token emission should be reflected by
 * updating the affected contract definition.
 */

const generate: GenerateFunctions = {
    regex: (): Contract<'regex'> => {
        const contract: Contract<'regex'> = {
            deferred: false,
            kind: 'regex',
            payload: {
                pattern: 'abc',
                flags: 'g'
            },
            tokenizers: []
        }

        const stream = [
            "object-name", "object-open", "soft-line", "indent-start", "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end", "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end", "group-start", "property", "key-value-separator",
            "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start", "group-start",
            "property", "key-value-separator", "soft-space", "primitive", "separator", "soft-line", "group-end",
            "group-start", "property", "key-value-separator", "soft-space", "primitive", "group-end", "indent-end",
            "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close"
        ] as Token['kind'][];

        const regularPositions = {
            props: [
                { name: '$kind', index: 5, value: { index: 8, type: 'string' } },
                { name: '$codec', index: 13, value: { index: 16, type: 'string' } },
                { name: '$payload', index: 21 },
                { name: 'pattern', index: 30, value: { index: 33, type: 'string', value: contract.payload.pattern } },
                { name: 'flags', index: 38, value: { index: 41, type: 'string', value: contract.payload.flags } }
            ] as PropItem[]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 13, value: { index: 16, type: 'string' } },
                        { name: '$codec', index: 5, value: { index: 8, type: 'string' } },
                        { name: '$payload', index: 21 },
                        { name: 'pattern', index: 38, value: { index: 41, type: 'string', value: contract.payload.pattern } },
                        { name: 'flags', index: 30, value: { index: 33, type: 'string', value: contract.payload.flags } }
                    ]
                }
            },
            {
                name: 'ignoredCycles',
                stream,
                positions: regularPositions
            },
            {
                name: 'markedCycles',
                stream,
                positions: regularPositions
            }
        )

        return contract;
    },

    set: (): Contract<'set'> => {
        const contract: Contract<'set'> = {
            deferred: true,
            kind: 'set',
            payload: { size: 0 },
            tokenizers: []
        }

        const stream: DeferredStream = {
            get full() {
                return [...this.start, ...this.trailing];
            },
            start: [
                "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start", "anchor"
            ],
            trailing: [
                "anchor", "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end",
                "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close"
            ]
        }

        const regularPositions = {
            props: [
                { name: '$kind', index: 5, value: { index: 8, type: 'string' } },
                { name: '$codec', index: 13, value: { index: 16, type: 'string' } },
                { name: '$payload', index: 21 },
                { name: 'size', index: 30, value: { index: 33, type: 'number', value: contract.payload.size } },
                { name: 'values', index: 38 }
            ] as PropItem[],
            anchors: [46, 47]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 13, value: { index: 16, type: 'string' } },
                        { name: '$codec', index: 5, value: { index: 8, type: 'string' } },
                        { name: '$payload', index: 21 },
                        { name: 'size', index: 30, value: { index: 33, type: 'number', value: contract.payload.size } },
                        { name: 'values', index: 38 }
                    ],
                    anchors: [46, 47]
                }
            },
            {
                name: 'ignoredCycles',
                stream,
                positions: regularPositions
            },
            {
                name: 'markedCycles',
                stream,
                positions: regularPositions
            }
        )

        return contract;
    },

    map: (): Contract<'map'> => {
        const contract: Contract<'map'> = {
            deferred: true,
            kind: 'map',
            payload: { size: 0 },
            tokenizers: []
        }

        const regularStream: DeferredStream = {
            get full() {
                return [...this.start, ...this.trailing];
            },
            start: [
                "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start",

                "object-name", "object-open", "soft-line", "indent-start", "anchor"
            ],
            trailing: [
                "anchor", "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end",
                "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close"
            ]
        }

        const regularPositions = {
            props: [
                { name: '$kind', index: 5, value: { index: 8, type: 'string' } },
                { name: '$codec', index: 13, value: { index: 16, type: 'string' } },
                { name: '$payload', index: 21 },
                { name: 'size', index: 30, value: { index: 33, type: 'number', value: contract.payload.size } },
                { name: 'entries', index: 38 }
            ] as PropItem[],
            anchors: [46, 47]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream: {
                    get full() {
                        return [...this.start, ...this.trailing];
                    },
                    start: [
                        "object-name", "object-open", "soft-line", "indent-start",

                        "group-start", "property", "key-value-separator",
                        "soft-space", "primitive", "separator", "soft-line", "group-end",

                        "group-start", "property", "key-value-separator",
                        "soft-space", "primitive", "separator", "soft-line", "group-end",

                        "group-start", "property", "key-value-separator",
                        "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

                        "group-start", "property", "key-value-separator",
                        "soft-space", "group-start",

                        "object-name", "object-open", "soft-line", "indent-start", "anchor"
                    ],
                    trailing: [
                        "anchor", "indent-end", "soft-line", "object-close", "group-end", "separator", "soft-line", "group-end",
                        "group-start", "property", "key-value-separator", "soft-space", "primitive", "group-end", "indent-end",
                        "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close"
                    ]
                } as DeferredStream,
                positions: {
                    props: [
                        { name: '$kind', index: 13, value: { index: 16, type: 'string' } },
                        { name: '$codec', index: 5, value: { index: 8, type: 'string' } },
                        { name: '$payload', index: 21 },
                        { name: 'entries', index: 30 },
                        { name: 'size', index: 48, value: { index: 51, type: 'number', value: contract.payload.size } }
                    ],
                    anchors: [38, 39]
                }
            },
            {
                name: 'ignoredCycles',
                stream: regularStream,
                positions: regularPositions
            },
            {
                name: 'markedCycles',
                stream: regularStream,
                positions: regularPositions
            }
        )

        return contract;
    },

    function: (): Contract<'function'> => {
        const contract: Contract<'function'> = {
            deferred: false,
            kind: 'function',
            payload: { name: 'test' },
            tokenizers: []
        }

        const stream = [
            "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "group-end",

            "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close"
        ] as Token['kind'][];

        const regularPositions = {
            props: [
                { name: '$kind', index: 5, value: { index: 8, type: 'string' } },
                { name: '$codec', index: 13, value: { index: 16, type: 'string' } },
                { name: '$payload', index: 21 },
                { name: 'name', index: 30, value: { index: 33, type: 'string', value: contract.payload.name } }
            ] as PropItem[],
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 13, value: { index: 16, type: 'string' } },
                        { name: '$codec', index: 5, value: { index: 8, type: 'string' } },
                        { name: '$payload', index: 21 },
                        { name: 'name', index: 30, value: { index: 33, type: 'string', value: contract.payload.name } }
                    ]
                }
            },
            {
                name: 'ignoredCycles',
                stream,
                positions: regularPositions
            },
            {
                name: 'markedCycles',
                stream,
                positions: regularPositions
            }
        )

        return contract;
    },

    error: (): Contract<'error'> => {
        const contract: Contract<'error'> = {
            deferred: true,
            kind: 'error',
            payload: {},
            tokenizers: []
        }

        const stream: DeferredStream = {
            get full() {
                return [...this.start, ...this.trailing];
            },
            start: [
                "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start", "anchor"
            ] as Token['kind'][],
            trailing: [
                "anchor", "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end",
                "soft-line", "object-close"
            ]
        }

        const regularPositions = {
            props: [
                { name: '$kind', index: 5, value: { index: 8, type: 'string' } },
                { name: '$codec', index: 13, value: { index: 16, type: 'string' } },
                { name: '$payload', index: 21 }
            ] as PropItem[],
            anchors: [29, 30]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 13, value: { index: 16, type: 'string' } },
                        { name: '$codec', index: 5, value: { index: 8, type: 'string' } },
                        { name: '$payload', index: 21 }
                    ],
                    anchors: [29, 30]
                }
            },
            {
                name: 'ignoredCycles',
                stream,
                positions: regularPositions
            },
            {
                name: 'markedCycles',
                stream,
                positions: regularPositions
            }
        )

        return contract;
    }
}

const contracts = [
    ['RegExp', generate.regex()],
    ['Set', generate.set()],
    ['Map', generate.map()],
    ['Function', generate.function()],
    ['Error', generate.error()]
] as const;

export default contracts;