import CLICommand from "../core/cli.command";
import ZexiCommandController from "./zexi.controller";
import type { OptionDataType, CLIOptionParams } from "../../option/types";
import type { CLICommandHandler, CLICommandMiddlewareHandler } from "../types";

/**
 * Represents a dynamically executable CLI command.
 *
 * A dynamic command represents a command that can execute an action directly
 * when it is resolved by the CLI.
 *
 * Dynamic commands support:
 *
 * - descriptions
 * - aliases
 * - options
 * - `onSeen()` handlers
 * - middleware
 * - an action handler
 *
 * Unlike static commands, dynamic commands cannot contain child commands.
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE
 * ---------------------------------------------------------------------
 *
 * ```ts
 * const command = zexi.cli.createCommand(
 *     'build',
 *     'dynamic'
 * );
 *
 * command
 *     .description('Build the project')
 *     .aliases(['b'])
 *     .option({
 *         name: 'production',
 *         abbrev: 'p',
 *         dataType: 'boolean',
 *         defaultValue: false
 *     })
 *     .action(ctx => {
 *         const production = ctx.options.get('production');
 *
 *         // Build the project...
 *     });
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 MIDDLEWARE
 * ---------------------------------------------------------------------
 *
 * Middleware runs before the command action and can terminate execution:
 *
 * ```ts
 * command.use((ctx, terminate) => {
 *     if (!ctx.options.get('production')) {
 *         terminate({
 *             ok: false,
 *             reason: 'user_error',
 *             message: 'Production mode is required.'
 *         });
 *     }
 * });
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 FINALIZATION
 * ---------------------------------------------------------------------
 *
 * Commands are finalized internally once they have been registered with the
 * CLI application. A finalized command can no longer be configured.
 *
 * @since 1.0.0
 */
export class ZexiDynamicCommand {
    readonly #_controller: ZexiCommandController<'dynamic'>;

    /**
     * Creates a dynamic CLI command.
     *
     * The command name is normalized by the underlying command controller and
     * becomes the canonical name used during CLI command resolution.
     *
     * Commands should normally be created through the public CLI command
     * factory rather than instantiated directly.
     *
     * @param {string} name - Name of the command.
     *
     * @throws {TypeError} If the command name is not a string.
     * @throws {RangeError} If the command name is empty after normalization.
     *
     * @since 1.0.0
     */
    constructor(name: string) {
        const cmd = new CLICommand(name, 'dynamic');
        this.#_controller = new ZexiCommandController(cmd);
    }

    /**
     * Returns the normalized command name.
     *
     * This is the canonical identifier used to invoke the command from the
     * CLI.
     *
     * @returns {string} The command name.
     *
     * @since 1.0.0
     */
    get name(): string {
        return this.#_controller.cmd.name;
    }

    /**
     * Sets or clears the command description text.
     *
     * Passing `undefined` or `null` removes the current description. Any
     * provided string value is trimmed before it is stored.
     *
     * @param {string | null} [description] - Description value to assign or clear.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the description is not a string.
     * @throws {RangeError} If the description is empty after trimming.
     *
     * @since 1.0.0
     */
    description(description?: string | null): this {
        this.#_controller.setDescription(description);
        return this;
    }

    /**
     * Replaces the command aliases.
     *
     * Aliases provide additional names that resolve to the same command.
     * Existing aliases are replaced by the supplied aliases.
     *
     * @param {string | string[]} aliases - One alias or a list of aliases.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     *
     * @since 1.0.0
     */
    aliases(aliases: string | string[]): this {
        this.#_controller.setAliases(aliases);
        return this;
    }

    /**
     * Adds one or more options to the command definition.
     *
     * Options are validated and normalized before registration. When multiple
     * options are supplied, all options must be valid before they are added to
     * the command.
     *
     * @template K
     * @param {CLIOptionParams<K> | CLIOptionParams<K>[]} options - Option configuration or list of configurations.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     * @throws {Error} If an option name conflicts with an existing option.
     * @throws {Error} If an option abbreviation conflicts with an existing option.
     *
     * @since 1.0.0
     */
    option<K extends OptionDataType>(
        options: CLIOptionParams<K> | CLIOptionParams<K>[]
    ): this {
        this.#_controller.addOptions(options);
        return this;
    }

