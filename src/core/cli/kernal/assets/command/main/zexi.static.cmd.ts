import ZexiCommandController from "./zexi.controller";
import CLICommand from "../core/cli.command";
import type { OptionDataType, CLIOptionParams } from "../../option/types";
import type { CLICommandHandler, CLICommandMiddlewareHandler, ZexiCommand } from "../types";

/**
 * Represents a statically defined command in the Zexi CLI command tree.
 *
 * A static command is defined explicitly during application configuration and
 * may contain options, aliases, middleware, handlers, actions, and nested
 * subcommands.
 *
 * Static commands are resolved directly from the command tree during CLI
 * execution. Unlike dynamic commands, they do not delegate command resolution
 * to another command instance.
 *
 * ---------------------------------------------------------------------
 * 🔷 CONFIGURATION
 * ---------------------------------------------------------------------
 *
 * A static command can be configured using the fluent API:
 *
 * ```ts
 * const build = new ZexiStaticCommand('build')
 *     .description('Build the project')
 *     .aliases(['b'])
 *     .option({
 *         name: 'production',
 *         abbrev: 'p',
 *         dataType: 'boolean',
 *         defaultValue: false
 *     })
 *     .action(ctx => {
 *         zexi.terminal.info('Building project...');
 *     });
 * ```
 *
 * ---------------------------------------------------------------------
 * 🔷 COMMAND HIERARCHY
 * ---------------------------------------------------------------------
 *
 * Static commands may contain nested static commands:
 *
 * ```ts
 * const packages = new ZexiStaticCommand('packages');
 *
 * packages.command(
 *     new ZexiStaticCommand('install')
 * );
 * ```
 *
 * Each command is identified by its name and may additionally be invoked
 * through one or more aliases.
 *
 * ---------------------------------------------------------------------
 * 🔷 LIFECYCLE
 * ---------------------------------------------------------------------
 *
 * A command can be configured until it is finalized by the CLI framework.
 * Once finalized, the command definition becomes immutable and further
 * configuration changes are rejected.
 *
 * ---------------------------------------------------------------------
 * 🔷 MIDDLEWARE
 * ---------------------------------------------------------------------
 *
 * Middleware registered through {@link use} or {@link middleware} runs before
 * the command action. Middleware can inspect the command context, perform
 * validation or preprocessing, and terminate execution when necessary.
 *
 * ---------------------------------------------------------------------
 * 🔷 ACTIONS
 * ---------------------------------------------------------------------
 *
 * A static command may define a single action through {@link action}.
 *
 * The action executes after all middleware completes successfully and the
 * command has been selected for execution.
 *
 * @since 1.0.0
 */
export class ZexiStaticCommand {
    readonly #_controller: ZexiCommandController<'static'>;

    /**
     * Creates a statically defined CLI command.
     *
     * The supplied name is passed to the underlying command definition for
     * validation and normalization.
     *
     * The returned command can then be configured using the fluent command
     * API.
     *
     * ---------------------------------------------------------------------
     * 🔷 COMMAND NAME
     * ---------------------------------------------------------------------
     *
     * The command name identifies the command within its parent command.
     *
     * ```ts
     * const command = new ZexiStaticCommand('build');
     * ```
     *
     * The normalized name is exposed through {@link name}.
     *
     * ---------------------------------------------------------------------
     * 🔷 CONFIGURATION
     * ---------------------------------------------------------------------
     *
     * Additional command configuration can be applied after construction:
     *
     * ```ts
     * const command = new ZexiStaticCommand('build')
     *     .description('Build the project')
     *     .aliases(['b']);
     * ```
     *
     * @param {string} name - Name used to invoke the command.
     *
     * @throws {TypeError} If the command name is not a string.
     * @throws {RangeError} If the command name is empty after normalization.
     *
     * @since 1.0.0
     */
    constructor(name: string) {
        const cmd = new CLICommand(name, 'static');
        this.#_controller = new ZexiCommandController(cmd);
    }

    /**
     * Returns the normalized command name.
     *
     * This is the canonical identifier used to invoke the command from the CLI.
     *
     * @returns {string} The command name.
     */
    get name(): string {
        return this.#_controller.cmd.name;
    }

    /**
     * Sets or clears the command description text.
     *
     * Passing `undefined` or `null` removes the current description. Any provided
     * string value is trimmed before it is stored.
     *
     * @param {string | null} [description] - Description value to assign or clear.
     * @returns {this} The current command instance (for chaining).
     * @throws {Error} If the command is finalized.
     * @throws {TypeError} If the description is not a string.
     * @throws {RangeError} If the description is an empty string after trimming.
     */
    description(description?: string | null): this {
        this.#_controller.setDescription(description);
        return this;
    }

    /**
     * Replaces command aliases.
     *
     * Aliases provide additional names that resolve to the same command.
     *
     * @param {string | string[]} aliases - One alias or a list of aliases.
     * @returns {this} The current command instance (for chaining).
     * @throws {Error} If the command is finalized.
     */
    aliases(aliases: string | string[]): this {
        this.#_controller.setAliases(aliases);
        return this;
    }

    /**
     * Adds one or more options to the command definition.
     *
     * Options are validated and normalized before registration. When validation
     * fails for any provided option, the operation is rejected.
     *
     * @template K
     * @param {CLIOptionParams<K> | CLIOptionParams<K>[]} options - Option config or list of configs.
     * @returns {this} The current command instance (for chaining).
     * @throws {Error} If the command is finalized.
     * @throws {Error} If duplicate option names or abbreviations are detected.
     */
    option<K extends OptionDataType>(options: CLIOptionParams<K> | CLIOptionParams<K>[]): this {
        this.#_controller.addOptions(options);
        return this;
    }

