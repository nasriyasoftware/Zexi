import ZexiRenderingContext from "../../shared/context/context";
import { resolveRendererConfig } from "../../shared/helpers";
import { hasOwnProp } from "../../../../../../utils/utils";

import GraphBuilder from "../../../1-graphing/builder";
import PropertyNode from "../../../1-graphing/nodes/assets/property.node";
import RepresentationBuilder from "../../../2-representation/builder";
import Tokenizer from "../../../3-tokenization/tokenizer";
import TokensBuffer from "../../../3-tokenization/container/tokens.buffer";
import TOKENS from "../../../3-tokenization/tokens";
import { PropertyToken } from "../../../3-tokenization/tokens/tokenization/property.token";

import ErrorCache, { ERROR_SECTIONS } from "./assets/error.cache";
import ObjectCache from "./assets/object.cache";

import type { JSONConfig } from "./types";
import type { JsonOptions } from "../../../types";
import type { Token } from "../../../3-tokenization/types";
import DataEnvelope, { TRAILING_LENGTH } from "../../shared/envelope/data.envelope";

const ERROR_CACHE_KEY = Symbol.for('error_cache');
const OBJECT_CACHE_KEY = Symbol.for('object_cache');

let logNow = false;

class JSONRenderer {
    readonly #_config: JSONConfig;
    readonly #_ctx: ZexiRenderingContext;

