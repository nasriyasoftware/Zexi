import path from "path";
import keys from "../../shared/keys";
import consoleStyler from "../../../../styling/styler";
import TOKENS from "../../../3-tokenization/tokens";
import DebugHelpers from "./helpers";
import ZexiRenderingContext from "../../shared/context/context";

import { resolveRendererConfig } from "../../shared/helpers";
import { deepFreeze, hasOwnProp, isRecord } from "../../../../../../utils/utils";

import type { Token } from "../../../3-tokenization/types";
import type { DebugConfig, DebugOptions, DebugPipelineFlags } from "./types";

class DebugRenderer {
    /**
     * Active rendering mode.
     *
     * Determines whether layout rules are applied to the rendered output.
     *
     * - `compact` → minimizes structural line breaks and layout processing
     * - `pretty` → applies layout-aware formatting and structural indentation
     *
     * The mode is resolved from the supplied renderer options during
     * construction and remains immutable for the lifetime of the renderer.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_mode: 'compact' | 'pretty' = 'pretty';

    /**
     * Immutable renderer configuration derived from the selected mode
     * and renderer options.
     *
     * The configuration contains the resolved formatting rules used during
     * rendering, including:
     *
     * - indentation width
     * - spacing behavior
     * - line-break behavior
     * - cyclic reference policy
     *
     * Configuration is resolved once during construction and frozen before
     * rendering begins.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_config: DebugConfig;

    /**
     * Rendering execution context.
     *
     * Maintains the mutable state shared by the rendering pipeline,
     * including:
     *
     * - token stream traversal
     * - traversal depth
     * - rendering scope stack
     * - shared rendering metadata
     * - output writer
     *
     * The context is mutated throughout rendering as tokens are consumed,
     * groups are entered and exited, and layout decisions are applied.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_ctx: ZexiRenderingContext;

    /**
     * Helper facade for renderer-specific layout and pipeline operations.
     *
     * Delegates shared rendering behavior such as:
     *
     * - token visibility
     * - layout resolution
     * - group abortion
     * - block-layout promotion
     * - primitive-overflow resolution
     * - depth restoration
     * - group suppression
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_helpers: DebugHelpers;

    /**
     * Mutable flags controlling renderer execution state.
     *
     * Flags coordinate transient rendering decisions across tokens,
     * including:
     *
     * - ANSI styling enablement
     * - suppression of the current group
     * - forcing the next group into block layout
     *
     * The flag object is sealed after initialization so that the renderer
     * may mutate existing state without allowing new flags to be introduced.
     *
     * @internal
     * @since 1.0.0
     */
    readonly #_flags: DebugPipelineFlags = {
        ansiEnabled: false,
        ignoreCurrentGroup: false,
        forceNextGroupAsBlock: false
    }

    /**
     * Creates a debug renderer for a token stream.
     *
     * The constructor validates the supplied renderer options, resolves
     * the effective debug configuration, initializes the rendering context,
     * and creates the helper facade used during execution.
     *
     * Supported options are validated before rendering begins:
     *
     * - `mode` must be `compact` or `pretty`
     * - `cycles` must be `ignore`, `mark`, or `throw`
     * - `spaces` must be between `0` and `8`, inclusive
     * - `ansiEnabled` must be boolean when provided
     *
     * Renderer configuration is resolved from the selected mode and then
     * overridden by explicitly supplied options. The resulting
     * configuration is immutable for the lifetime of the renderer.
     *
     * @param tokens
     * Token stream produced by the tokenization pipeline.
     *
     * @param options
     * Debug rendering options controlling layout, cyclic reference handling,
     * indentation, and ANSI styling.
     *
     * @throws TypeError
     * If `options` is not an object.
     *
     * @throws TypeError
     * If `mode` is not a string.
     *
     * @throws TypeError
     * If `cycles` is not a string.
     *
     * @throws TypeError
     * If `spaces` is not a number.
     *
     * @throws TypeError
     * If `ansiEnabled` is not a boolean.
     *
     * @throws RangeError
     * If `mode` is not a supported rendering mode.
     *
     * @throws RangeError
     * If `cycles` is not a supported circular-reference policy.
     *
     * @throws RangeError
     * If `spaces` is outside the supported range.
     *
     * @since 1.0.0
     */
    constructor(
        tokens: readonly Token[],
        options: DebugOptions
    ) {
        if (options !== undefined) {
            if (!isRecord(options as object)) {
                throw new TypeError(`Expected options to be an object, but got ${typeof options}`);
            }

            if (hasOwnProp(options, 'mode')) {
                if (typeof options.mode !== 'string') {
                    throw new TypeError(`Expected mode to be a string, but got ${typeof options.mode}`);
                }

                const knownModes = ['compact', 'pretty'];
                if (!knownModes.includes(options.mode)) {
                    throw new TypeError(`Expected mode to be one of ${knownModes}, but got ${options.mode}`);
                }
            }

            if (hasOwnProp(options, 'cycles')) {
                if (typeof options.cycles !== 'string') {
                    throw new TypeError(`Expected 'cycles' to be a string, but got ${typeof options.cycles}`);
                }

                const supported = ['ignore', 'mark', 'throw'];
                if (!supported.includes(options.cycles)) {
                    throw new RangeError(`Invalid 'cycles' value: ${options.cycles}. Supported values are: ${supported.join(', ')}`);
                }
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

            if (hasOwnProp(options, 'ansiEnabled')) {
                if (typeof options.ansiEnabled !== 'boolean') {
                    throw new TypeError(`Expected ansiEnabled to be a boolean, but got ${typeof options.ansiEnabled}`);
                }

                this.#_flags.ansiEnabled = options.ansiEnabled;
            }
        }

        this.#_mode = options?.mode ?? this.#_mode;
        this.#_config = resolveRendererConfig('debug', this.#_mode);
        this.#_config.spaces = options?.spaces ?? this.#_config.spaces;

        this.#_ctx = new ZexiRenderingContext(
            tokens,
            {
                spaces: this.#_config.spaces,
                maxWidth: 150
            }
        );

        this.#_helpers = new DebugHelpers({
            ctx: this.#_ctx,
            flags: this.#_flags,
            mode: this.#_mode
        });

        Object.seal(this.#_flags);
        deepFreeze(this.#_config);
    }

    /**
     * Executes the debug rendering pipeline.
     *
     * Tokens are consumed sequentially and translated into diagnostic
     * output according to the resolved debug configuration.
     *
     * The rendering loop is responsible for:
     *
     * - entering and leaving rendering groups
     * - resolving inline and block layouts
     * - handling cyclic references according to the configured policy
     * - rendering dates, functions, regular expressions, and primitives
     * - applying indentation and line-break rules
     * - rendering error information and stack traces
     * - applying optional ANSI styling
     * - handling layout fallbacks caused by primitive overflow
     *
     * Pretty rendering uses the active layout strategy to determine how
     * structural boundaries and soft lines are represented. Compact
     * rendering minimizes layout expansion where possible.
     *
     * Cyclic references are handled according to {@link DebugConfig.cycles}:
     *
     * - `ignore` replaces the reference with `null`
     * - `mark` renders an explicit reference marker
     * - `throw` aborts rendering when a cycle is encountered
     *
     * Rendering must terminate at the root scope. Reaching the end of the
     * token stream while a nested scope remains active indicates an
     * inconsistent token stream or corrupted rendering state and results
     * in an invariant violation.
     *
     * @returns
     * The fully rendered debug output.
     *
     * @throws Error
     * If rendering ends while a non-root scope remains active.
     *
     * @internal
     * @since 1.0.0
     */
    #_render() {
        rendering: while (this.#_ctx.tokens.hasNext()) {
            const token = this.#_ctx.tokens.next()!;

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

                case 'reference-start':
                case 'reference-end':
                case 'anchor':
                case 'ansi': {
                    continue rendering;
                }

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
                    const parts = (token.value.name || 'anonymous').split(' ');

                    const funcName = parts.length > 1 ? parts[1] : parts[0];
                    const funcType = parts.length > 1 ? parts[0] : null;

                    const funcLabel = funcType
                        ? (funcType === 'get' ? 'Getter' : 'Setter')
                        : 'Function';

                    const content = this.#_flags.ansiEnabled ? [
                        `[${consoleStyler.color(funcLabel, consoleStyler.ansi.color.fg.normal.cyan)}:`,
                        consoleStyler.color(funcName, consoleStyler.ansi.color.fg.normal.cyan),
                        ']'
                    ].join('') : `[${funcLabel}:${funcName}]`;

                    this.#_ctx.writer.write(content);
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

                            if (this.#_flags.ansiEnabled) {
                                const color = token.value === Infinity || token.value === -Infinity
                                    ? consoleStyler.ansi.color.fg.bright.yellow
                                    : consoleStyler.ansi.color.fg.normal.yellow;

                                token.ansi.assign('color', color, 'primitive.number');
                            }

                            break extractingContent;
                        }

                        case 'string': {
                            contentToWrite = this.#_ctx.scopes.isRoot || (this.#_ctx.data.hasOwn('type') && this.#_ctx.data.get('type') === 'error')
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
                    this.#_ctx.writer.write(token.value);
                    continue rendering;
                }

                case 'hard-line': {
                    this.#_ctx.writer.newLine();
                    continue rendering;
                }

                case 'soft-line': {
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
                    // if (
                    //     this.#_config.layout.lineBreaks === 'soft' ||
                    //     this.#_config.layout.lineBreaks === 'strict'
                    // ) {
                    //     this.#_ctx.writer.newLine();
                    // }

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
                    const content = this.#_flags.ansiEnabled ? [
                        '[RegExp:',
                        consoleStyler.color(`/${token.value.source}/`, consoleStyler.ansi.color.fg.normal.magenta),
                        token.value.flags ? consoleStyler.color(token.value.flags, consoleStyler.ansi.color.fg.normal.cyan) : '',
                        ']'
                    ].join('') : `[RegExp:/${token.value.source}/${token.value.flags}]`;

                    this.#_ctx.writer.write(content);
                    continue rendering;
                }

                case 'property': {
                    this.#_ctx.writer.write(JSON.stringify(token.value));
                    continue rendering;
                }

                case 'object-name': {
                    this.#_ctx.writer.write(token.className && token.className !== 'Array' ? token.className : '');

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
                        continue rendering;
                    }

                    if (is.array) {
                        this.#_ctx.data.set(keys.OBJECT, 'Array');
                        continue rendering;
                    }

                    if (is.set || is.map) {
                        if (is.set) {
                            this.#_ctx.data.set(keys.OBJECT, 'Set');
                        } else if (is.map) {
                            this.#_ctx.data.set(keys.OBJECT, 'Map');
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
                    // Set the scope type
                    this.#_ctx.data.set('type', 'error');
                    if (this.#_mode === 'pretty') {
                        this.#_ctx.writer.write(
                            consoleStyler.color(
                                '='.repeat(50),
                                consoleStyler.ansi.color.fg.normal.red
                            ), { newLine: this.#_ctx.depth.value > 0 }
                        );
                    }

                    // this.#_ctx.writer.newLine();
                    continue rendering;
                }

                case 'error-data': {
                    const content = this.#_flags.ansiEnabled ? [
                        consoleStyler.format(token.name, { color: consoleStyler.ansi.color.fg.normal.red, style: 'bold' }),
                        token.message ? consoleStyler.color(`: ${token.message}`, consoleStyler.ansi.color.fg.normal.red) : ''
                    ].join('') : `${token.name}${token.message ? `: ${token.message}` : ''}`;

                    this.#_ctx.writer.write(content, { newLine: this.#_mode === 'pretty' });
                    continue rendering;
                }

                case 'error-cause-start': {
                    if (this.#_mode === 'pretty') {
                        this.#_ctx.depth.increase();
                        this.#_ctx.writer.write(consoleStyler.format('Caused by:', { style: ['bold', 'underline'] }), { newLine: true });
                        this.#_ctx.writer.newLine();
                    } else {
                        while (this.#_ctx.tokens.hasNext()) {
                            const nextToken = this.#_ctx.tokens.next()!;
                            if (nextToken.kind === 'error-cause-end' && nextToken.errorId === token.errorId) {
                                break;
                            }
                        }
                    }

                    continue rendering;
                }

                case 'error-cause-end': {
                    this.#_ctx.depth.decrease();
                    this.#_ctx.writer.newLine();

                    continue rendering;
                }

                case 'error-end': {
                    if (this.#_mode === 'pretty') {
                        this.#_ctx.writer.write(
                            consoleStyler.color(
                                '='.repeat(50),
                                consoleStyler.ansi.color.fg.normal.red
                            ),
                            { newLine: true }
                        );
                    }
                    continue rendering;
                }

                case 'stack-trace': {
                    this.#_ctx.depth.increase();

                    try {
                        if (token.ownership === 'error') {
                            if (this.#_mode === 'compact') {
                                continue rendering;
                            }

                            this.#_ctx.writer.write(consoleStyler.format('Stack Trace:', { style: ['bold', 'underline'] }), { newLine: true });
                        }

                        for (const line of token.lines) {
                            if (this.#_flags.ansiEnabled) {
                                const content = [
                                    consoleStyler.color('- at', consoleStyler.ansi.color.fg.bright.black),
                                    line.type === 'file' ? undefined : `(${line.type})`,
                                    line.functionName ? consoleStyler.format(line.functionName, { color: consoleStyler.ansi.color.fg.normal.cyan, style: 'underline' }) : ''
                                ].filter(Boolean);

                                // Style the location
                                const extSource = `${process.cwd()}${path.sep}`;
                                const intSource = line.source.startsWith(extSource) ? line.source.slice(extSource.length) : line.source;

                                const source = [
                                    consoleStyler.format(extSource, { color: consoleStyler.ansi.color.fg.normal.cyan, style: 'dim' }),
                                    consoleStyler.color(intSource, consoleStyler.ansi.color.fg.normal.cyan),
                                ].join('');

                                const location = [
                                    source,
                                    consoleStyler.color(line.line.toString(), consoleStyler.ansi.color.fg.normal.yellow),
                                    consoleStyler.format(line.column.toString(), { color: consoleStyler.ansi.color.fg.normal.yellow, style: 'dim' })
                                ].join(consoleStyler.format(':', { color: consoleStyler.ansi.color.fg.bright.black }));

                                content.push(location);

                                this.#_ctx.writer.write(content.filter(Boolean).join(' '), { newLine: true });
                            } else {
                                const content = [
                                    '- at',
                                    `(${line.type})`,
                                    line.functionName ? line.functionName : '',
                                    `${line.source}:${line.line}:${line.column}`
                                ].filter(Boolean).join(' ');

                                this.#_ctx.writer.write(content, { newLine: true });
                            }
                        }
                    } finally {
                        // Reset layout
                        this.#_ctx.depth.decrease();
                    }

                    continue rendering;
                }
            }
        }

        if (!this.#_ctx.scopes.isRoot) {
            throw new Error('Invariant violation: Rendering ended at non-root scope. Rendering must end at the root scope.');
        }

        return this.#_ctx.writer.toString();
    }

    /**
     * Renders a token stream using the debug renderer.
     *
     * This is the primary entry point for debug rendering. A renderer
     * instance is created for the supplied token stream and options, and
     * the complete token stream is rendered according to the resolved
     * configuration.
     *
     * Debug rendering is intended for diagnostic and inspection output
     * rather than strict serialization. It therefore preserves information
     * that may not be representable as standard JSON, including:
     *
     * - functions
     * - symbols
     * - special numeric values
     * - regular expressions
     * - cyclic references
     * - error metadata and stack traces
     *
     * @param tokens
     * Token stream produced by the tokenization pipeline.
     *
     * @param options
     * Debug rendering options.
     *
     * @returns
     * The rendered debug representation of the token stream.
     *
     * @throws TypeError
     * If the supplied options contain invalid values.
     *
     * @throws RangeError
     * If a supplied option is outside its supported range or set of values.
     *
     * @throws Error
     * If rendering terminates with an inconsistent scope state.
     *
     * @since 1.0.0
     */
    static render(tokens: readonly Token[], options: DebugOptions) {
        return new DebugRenderer(tokens, options).#_render();
    }
}

export default DebugRenderer;