    /**
     * Registers a handler that runs when this command is encountered during
     * command resolution.
     *
     * The handler runs regardless of whether this command is the final command
     * being executed.
     *
     * This is useful for:
     *
     * - Logging
     * - Global option handling
     * - Preparing command-specific state
     * - Side effects that should occur when the command is encountered
     *
     * The handler receives a fully constructed command context scoped to this
     * command.
     *
     * @param {CLICommandHandler} handler - Handler to execute when the command is seen.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the handler is not a function.
     *
     * @example
     * ```ts
     * command.onSeen(ctx => {
     *     if (ctx.options.get('verbose')) {
     *         enableVerboseMode();
     *     }
     * });
     * ```
     *
     * @since 1.0.0
     */
    onSeen(handler: CLICommandHandler): this {
        this.#_controller.onSeen(handler);
        return this;
    }

    /**
     * Registers a middleware function for this command.
     *
     * This method is an alias for {@link middleware}.
     *
     * @param {CLICommandMiddlewareHandler} fn - Middleware function.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the middleware function is not a function.
     *
     * @see {@link middleware}
     *
     * @since 1.0.0
     */
    use(fn: CLICommandMiddlewareHandler): this {
        return this.middleware(fn);
    }

    /**
     * Registers a middleware function for this command.
     *
     * Middleware functions are executed sequentially before the command's
     * action. Each middleware receives the command context and a `terminate`
     * function.
     *
     * By default, execution continues to the next middleware. A middleware can
     * explicitly stop execution by calling `terminate(...)`.
     *
     * Middleware is typically used for:
     *
     * - Validation
     * - Authorization
     * - Preprocessing
     * - Request or environment checks
     *
     * @param {CLICommandMiddlewareHandler} fn - Middleware function.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the middleware function is not a function.
     *
     * @example
     * ```ts
     * command.middleware((ctx, terminate) => {
     *     if (!ctx.options.get('token')) {
     *         terminate({
     *             ok: false,
     *             reason: 'user_error',
     *             message: 'Missing token'
     *         });
     *     }
     * });
     * ```
     *
     * @since 1.0.0
     */
    middleware(fn: CLICommandMiddlewareHandler): this {
        this.#_controller.use(fn);
        return this;
    }

    /**
     * Provides access to internal command operations.
     *
     * These operations are protected by an internal authorization token and
     * are intended exclusively for the CLI implementation.
     *
     * This property is not part of the public command API and should not be
     * accessed by application code.
     *
     * @internal
     */
    _internal = {
        /**
         * Returns the internal command when authorization succeeds.
         *
         * Access is guarded by an internal symbol token.
         *
         * @param {symbol} [via] - Internal authorization token.
         * @returns {CLICommand<'dynamic'> | null} The internal command, or `null` when unauthorized.
         *
         * @internal
         */
        accessCMD: (
            via?: symbol
        ): CLICommand<'dynamic'> | null => {
            if (this.#_controller.auth(via)) {
                return this.#_controller.cmd;
            }

            return null;
        },

        /**
         * Finalizes the command.
         *
         * Finalization prevents further command configuration changes.
         * Finalization only occurs when the supplied authorization token is
         * valid.
         *
         * @param {symbol} [via] - Internal authorization token.
         *
         * @throws {Error} If the command has already been finalized.
         *
         * @internal
         */
        finalize: (via?: symbol): void => {
            if (this.#_controller.finalized) {
                throw new Error('Command already finalized');
            }

            if (this.#_controller.auth(via)) {
                this.#_controller.finalized = true;
            }
        },

        /**
         * Reports whether this command is finalized.
         *
         * @returns {boolean} `true` when finalized, otherwise `false`.
         *
         * @internal
         */
        isFinalized: (): boolean => {
            return this.#_controller.finalized;
        }
    }

    /**
     * Sets the action handler for this command.
     *
     * The action is executed after all middleware functions have completed,
     * provided that execution has not been terminated.
     *
     * A dynamic command can have at most one action.
     *
     * The action receives the command context for the resolved command.
     *
     * @param {CLICommandHandler} handler - Action handler.
     * @returns {this} The current command instance (for chaining).
     *
     * @throws {Error} If an action has already been defined.
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the handler is not a function.
     *
     * @example
     * ```ts
     * command.action(ctx => {
     *     const production = ctx.options.get('production');
     *
     *     zexi.terminal.info(
     *         production
     *             ? 'Building for production...'
     *             : 'Building...'
     *     );
     * });
     * ```
     *
     * @since 1.0.0
     */
    action(handler: CLICommandHandler): this {
        this.#_controller.onAction(handler);
        return this;
    }
}

export default ZexiDynamicCommand;