    readonly #_flags = {
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false
    }

    readonly #_ignoredTokens = new Set<Token>();

    constructor(
        tokens: readonly Token[],
        options: JsonOptions
    ) {
        this.#_config = resolveRendererConfig('json', options?.mode ?? 'compact');

        if (options) {
            if (hasOwnProp(options, 'spaces')) {
                if (typeof options.spaces !== 'number') {
                    throw new TypeError('Spaces must be a number');
                }

                if (options.spaces < 0) {
                    throw new RangeError('Spaces must be greater than or equal to 0');
                }

                if (options.spaces > 8) {
                    throw new RangeError(`Spaces must be less than or equal to 8, got ${options.spaces}`);
                }

                this.#_config.spaces = options.spaces!;
            }

        }

        this.#_ctx = new ZexiRenderingContext(
            tokens,
            { spaces: this.#_config.spaces }
        );
    }

    readonly #_helpers = {
        isVisibleToken: (token: Token): boolean => {
            if (token.kind !== 'primitive') {
                return true;
            }

            if (
                token.type === 'symbol' ||
                token.type === 'undefined'
            ) {
                return false;
            }

            return true;
        },
        ignoreCurrentGroup: () => {
            this.#_flags.ignoreCurrentGroup = true;
        },
        skipNext: {
            tokens: (count: number) => {
                let skipped = 0;
                while (
                    this.#_ctx.tokens.hasNext() &&
                    skipped < count
                ) {
                    this.#_ctx.tokens.next();
                    skipped++;
                }
            }
        },
        render: {
            objectLiteral: () => {
                const ignoredProps = new Set<PropertyToken>();
                const cache = new ObjectCache(ignoredProps);

                // Store the cache in the context
                this.#_ctx.data.set(OBJECT_CACHE_KEY, cache);

                let index = 0;
                let item = this.#_ctx.tokens.peek(++index);
                const scopes = { opened: 0, closed: 0 }

                const props = new Set<PropertyToken>();

                do {
                    try {
                        if (!item) { break; }
                        if (item.kind === 'object-close') {
                            scopes.closed++;
                            if (scopes.opened === scopes.closed) {
                                break;
                            }

                            continue;
                        }

                        if (item.kind === 'object-open') {
                            scopes.opened++;
                            continue;
                        }

                        // Checking if we're in the correct scope
                        if (scopes.closed + 1 !== scopes.opened) { continue; }

                        if (
                            item.kind === 'property' && // The token kind is a property
                            item.type === 'property'    // The token type is a property, not a method, getter, etc.
                        ) {
                            props.add(item);

                            const valueToken = this.#_ctx.tokens.peek(index + 3);

                            const isVisible = valueToken && this.#_helpers.isVisibleToken(valueToken);
                            if (!isVisible) {
                                ignoredProps.add(item);
                            }
                        }
                    } finally {
                        index++;
                        item = this.#_ctx.tokens.peek(index);
                    }
                } while (item);

                if (props.size === 0) {
                    return;
                }

                if (props.size === ignoredProps.size) {
                    this.#_helpers.ignoreCurrentGroup();
                    this.#_ctx.writer.write('{}');
                }

                // Detect if the last property is ignored
                const allProps = Array.from(props);
                const ignored = Array.from(ignoredProps);

                const lastProp = allProps[allProps.length - 1];
                const lastIgnoredProp = ignored[ignored.length - 1];

                if (lastProp === lastIgnoredProp) {
                    // Mark the last visible property to ignore its separator
                    const visibleProps = allProps.filter(prop => !ignored.includes(prop));
                    const lastVisibleProp = visibleProps[visibleProps.length - 1];
                    cache.suppressTrailingOf(lastVisibleProp);
                }
            },
            set: () => {
                const initialCursor = this.#_ctx.tokens.cursor;

                // Skipping set tokens
                let skipped = 0;
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `object-open`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `soft-line`
                this.#_ignoredTokens.add(this.#_ctx.tokens.peek(++skipped)!); // Ignoring `indent-start`

                const dataEndAnchor = new TOKENS.Anchor('set:close');

                const size = (() => {
                    let separators = 0;
                    let scanned = skipped; // The skipped tokens

                    const scopes = { opened: 1, closed: 0 }

                    let item = this.#_ctx.tokens.peek(++scanned);
                    let closeIndex = -1;

                    do {
                        try {
                            if (!item) { break; }
                            if (item.kind === 'object-close') {
                                scopes.closed++;
                                if (scopes.opened === scopes.closed) {
                                    closeIndex = initialCursor + scanned;
                                    this.#_ctx.tokens.inject(dataEndAnchor, {
                                        // The index of the closing token - 2 tokens (`soft-line` and `indent-end`)
                                        at: closeIndex - 2
                                    });
                                    break;
                                }

                                continue;
                            }

                            if (item.kind === 'object-open') {
                                scopes.opened++;
                                continue;
                            }

                            // Checking if we're in the correct scope
                            if (scopes.closed + 1 !== scopes.opened) { continue; }

                            if (item.kind === 'separator') {
                                separators++;
                            }
                        } finally {
                            scanned++;
                            item = this.#_ctx.tokens.peek(scanned);
                        }
                    } while (item);

                    return separators + 1;
                })();

                const envelop = new DataEnvelope('set', { size, values: [] });
                const tokenized = this.#_tokenize(envelop.toObject());

                const finalTokens = tokenized.slice(1, tokenized.length - 1);

                if (finalTokens.length + 2 !== tokenized.length) {
                    throw new Error(`Invariant violation: Expected sliced tokens to be exactly 2 tokens short.`);
                }

                const trailing = TRAILING_LENGTH + 4;
                const startEnd = finalTokens.length - trailing
                const envelopeTokens = {
                    start: finalTokens.slice(0, startEnd),
                    end: finalTokens.slice(startEnd)
                }

                if (envelopeTokens.end.length + envelopeTokens.start.length !== finalTokens.length) {
                    throw new Error(`Invariant violation: Expected trailing tokens to be at the end of the token stream.`);
                }

                // Add the envelope data to the stream
                this.#_ctx.tokens.inject(envelopeTokens.start, { at: initialCursor + skipped + 1 });

                this.#_ctx.tokens.inject([
                    ...envelopeTokens.end,
                    new TOKENS.Callback(() => {
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(1)!); // Ignoring `indent-end`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(2)!); // Ignoring `soft-line`
                        this.#_ignoredTokens.add(this.#_ctx.tokens.peek(3)!); // Ignoring `object-close`
                    })
                ], { at: dataEndAnchor });
            },
            map: () => {
                console.warn('Map is not supported yet.');
            }
        }
    }

    #_tokenize(value: unknown) {
        const graph = GraphBuilder.build(value, { cycles: 'throw', canonical: true });
        const rep = RepresentationBuilder.build(graph);
        const buffer = Tokenizer.tokenize(rep);
        return TokensBuffer.toArray(buffer);
    }

    #_render() {
        const tokens = this.#_ctx.tokens;

        while (tokens.hasNext()) {
            const token = tokens.next()!;
            const ignore = this.#_ignoredTokens.has(token);

            // console.debug(`[${logNow ? 'Set_' : ''}Token:${token.kind}]${ignore ? ' (Ignored)' : ''}`);

            if (ignore) {
                this.#_ignoredTokens.delete(token);
                continue;
            }

            if (this.#_flags.ignoreCurrentGroup) {
                const currentGroup = this.#_ctx.data.get<symbol>('currentGroup');

                if (token.kind === 'group-end' && token.groupId === currentGroup) {
                    this.#_flags.ignoreCurrentGroup = false;
                    this.#_ctx.scopes.commit();
                }

                continue;
            }

            switch (token.kind) {
                case 'group-start': {
                    this.#_ctx.scopes.begin({ id: token.id });
                    this.#_ctx.data.set('currentGroup', token.id);
                    continue;
                }

                case 'group-end': {
                    this.#_ctx.scopes.commit();
                    continue;
                }

                case 'anchor':
                case 'ansi':
                case 'reference-start':
                case 'reference-end': continue;

                case 'date': {
                    this.#_ctx.writer.write(`"${token.value.toISOString()}"`);
                    continue;
                }

                case 'function': {
                    const funcName = token.value.name ?? 'anonymous';
                    const envelope = new DataEnvelope('function', { name: funcName });

                    const toInject = this.#_tokenize(envelope.toObject());
                    this.#_ctx.tokens.inject(toInject);
                    continue;
                }

                case 'indent-start': {
                    this.#_ctx.depth.increase();
                    continue;
                }

                case 'indent-end': {
                    this.#_ctx.depth.decrease()
                    continue;
                }

                case 'primitive': {
                    primitive: switch (token.type) {
                        case 'boolean':
                        case 'null':
                        case 'number':
                        case 'undefined':
                        case 'bigint': {
                            this.#_ctx.writer.write(String(token.value));
                            break primitive;
                        }

                        case 'string': {
                            this.#_ctx.writer.write(JSON.stringify(token.value));
                            break primitive;
                        }

                        case 'symbol': {
                            break primitive;
                        }
                    }
                    continue;
                }

                case 'separator': {
                    if (this.#_flags.skipNextSeparator) {
                        this.#_flags.skipNextSeparator = false;
                        continue;
                    }

                    this.#_ctx.writer.write(token.value);
                    continue;
                }

                case 'hard-line': {
                    this.#_ctx.writer.newLine();
                    continue;
                }

                case 'soft-line': {
                    if (this.#_flags.skipNextSoftLine) {
                        this.#_flags.skipNextSoftLine = false;
                        continue;
                    }

                    if (
                        this.#_config.layout.lineBreaks === 'soft' ||
                        this.#_config.layout.lineBreaks === 'strict'
                    ) {
                        this.#_ctx.writer.newLine();
                    }
                    continue;
                }

                case 'hard-space': {
                    this.#_ctx.writer.write(' ');
                    continue;
                }

                case 'soft-space': {
                    if (
                        this.#_config.layout.spaces === 'preserve' ||
                        this.#_config.layout.spaces === 'normalize'
                    ) {
                        this.#_ctx.writer.write(' ');
                    }
                    continue;
                }

                case 'key-value-separator': {
                    this.#_ctx.writer.write(token.value);
                    continue;
                }

                case 'soft-wrap': {
                    if (this.#_config.layout.lineBreaks === 'soft') {
                        this.#_ctx.writer.newLine();
                    }
                    continue;
                }

                case 'regex': {
                    const regex = token.value;
                    const envelope = new DataEnvelope('regex', {
                        pattern: regex.source,
                        flags: regex.flags
                    });

                    const toInject = this.#_tokenize(envelope.toObject());
                    this.#_ctx.tokens.inject(toInject);
                    continue;
                }

                case 'property': {
                    if (token.type !== 'property') {
                        this.#_helpers.ignoreCurrentGroup();
                        continue;
                    }

                    const objectCache = this.#_ctx.data.get<ObjectCache>(OBJECT_CACHE_KEY);
                    if (!objectCache) {
                        throw new Error(`Invariant violation: Attempting to render a property without an object cache`);
                    }

                    if (objectCache.shouldRemoveTrailing(token)) {
                        this.#_flags.skipNextSeparator = true;
                        this.#_flags.skipNextSoftLine = true;
                    }

                    if (objectCache.isIgnored(token)) {
                        this.#_helpers.ignoreCurrentGroup();
                        continue;
                    }

                    this.#_ctx.writer.write(JSON.stringify(token.value));
                    continue;
                }

                case 'object-name': {
                    if (token.className && token.className !== 'Array') {

                        switch (token.className) {
                            case 'Set': {
                                this.#_helpers.render.set();
                                continue;
                            }

                            case 'Map': {
                                this.#_helpers.render.map();
                                continue;
                            }
                        }                        

                        this.#_helpers.ignoreCurrentGroup();
                        this.#_ctx.writer.write('{}');
                    }

                    // handle objects (literals and classes)
                    if (!token.className) {
                        this.#_helpers.render.objectLiteral();
                    }

                    continue;
                }

                case 'object-open':
                case 'object-close': {
                    this.#_ctx.writer.write(token.token)
                    continue;
                }

                case 'error-start': {
                    this.#_ctx.scopes.begin({ id: token.id });
                    const envelop = new DataEnvelope('error', {});
                    const tokenized = this.#_tokenize(envelop.toObject());

                    const finalTokens = tokenized.slice(1, tokenized.length - 1);
                    if (finalTokens.length + 2 !== tokenized.length) {
                        throw new Error(`Invariant violation: Expected sliced tokens to be exactly 2 tokens short.`);
                    }

                    const toInject = finalTokens.slice(0, tokenized.length - TRAILING_LENGTH);
                    const trailing = finalTokens.slice(tokenized.length - TRAILING_LENGTH);

                    this.#_ctx.tokens.inject([
                        ...toInject,
                        new TOKENS.IndentStart
                    ]);

                    if (trailing.length + toInject.length !== finalTokens.length) {
                        throw new Error(`Invariant violation: Expected trailing tokens to be at the end of the token stream.`);
                    }

                    // Set the scope type
                    this.#_ctx.data.set('type', 'error');
                    this.#_ctx.data.set(ERROR_CACHE_KEY, new ErrorCache(token, trailing));
                    continue;
                }

                case 'error-data': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const nameStart = new TOKENS.GroupStart;
                    error.track('name', nameStart.id);

                    const errData: Token[] = [];

                    errData.push(
                        nameStart,
                        PropertyToken.from(PropertyNode.create('name', 'property')),
                        new TOKENS.KeyValueSeparator,
                        new TOKENS.SoftSpace,
                        new TOKENS.Primitive('string', token.name)
                    );

                    if (token.message !== undefined) {
                        if (!error.isConsumed('name')) {
                            errData.push(
                                new TOKENS.Separator,
                                new TOKENS.SoftLine,
                                new TOKENS.GroupEnd(error.consume('name')!),
                            )
                        }

                        const msgStart = new TOKENS.GroupStart;
                        error.track('message', msgStart.id);

                        errData.push(
                            msgStart,
                            PropertyToken.from(PropertyNode.create('message', 'property')),
                            new TOKENS.KeyValueSeparator,
                            new TOKENS.SoftSpace,
                            new TOKENS.Primitive('string', token.message),
                        );
                    }

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'error-cause-start': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [];
                    for (const segmentName of ERROR_SECTIONS.filter(s => s === 'name' || s === 'message')) {
                        if (!error.isRegistered(segmentName) || error.isConsumed(segmentName)) {
                            continue;
                        }

                        errData.push(
                            new TOKENS.Separator,
                            new TOKENS.SoftLine,
                            new TOKENS.GroupEnd(error.consume(segmentName)!),
                        );
                    }

                    const causeStart = new TOKENS.GroupStart;
                    error.track('cause', causeStart.id);

                    errData.push(
                        causeStart,
                        PropertyToken.from(PropertyNode.create('cause', 'property')),
                        new TOKENS.KeyValueSeparator,
                        new TOKENS.SoftSpace,
                    );

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'error-cause-end': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [
                        new TOKENS.Separator,
                        new TOKENS.SoftLine,
                        new TOKENS.GroupEnd(error.consume('cause')!)
                    ];

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'stack-trace': {
                    if (token.ownership === 'error') {
                        if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                            throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                        }

                        const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                        if (error.errorId !== token.errorId) {
                            throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                        }

                        const errData: Token[] = [];
                        for (const segmentName of ERROR_SECTIONS.filter(s => s === 'name' || s === 'message')) {
                            if (!error.isRegistered(segmentName) || error.isConsumed(segmentName)) {
                                continue;
                            }

                            errData.push(
                                new TOKENS.Separator,
                                new TOKENS.SoftLine,
                                new TOKENS.GroupEnd(error.consume(segmentName)!),
                            );
                        }

                        const traceStart = new TOKENS.GroupStart;
                        error.track('stack', traceStart.id);

                        errData.push(
                            traceStart,
                            PropertyToken.from(PropertyNode.create('stack', 'property')),
                            new TOKENS.KeyValueSeparator,
                            new TOKENS.SoftSpace,
                            ...this.#_tokenize(token.lines)
                        );

                        this.#_ctx.tokens.inject(errData);
                    }

                    continue;
                }

                case 'error-end': {
                    if (!this.#_ctx.data.hasResolvable(ERROR_CACHE_KEY)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(ERROR_CACHE_KEY)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const errData: Token[] = [];
                    const segments = (ERROR_SECTIONS).map(sName => {
                        if (!error.isRegistered(sName) || error.isConsumed(sName)) {
                            return undefined
                        }

                        return { name: sName }
                    }).filter(s => s !== undefined);

                    for (let i = 0; i < segments.length; i++) {
                        const segment = segments[i];
                        const hasMore = i < segments.length - 1;

                        if (hasMore) {
                            errData.push(new TOKENS.Separator);
                        }

                        errData.push(
                            new TOKENS.SoftLine,
                            new TOKENS.GroupEnd(error.consume(segment!.name)!),
                        );
                    }

                    errData.push(
                        new TOKENS.IndentEnd,
                        ...error.closeTokens,
                        new TOKENS.Callback(() => this.#_ctx.scopes.commit())
                    );

                    this.#_ctx.tokens.inject(errData);
                    continue;
                }

                case 'callback': {
                    token.run();
                    continue;
                }

                default: {
                    throw new Error(`Invariant violation: Unknown token type: ${(token as any).kind}`);
                }
            }
        }

        if (!this.#_ctx.scopes.isRoot) {
            throw new Error('Invariant violation: Rendering ended at non-root scope. Rendering must end at the root scope.');
        }

        return this.#_ctx.writer.toString();
    }

    static render(tokens: readonly Token[], options: JsonOptions) {
        return new JSONRenderer(tokens, options).#_render();
    }
}

export default JSONRenderer;