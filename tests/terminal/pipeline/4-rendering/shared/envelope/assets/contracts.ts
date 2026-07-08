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
            "group-start", "object-name", "object-open", "soft-line", "indent-start", "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end", "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end", "group-start", "property", "key-value-separator",
            "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start", "group-start",
            "property", "key-value-separator", "soft-space", "primitive", "separator", "soft-line", "group-end",
            "group-start", "property", "key-value-separator", "soft-space", "primitive", "group-end", "indent-end",
            "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
        ] as Token['kind'][];

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 },
                { name: 'pattern', index: 31, value: { index: 34, type: 'string', value: contract.payload.pattern } },
                { name: 'flags', index: 39, value: { index: 42, type: 'string', value: contract.payload.flags } }
            ] as PropItem[]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 },
                        { name: 'pattern', index: 39, value: { index: 42, type: 'string', value: contract.payload.pattern } },
                        { name: 'flags', index: 31, value: { index: 34, type: 'string', value: contract.payload.flags } }
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
                "group-start", "object-name", "object-open", "soft-line", "indent-start",

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
                "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
            ]
        }

        let x = [
            'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',

            'group-start', 'property', 'key-value-separator',
            'soft-space', 'primitive', 'separator', 'soft-line', 'group-end',

            'group-start', 'property', 'key-value-separator',
            'soft-space', 'primitive', 'separator', 'soft-line', 'group-end',

            'group-start', 'property', 'key-value-separator',
            'soft-space',

            'group-start', 'object-name', 'object-open', 'soft-line', 'indent-start',

            'group-start', 'property', 'key-value-separator',
            'soft-space', 'primitive', 'separator',
            'soft-line', 'group-end',

            'group-start',
            'property', 'key-value-separator', 'soft-space',
            'group-start', 'object-name', 'object-open',
            'soft-line', 'indent-start', 'anchor',
            'anchor', 'indent-end', 'soft-line',
            'object-close', 'group-end', 'group-end',
            'indent-end', 'soft-line', 'object-close',
            'group-end', 'group-end', 'indent-end',
            'soft-line', 'object-close', 'group-end'
        ]

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 },
                { name: 'size', index: 31, value: { index: 34, type: 'number', value: contract.payload.size } },
                { name: 'values', index: 39 }
            ] as PropItem[],
            anchors: [47, 48]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 },
                        { name: 'size', index: 31, value: { index: 34, type: 'number', value: contract.payload.size } },
                        { name: 'values', index: 39 }
                    ],
                    anchors: [47, 48]
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
                "group-start", "object-name", "object-open", "soft-line", "indent-start",

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
                "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
            ]
        }

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 },
                { name: 'size', index: 31, value: { index: 34, type: 'number', value: contract.payload.size } },
                { name: 'entries', index: 39 }
            ] as PropItem[],
            anchors: [47, 48]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream: {
                    get full() {
                        return [...this.start, ...this.trailing];
                    },
                    start: [
                        "group-start", "object-name", "object-open", "soft-line", "indent-start",

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
                        "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
                    ]
                } as DeferredStream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 },
                        { name: 'entries', index: 31 },
                        { name: 'size', index: 49, value: { index: 52, type: 'number', value: contract.payload.size } }
                    ],
                    anchors: [39, 40]
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
            "group-start", "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "group-end",

            "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
        ] as Token['kind'][];

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 },
                { name: 'name', index: 31, value: { index: 34, type: 'string', value: contract.payload.name } }
            ] as PropItem[],
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 },
                        { name: 'name', index: 31, value: { index: 34, type: 'string', value: contract.payload.name } }
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
                "group-start", "object-name", "object-open", "soft-line", "indent-start",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "primitive", "separator", "soft-line", "group-end",

                "group-start", "property", "key-value-separator",
                "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start", "anchor"
            ] as Token['kind'][],
            trailing: [
                "anchor", "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end",
                "soft-line", "object-close", "group-end"
            ]
        }

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 }
            ] as PropItem[],
            anchors: [30, 31]
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 }
                    ],
                    anchors: [30, 31]
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

    number: (): Contract<'number'> => {
        const contract: Contract<'number'> = {
            deferred: false,
            kind: 'number',
            payload: { value: "NaN" },
            tokenizers: []
        }

        const stream = [
            "group-start", "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "separator", "soft-line", "group-end",

            "group-start", "property", "key-value-separator",
            "soft-space", "group-start", "object-name", "object-open", "soft-line", "indent-start",

            "group-start", "property", "key-value-separator",
            "soft-space", "primitive", "group-end",

            "indent-end", "soft-line", "object-close", "group-end", "group-end", "indent-end", "soft-line", "object-close", "group-end"
        ] as Token['kind'][];

        const regularPositions = {
            props: [
                { name: '$kind', index: 6, value: { index: 9, type: 'string' } },
                { name: '$codec', index: 14, value: { index: 17, type: 'string' } },
                { name: '$payload', index: 22 },
                { name: 'value', index: 31, value: { index: 34, type: 'string', value: contract.payload.value } }
            ] as PropItem[],
        }

        contract.tokenizers.push(
            {
                name: 'json',
                stream,
                positions: {
                    props: [
                        { name: '$kind', index: 14, value: { index: 17, type: 'string' } },
                        { name: '$codec', index: 6, value: { index: 9, type: 'string' } },
                        { name: '$payload', index: 22 },
                        { name: 'value', index: 31, value: { index: 34, type: 'string', value: contract.payload.value } }
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
    }
}

const contracts = [
    ['RegExp', generate.regex()],
    ['Set', generate.set()],
    ['Map', generate.map()],
    ['Function', generate.function()],
    ['Error', generate.error()],
    ['Number', generate.number()]
] as const;

export default contracts;