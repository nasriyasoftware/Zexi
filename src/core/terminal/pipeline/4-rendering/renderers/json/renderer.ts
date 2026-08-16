import keys from "../../shared/keys";
import consoleStyler from "../../../../styling/styler";
import TOKENS from "../../../3-tokenization/tokens";
import JSONTokenizer from "../../../3-tokenization/tokenizers/json.tokenizer";
import JSONHelpers from "./helpers/helpers";
import ZexiRenderingContext from "../../shared/context/context";

import DataEnvelope from "../../shared/envelope/data.envelope";
import ErrorCache from "./assets/error.cache";
import ObjectCache from "./assets/object.cache";

import { resolveRendererConfig } from "../../shared/helpers";
import { deepFreeze, hasOwnProp, isRecord } from "../../../../../../utils/utils";

import type { AnsiColor } from "../../../../styling/types";
import type { Token } from "../../../3-tokenization/types";
import type { JSONConfig, JsonOptions, JSONPipelineFlags } from "./types";

/**
 * JSON rendering engine responsible for transforming a token stream
 * into a structured string output (or ANSI-enhanced output).
 *
 * ---------------------------------------------------------------------
 * 🔷 CORE RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * This renderer is the final stage of the JSON pipeline. It:
 *
 * - consumes a normalized token stream
 * - interprets structural and semantic tokens
 * - delegates layout decisions to a helper layer
 * - emits formatted output via a streaming writer
 *
 * It does NOT:
 *
 * - perform tokenization
 * - perform structural normalization
 * - mutate external state outside rendering context
 *
 * ---------------------------------------------------------------------
 * 🔷 PIPELINE ROLE
 * ---------------------------------------------------------------------
 *
 * Token flow:
 *
 *   Tokenizer → Normalizer → Layout Resolver → JSONRenderer → Output
 *
 * The renderer assumes all tokens are already normalized.
 *
 * ---------------------------------------------------------------------
 * 🔷 LAYOUT MODEL
 * ---------------------------------------------------------------------
 *
 * Rendering supports two modes:
 *
 * - `compact` → minimal formatting, no layout expansion
 * - `pretty`  → layout-aware rendering with indentation & wrapping
 *
 * Layout decisions are delegated to `JSONHelpers.resolveLayout()`.
 *
 * ---------------------------------------------------------------------
 * 🔷 STATE MANAGEMENT
 * ---------------------------------------------------------------------
 *
 * The renderer maintains:
 *
 * - a rendering context (ZexiRenderingContext)
 * - a writer for output accumulation
 * - pipeline flags for layout control
 * - ignored token registry
 *
 * These components collectively enforce deterministic rendering.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
class JSONRenderer {
    /**
     * Active rendering mode.
     *
     * Determines whether layout rules are applied.
     *
     * - `compact` → minimal output
     * - `pretty` → layout-aware structured output
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_mode: 'compact' | 'pretty' = 'compact';

    /**
     * Immutable renderer configuration derived from mode + options.
     *
     * Includes layout rules such as spacing and line-break strategy.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_config: JSONConfig;

    /**
     * Shared rendering context containing:
     *
     * - token stream iterator
     * - traversal depth
     * - scope stack
     * - shared metadata store
     * - writer instance
     *
     * This is the central execution state of the renderer.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Set of tokens excluded from rendering output.
     *
     * Used by transformation passes to suppress replaced or consumed tokens.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_ignoredTokens = new Set<Token>();

    /**
     * Helper layer for layout resolution and normalization utilities.
     *
     * Encapsulates:
     *
     * - layout resolution
     * - abort handling
     * - indentation restoration
     * - transformation orchestration
     * - envelope styling
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_helpers: JSONHelpers;

    /**
     * Shared pipeline flags controlling rendering behavior.
     *
     * These flags influence:
     *
     * - ANSI styling behavior
     * - layout escalation (inline → block)
     * - soft separator suppression
     * - group-level abort handling
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_flags: JSONPipelineFlags = {
        ansiEnabled: false,
        ignoreCurrentGroup: false,
        skipNextSeparator: false,
        skipNextSoftLine: false,
        forceNextGroupAsBlock: false
    }

    /**
     * Creates a new JSON renderer instance.
     *
     * ---------------------------------------------------------------------
     * 🔷 INITIALIZATION FLOW
     * ---------------------------------------------------------------------
     *
     * 1. Validate options
     * 2. Resolve rendering mode
     * 3. Build configuration
     * 4. Initialize rendering context
     * 5. Initialize helper subsystem
     * 6. Freeze configuration
     *
     * ---------------------------------------------------------------------
     * 🔷 CONTEXT INITIALIZATION
     * ---------------------------------------------------------------------
     *
     * The rendering context is initialized with:
     *
     * - token stream
     * - indentation spacing
     * - optional max width constraint
     *
     * This context is shared across all rendering subsystems.
     *
     * ---------------------------------------------------------------------
     * @param tokens
     * Input token stream produced by the tokenizer.
     *
     * @param options
     * Rendering configuration:
     *
     * - `mode` → compact | pretty
     * - `ansiEnabled` → enables ANSI styling
     * - `spaces` → indentation size (pretty mode only)
     * - `maxWidth` → line width constraint (pretty mode only)
     *
     * @throws TypeError
     * If options are invalid or incorrectly typed.
     *
     * @throws RangeError
     * If numeric constraints (spaces/maxWidth) are violated.
     *
     * @throws Error
     * If configuration is incompatible with mode.
     *
     * @since 1.0.0
     */
    constructor(
        tokens: readonly Token[],
        options: JsonOptions
    ) {
        if (options !== undefined) {
            if (!isRecord(options as object)) {
                throw new TypeError(`Expected options to be an object, but got ${typeof options}`);
            }

            if (hasOwnProp(options, 'mode')) {
                if (typeof options.mode !== 'string') {
                    throw new TypeError(`Expected mode to be a string, but got ${typeof options.mode}`);
                }

                const knownModes: JsonOptions['mode'][] = ['compact', 'pretty'];
                if (!knownModes.includes(options.mode)) {
                    throw new TypeError(`Expected mode to be one of ${knownModes}, but got ${options.mode}`);
                }
            }

            if (hasOwnProp(options, 'ansiEnabled')) {
                if (typeof options.ansiEnabled !== 'boolean') {
                    throw new TypeError(`Expected ansiEnabled to be a boolean, but got ${typeof options.ansiEnabled}`);
                }

                this.#_flags.ansiEnabled = options.ansiEnabled;
            }

            if (hasOwnProp(options, 'spaces')) {
                if (typeof options.spaces !== 'number') {
                    throw new TypeError(`Expected spaces to be a number, but got ${typeof options.spaces}`);
                }

                if (options.spaces < 0) {
                    throw new RangeError('Spaces must be greater than or equal to 0');
                }

                if (options.spaces > 8) {
                    throw new RangeError(`Spaces must be less than or equal to 8, got ${options.spaces}`);
                }
            }

            if (hasOwnProp(options, 'maxWidth')) {
                const mode = options?.mode ?? this.#_mode;
                if (mode !== 'pretty') {
                    throw new Error('maxWidth is only available in "pretty" mode');
                }

                if (typeof options.maxWidth !== 'number') {
                    throw new TypeError(`Expected maxWidth to be a number, but got ${typeof options.maxWidth}`);
                }

                if (options.maxWidth < 0) {
                    throw new RangeError('maxWidth must be greater than or equal to 0');
                }
            }
        }

        this.#_mode = options?.mode ?? this.#_mode;
        this.#_config = resolveRendererConfig('json', this.#_mode);

        this.#_config.spaces = options?.spaces ?? this.#_config.spaces;
        const maxWidth = options?.maxWidth ?? undefined;

        this.#_ctx = new ZexiRenderingContext(
            tokens,
            { spaces: this.#_config.spaces, maxWidth }
        );

        this.#_helpers = new JSONHelpers({
            ctx: this.#_ctx,
            flags: this.#_flags,
            ignoredTokens: this.#_ignoredTokens,
            mode: this.#_mode
        });

        Object.seal(this.#_flags);
        deepFreeze(this.#_config);
    }

    /**
     * Internal rendering loop that consumes the token stream.
     *
     * ---------------------------------------------------------------------
     * 🔷 EXECUTION MODEL
     * ---------------------------------------------------------------------
     *
     * This method processes tokens sequentially in a single pass:
     *
     * - reads tokens from context iterator
     * - applies transformation rules per token type
     * - injects or replaces tokens when required
     * - writes output via rendering writer
     *
     * ---------------------------------------------------------------------
     * 🔷 CONTROL FLOW MODEL
     * ---------------------------------------------------------------------
     *
     * Each token may:
     *
     * - produce direct output (primitive, separator)
     * - mutate context (group, indent, scope)
     * - trigger structural rewrite (envelopes, regex, functions)
     * - abort rendering and restart layout (inline → block)
     *
     * ---------------------------------------------------------------------
     * 🔷 STATEFUL BEHAVIOR
     * ---------------------------------------------------------------------
     *
     * The renderer maintains multiple mutable subsystems:
     *
     * - token stream cursor
     * - scope stack
     * - depth tracking
     * - layout decisions
     * - ignored token registry
     *
     * ---------------------------------------------------------------------
     * 🔷 SAFETY INVARIANT
     * ---------------------------------------------------------------------
     *
     * Rendering MUST end in root scope.
     *
     * If scopes remain open, rendering is considered invalid.
     *
     * @returns
     * Fully rendered string output.
     *
     * @throws Error
     * If rendering ends in a non-root scope.
     *
     * @internal
     */
    #_render() {
        rendering: while (this.#_ctx.tokens.hasNext()) {
            const token = this.#_ctx.tokens.next()!;

            if (this.#_ignoredTokens.has(token)) {
                this.#_ignoredTokens.delete(token);
                continue rendering;
            }

            if (this.#_flags.ignoreCurrentGroup) {
                const currentGroup = this.#_ctx.data.get<symbol>(keys.GROUP);

                if (token.kind === 'group-end' && token.groupId === currentGroup) {
                    this.#_helpers.restoreDepth();
                    this.#_ctx.scopes.commit();
                    this.#_flags.ignoreCurrentGroup = false;
                }

                continue rendering;
            }

            switch (token.kind) {
                case 'group-start': {
                    this.#_ctx.scopes.begin({ id: token.id });

                    if (this.#_flags.forceNextGroupAsBlock) {
                        this.#_ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });
                        this.#_flags.forceNextGroupAsBlock = false;
                    } else {
                        if (!this.#_ctx.data.hasOwn(keys.RENDERING_LAYOUT)) {
                            const layout = this.#_helpers.resolveLayout();
                            this.#_ctx.data.set(keys.RENDERING_LAYOUT, layout);
                        }
                    }

                    this.#_ctx.data.set(keys.GROUP, token.id);
                    this.#_ctx.data.set(keys.GROUP_DEPTH, this.#_ctx.depth.value);

                    continue rendering;
                }

                case 'group-end': {
                    this.#_ctx.scopes.commit();
                    continue rendering;
                }

                case 'anchor':
                case 'ansi':
                case 'reference-start':
                case 'reference-end': continue rendering;

                case 'date': {
                    const newToken = new TOKENS.Primitive('string', token.value.toISOString());

                    if (this.#_flags.ansiEnabled) {
                        newToken.ansi.assign(
                            'color',
                            consoleStyler.ansi.color.fg.normal.cyan,
                            'primitive.date'
                        );
                    }

                    this.#_ctx.tokens.inject(newToken);
                    continue rendering;
                }

                case 'function': {
                    this.#_ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });

                    const funcName = token.value.name ?? 'anonymous';
                    const envelope = new DataEnvelope('function', { name: funcName });

                    const result = envelope.tokenize(JSONTokenizer);

                    if (this.#_flags.ansiEnabled) {
                        this.#_helpers.highlightEnvelope(result.tokens);

                        const funcToken = result.tokens.find(t => t.kind === 'primitive' && t.value === funcName)! as InstanceType<typeof TOKENS.Primitive>;
                        funcToken.ansi.assign(
                            'color',
                            consoleStyler.ansi.color.fg.bright.green,
                            'function.name'
                        );
                    }

                    this.#_ctx.tokens.inject(result.tokens);
                    continue rendering;
                }

                case 'indent-start': {
                    this.#_ctx.depth.increase();
                    continue rendering;
                }

                case 'indent-end': {
                    this.#_ctx.depth.decrease();
                    continue rendering;
                }

                case 'primitive': {
                    if (
                        token.value === undefined &&
                        this.#_ctx.data.get(keys.OBJECT) === 'Array'
                    ) {
                        this.#_flags.skipNextSeparator = true;
                        this.#_flags.skipNextSoftLine = true;
                        continue rendering;
                    }

                    let contentToWrite = '';
                    extractingContent: switch (token.type) {
                        case 'boolean': {
                            contentToWrite = token.value ? 'true' : 'false';

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.normal.blue,
                                    'primitive.boolean'
                                );
                            }

                            break extractingContent;
                        }

                        case 'null': {
                            contentToWrite = 'null';

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.bright.blue,
                                    'primitive.null'
                                );
                            }

                            break extractingContent;
                        }

                        case 'undefined': {
                            contentToWrite = 'undefined';

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.bright.black,
                                    'primitive.undefined'
                                );
                            }

                            break extractingContent;
                        }

                        case 'bigint': {
                            contentToWrite = String(token.value);

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.bright.yellow,
                                    'primitive.bigint'
                                );
                            }

                            break extractingContent;
                        }

                        case 'number': {
                            contentToWrite = String(token.value);

                            if (
                                !this.#_ctx.scopes.isRoot &&
                                (
                                    token.value === Infinity ||
                                    token.value === -Infinity ||
                                    isNaN(token.value as number)
                                )
                            ) {
                                if (this.#_helpers.getLayout({ ofParent: true }) === 'inline') {

                                    const isObjectValue = this.#_ctx.tokens.peek(-2)?.kind === 'key-value-separator';
                                    this.#_helpers.forceBlock();

                                    if (isObjectValue) {
                                        this.#_helpers.forceBlock();
                                    }
                                    continue rendering;
                                }

                                this.#_ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });
                                const env = new DataEnvelope('number', { value: contentToWrite });
                                const result = env.tokenize(JSONTokenizer);
                                this.#_helpers.highlightEnvelope(result.tokens);

                                this.#_ctx.tokens.inject(result.tokens);
                                continue rendering;
                            }

                            if (this.#_flags.ansiEnabled) {
                                let color: AnsiColor
                                if (token.value === Infinity || token.value === -Infinity) {
                                    color = consoleStyler.ansi.color.fg.bright.yellow;
                                } else {
                                    color = consoleStyler.ansi.color.fg.normal.yellow;
                                }

                                token.ansi.assign('color', color, 'primitive.number');
                            }

                            break extractingContent;
                        }

                        case 'string': {
                            contentToWrite = this.#_ctx.scopes.isRoot
                                ? token.value as string
                                : JSON.stringify(token.value);

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.normal.green,
                                    'primitive.string'
                                );
                            }

                            break extractingContent;
                        }

                        case 'symbol': {
                            contentToWrite = String(token.value)

                            if (this.#_flags.ansiEnabled) {
                                token.ansi.assign(
                                    'color',
                                    consoleStyler.ansi.color.fg.bright.magenta,
                                    'primitive.symbol'
                                )
                            }

                            break extractingContent;
                        }
                    }

                    const layout = this.#_helpers.getLayout();
                    if (layout && layout === 'inline') {
                        if (!this.#_ctx.writer.canFitInline(contentToWrite)) {
                            this.#_helpers.resolvePrimitiveOverflow();
                            continue rendering;
                        }
                    }

                    const final = this.#_flags.ansiEnabled ? consoleStyler.format(contentToWrite, {
                        color: token.ansi.color || undefined,
                        bgColor: token.ansi.bgColor || undefined,
                        style: token.ansi.styles
                    }) : contentToWrite;

                    this.#_ctx.writer.write(final);
                    continue rendering;
                }

                case 'separator': {
                    if (this.#_flags.skipNextSeparator) {
                        this.#_flags.skipNextSeparator = false;
                        continue rendering;
                    }

                    this.#_ctx.writer.write(token.value);
                    continue rendering;
                }

                case 'hard-line': {
                    this.#_ctx.writer.newLine();
                    continue rendering;
                }

                case 'soft-line': {
                    if (this.#_flags.skipNextSoftLine) {
                        this.#_flags.skipNextSoftLine = false;
                        continue rendering;
                    }

                    const objType = this.#_mode === 'pretty' ? this.#_ctx.data.get<string>(keys.OBJECT) : null;

                    if (objType) {
                        if (objType === 'Array') {
                            const layout = this.#_helpers.getLayout();
                            const isFirstSpace = this.#_ctx.tokens.peek(-1)?.kind === 'object-open';
                            const isLastSpace = !isFirstSpace && this.#_ctx.tokens.peek()?.kind === 'object-close';

                            if (layout === 'inline') {
                                if (isFirstSpace || isLastSpace) {
                                    continue rendering;
                                }

                                this.#_ctx.writer.write(' ');
                            } else {
                                // Block layout
                                if (isFirstSpace || isLastSpace) {
                                    this.#_ctx.writer.newLine();
                                    continue rendering;
                                }

                                if (
                                    this.#_ctx.tokens.peek()?.kind === 'primitive' &&
                                    this.#_ctx.writer.canFitInline(' ')
                                ) {
                                    this.#_ctx.writer.write(' ');
                                    continue rendering;
                                }

                                this.#_ctx.writer.newLine();
                            }

                            continue rendering;
                        }
                    }

                    const isParentAnArray = this.#_ctx.data.getInherited(keys.OBJECT) === 'Array';
                    const layout = this.#_helpers.getLayout({ ofParent: !isParentAnArray });

                    if (layout === 'inline') {
                        this.#_ctx.writer.write(' ');
                    } else {
                        if (
                            this.#_config.layout.lineBreaks === 'soft' ||
                            this.#_config.layout.lineBreaks === 'strict'
                        ) {
                            this.#_ctx.writer.newLine();
                        }
                    }

                    continue rendering;
                }

                case 'hard-space': {
                    this.#_ctx.writer.write(' ');
                    continue rendering;
                }

                case 'soft-space': {
                    if (
                        this.#_config.layout.spaces === 'preserve' ||
                        this.#_config.layout.spaces === 'normalize'
                    ) {
                        this.#_ctx.writer.write(' ');
                    }

                    continue rendering;
                }

                case 'key-value-separator': {
                    this.#_ctx.writer.write(token.value);
                    continue rendering;
                }

                case 'soft-wrap': {
                    if (this.#_config.layout.lineBreaks === 'soft') {
                        this.#_ctx.writer.newLine();
                    }
                    continue rendering;
                }

                case 'regex': {
                    this.#_ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });

                    const regex = token.value;
                    const envelope = new DataEnvelope('regex', {
                        pattern: regex.source,
                        flags: regex.flags
                    });

                    const result = envelope.tokenize(JSONTokenizer);

                    if (this.#_flags.ansiEnabled) {
                        this.#_helpers.highlightEnvelope(result.tokens);
                        const findTokens = () => {
                            let srcToken: InstanceType<typeof TOKENS.Primitive> | undefined;
                            let flagsToken: InstanceType<typeof TOKENS.Primitive> | undefined;
                            const isDone = () => !!srcToken && !!flagsToken;

                            scanning: for (const t of result.tokens) {
                                if (isDone()) { break scanning; }
                                if (t.kind !== 'primitive') { continue scanning; }

                                if (!srcToken && t.value === regex.source) {
                                    srcToken = t;
                                    continue scanning;
                                }

                                if (!flagsToken && t.value === regex.flags) {
                                    flagsToken = t;
                                    continue scanning;
                                }
                            }

                            return { srcToken, flagsToken };
                        }

                        const { srcToken, flagsToken } = findTokens();

                        srcToken!.ansi.assign(
                            'color',
                            consoleStyler.ansi.color.fg.bright.magenta,
                            'regex.source'
                        );

                        flagsToken!.ansi.assign(
                            'color',
                            consoleStyler.ansi.color.fg.bright.cyan,
                            'regex.flags'
                        );
                    }

                    this.#_ctx.tokens.inject(result.tokens);
                    continue rendering;
                }

                case 'property': {
                    if (token.type !== 'property') {
                        this.#_helpers.ignoreCurrentGroup();
                        continue rendering;
                    }

                    const objectCache = this.#_ctx.data.get<ObjectCache>(keys.OBJECT_CACHE);
                    if (!objectCache) {
                        throw new Error(`Invariant violation: Attempting to render a property without an object cache`);
                    }

                    if (objectCache.shouldRemoveTrailing(token)) {
                        const anchor = new TOKENS.Anchor('remove-trailing');
                        const cb = new TOKENS.Callback(() => {
                            this.#_flags.skipNextSeparator = true;
                            this.#_flags.skipNextSoftLine = true;
                        });

                        // Find the index of the closing group token
                        // and insert the callback 2 tokens before that index
                        const injectAnchor = () => {
                            const cursor = this.#_ctx.tokens.cursor;
                            const groups = { opened: 1, closed: 0 };
                            let scanned = 0;

                            let item = this.#_ctx.tokens.peek(++scanned);

                            scanning: do {
                                try {
                                    if (!item) { break scanning; }

                                    switch (item.kind) {
                                        case 'group-start': {
                                            groups.opened++;
                                            continue scanning;
                                        }

                                        case 'group-end': {
                                            groups.closed++;
                                            if (groups.opened === groups.closed) {
                                                const closingIndex = cursor + scanned;

                                                this.#_ctx.tokens.inject(anchor, { at: closingIndex - 2 });
                                                break scanning;
                                            }

                                            continue scanning;
                                        }
                                    }
                                } finally {
                                    scanned++;
                                    item = this.#_ctx.tokens.peek(scanned);
                                }
                            } while (item);
                        }

                        injectAnchor();
                        this.#_ctx.tokens.inject(cb, { at: anchor });
                    }

                    if (objectCache.isIgnored(token)) {
                        this.#_helpers.ignoreCurrentGroup();
                        continue rendering;
                    }

                    this.#_ctx.writer.write(JSON.stringify(token.value));
                    continue rendering;
                }

                case 'object-name': {
                    const is = {
                        set: token.className === 'Set',
                        map: token.className === 'Map',
                        array: token.className === 'Array',
                        literal: !token.className,
                        get custom(): boolean {
                            return (
                                !this.literal &&
                                !(
                                    this.set ||
                                    this.map ||
                                    this.array
                                )
                            )
                        }
                    }

                    // handle objects (literals)
                    if (is.literal || is.custom) {
                        this.#_ctx.data.set(keys.OBJECT, 'Object');
                        this.#_helpers.transforms.object();
                        continue rendering;
                    }

                    if (is.array) {
                        this.#_ctx.data.set(keys.OBJECT, 'Array');
                        continue rendering;
                    }

                    if (is.set || is.map) {
                        if (is.set) {
                            this.#_ctx.data.set(keys.OBJECT, 'Set');
                            this.#_helpers.transforms.set();
                        } else if (is.map) {
                            this.#_ctx.data.set(keys.OBJECT, 'Map');
                            this.#_helpers.transforms.map();
                        }

                        continue rendering;
                    }

                    continue rendering;
                }

                case 'object-open':
                case 'object-close': {
                    this.#_ctx.writer.write(token.token)
                    continue rendering;
                }

                case 'error-start': {
                    // this.#_ctx.data.set(keys.RENDERING_LAYOUT, 'block', { overwrite: true });
                    this.#_ctx.scopes.begin({ id: token.id });

                    const envelop = new DataEnvelope('error', {});
                    const result = envelop.tokenize(JSONTokenizer);
                    this.#_helpers.highlightEnvelope(result.tokens.start);

                    // Set the scope type
                    this.#_ctx.data.set('type', 'error');
                    this.#_ctx.data.set(keys.ERROR_CACHE, new ErrorCache(token, result));

                    continue rendering;
                }

                case 'error-data': {
                    if (!this.#_ctx.data.hasOwn(keys.ERROR_CACHE)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    // Set the error name
                    error.set('name', token.name);

                    if (token.message) {
                        // Set the error message
                        error.set('message', token.message);
                    }

                    continue rendering;
                }

                case 'error-cause-start': {
                    if (!this.#_ctx.data.hasOwn(keys.ERROR_CACHE)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const causeTokens: Token[] = (() => {
                        const output: Token[] = [];
                        let index = 0;

                        const hasNext = () => {
                            const item = this.#_ctx.tokens.peek(index + 1);
                            if (!item) { return false }

                            this.#_ignoredTokens.add(item);
                            if (
                                item.kind === 'error-cause-end' &&
                                item.errorId === token.errorId &&
                                item.causeId === token.id
                            ) {
                                return false;
                            }

                            return true;
                        }

                        const next = () => {
                            if (!hasNext()) {
                                return null;
                            }

                            return this.#_ctx.tokens.peek(++index)!;
                        }

                        while (hasNext()) {
                            output.push(next()!);
                        }

                        return output;
                    })();

                    // Set the error cause
                    error.set('cause', causeTokens);

                    continue rendering;
                }

                case 'error-cause-end': {
                    // Handled in error-cause-start
                    continue rendering;
                }

                case 'stack-trace': {
                    if (token.ownership === 'error') {
                        if (!this.#_ctx.data.hasOwn(keys.ERROR_CACHE)) {
                            throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                        }

                        const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE)!;
                        if (error.errorId !== token.errorId) {
                            throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                        }

                        // Set the error stack trace
                        error.set('stack', token.lines);
                    }

                    continue rendering;
                }

                case 'error-end': {
                    if (!this.#_ctx.data.hasOwn(keys.ERROR_CACHE)) {
                        throw new Error(`Invariant violation: Attempting to render error data outside of an error scope.`);
                    }

                    const error = this.#_ctx.data.get<ErrorCache>(keys.ERROR_CACHE)!;
                    if (error.errorId !== token.errorId) {
                        throw new Error(`Invariant violation: Attempting to render error data for a different error scope.`);
                    }

                    const generated = error.generateTokens(JSONTokenizer);

                    // Inject error tokens
                    this.#_ctx.tokens.inject(generated, { at: this.#_ctx.tokens.cursor + 2 });

                    // Closing the error scope
                    this.#_ctx.scopes.commit();
                    continue rendering;
                }

                case 'callback': {
                    token.run();
                    continue rendering;
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

    /**
     * Static entry point for JSON rendering.
     *
     * Creates a renderer instance and executes the full render pipeline.
     *
     * ---------------------------------------------------------------------
     * 🔷 USAGE MODEL
     * ---------------------------------------------------------------------
     *
     * This is the primary public API for JSON rendering:
     *
     * ```ts
     * JSONRenderer.render(tokens, options)
     * ```
     *
     * It is equivalent to:
     *
     * ```ts
     * new JSONRenderer(tokens, options).render()
     * ```
     *
     * ---------------------------------------------------------------------
     * @param tokens
     * Token stream to render.
     *
     * @param options
     * Renderer configuration.
     *
     * @returns
     * Final rendered JSON string.
     *
     * @since 1.0.0
     */
    static render(tokens: readonly Token[], options: JsonOptions) {
        return new JSONRenderer(tokens, options).#_render();
    }
}

export default JSONRenderer;