    /**
     * Registers a handler that runs every time this command is encountered
     * during command resolution, regardless of whether it is the final
     * command being executed.
     *
     * This is useful for:
     * - Logging
     * - Global option handling (e.g. --verbose)
     * - Side effects that should occur when the command is part of the path
     *
     * The handler receives a fully constructed {@link CommandContext}
     * scoped to this command.
     *
     * @param {CLICommandHandler} handler - The handler to execute when the command is seen.
     * @returns {this}
     *
     * @example
     * cmd.onSeen(ctx => {
     *   if (ctx.options.get('verbose')) {
     *     enableVerboseMode();
     *   }
     * });
     */
    onSeen(handler: CLICommandHandler): this {
        this.#_controller.onSeen(handler);
        return this;
    }

    /**
     * Registers a middleware function for this command.
     *
     * Middleware functions are executed sequentially before the command's
     * action or delegation. Each middleware receives the command context
     * and a `terminate` function.
     *
     * By default, execution continues to the next middleware. A middleware
     * can explicitly stop execution by calling `terminate(...)`.
     *
     * Middleware is typically used for:
     * - Validation
     * - Authorization
     * - Preprocessing
     *
     * @param {CLICommandMiddlewareHandler} fn - The middleware function.
     * @returns {this}
     *
     * @throws {Error} If the middleware is not a function.
     * @alias {@link middleware}
     * @example
     * cmd.use((ctx, terminate) => {
     *   if (!ctx.options.get('token')) {
     *     terminate({
     *       ok: false,
     *       reason: 'user_error',
     *       message: 'Missing token'
     *     });
     *   }
     * });
     */
    use(fn: CLICommandMiddlewareHandler): this {
        return this.middleware(fn);
    }

    /**
     * Registers a middleware function for this command.
     *
     * Middleware functions are executed sequentially before the command's
     * action or delegation. Each middleware receives the command context
     * and a `terminate` function.
     *
     * By default, execution continues to the next middleware. A middleware
     * can explicitly stop execution by calling `terminate(...)`.
     *
     * Middleware is typically used for:
     * - Validation
     * - Authorization
     * - Preprocessing
     *
     * @param {CLICommandMiddlewareHandler} fn - The middleware function.
     * @returns {this}
     *
     * @throws {Error} If the middleware is not a function.
     *
     * @example
     * cmd.middleware((ctx, terminate) => {
     *   if (!ctx.options.get('token')) {
     *     terminate({
     *       ok: false,
     *       reason: 'user_error',
     *       message: 'Missing token'
     *     });
     *   }
     * });
     */
    middleware(fn: CLICommandMiddlewareHandler): this {
        this.#_controller.use(fn);
        return this;
    }

    /**
     * Provides internal command lifecycle operations.
     *
     * This object is intended exclusively for Zexi's internal command
     * infrastructure and is not part of the public command configuration API.
     *
     * Access to operations that expose or mutate the underlying command is
     * protected by the command controller's internal authorization mechanism.
     *
     * ---------------------------------------------------------------------
     * 🔷 INTERNAL ACCESS
     * ---------------------------------------------------------------------
     *
     * The underlying {@link CLICommand} can only be accessed when the supplied
     * internal authorization token is valid.
     *
     * ---------------------------------------------------------------------
     * 🔷 FINALIZATION
     * ---------------------------------------------------------------------
     *
     * Internal finalization prevents further command configuration.
     *
     * Finalization is idempotence-protected by the command lifecycle and can
     * only be performed after successful internal authorization.
     *
     * @internal
     * @since 1.0.0
     */
    _internal = {
        /**
         * Returns the internal command when authorization succeeds.
         *
         * Access is guarded by an internal symbol token.
         *
         * @param {symbol} [via] - Internal authorization token.
         * @returns {CLICommand<'dynamic'> | null} The internal command or `null` when unauthorized.
         * 
         * @internal
         * @since 1.0.0
         */
        accessCMD: (via?: symbol): CLICommand<'static'> | null => {
            if (this.#_controller.auth(via)) {
                return this.#_controller.cmd;
            }

            return null;
        },

        /**
         * Locks the command against further configuration changes.
         *
         * Finalization only occurs when authorization succeeds.
         *
         * @param {symbol} [via] - Internal authorization token.
         * @throws {Error} If the command has already been finalized.
         * 
         * @internal
         * @since 1.0.0
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
         * @since 1.0.0
         */
        isFinalized: (): boolean => {
            return this.#_controller.finalized;
        }
    }

    /**
     * Sets the action handler for this command.
     *
     * The action is executed after all middleware functions complete,
     * provided that execution was not terminated.
     *
     * A command can have at most one action.
     *
     * This method cannot be used on delegation commands.
     *
     * @param {CLICommandHandler} handler - The action handler.
     * @returns {this}
     *
     * @throws {Error} If an action is already defined.
     * @throws {Error} If the command is a delegator.
     *
     * @example
     * cmd.action(ctx => {
     *   zexi.terminal.info('Running command...');
     * });
     */
    action(handler: CLICommandHandler): this {
        this.#_controller.onAction(handler);
        return this;
    }

    /**
     * Adds one or more subcommands.
     *
     * Only static commands can have subcommands. Each subcommand must be unique
     * in name and aliases within the same parent.
     *
     * @param {ZexiCommand | ZexiCommand[]} commands - The subcommand(s) to add.
     * @returns {this} The current command instance (for chaining).
     * @throws {Error} If the command is finalized.
     * @throws {Error} If a subcommand conflicts with an existing name or alias.
     */
    command(commands: ZexiCommand | ZexiCommand[]): this {
        this.#_controller.addCommands(commands);
        return this;
    }
}

export default ZexiStaticCommand;