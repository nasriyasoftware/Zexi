import AppRunner from "../runner/app.runner";
import ZexiStaticCommand from "../command/main/zexi.static.cmd";
import { normalizeName } from "../../utils/utils";
import { ZexiCommandSymbol } from "../keys";
import type { CLIAppHandler } from "../command/types";

/**
 * Represents the root application of a Zexi command-line interface.
 *
 * A Zexi application is the top-level command container from which the CLI
 * command hierarchy is constructed and executed.
 *
 * The application behaves as a static command, allowing it to:
 *
 * - define a command name
 * - define a description
 * - register global options
 * - register subcommands
 * - register middleware
 * - register handlers that run when the application starts
 * - define a root action
 *
 * The application can be executed with {@link run}.
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE
 * ---------------------------------------------------------------------
 *
 * ## Create an application
 *
 * ```ts
 * const app = new ZexiApp({
 *     name: 'my-cli',
 *     description: 'My command line application'
 * });
 * ```
 *
 * ## Register an application handler
 *
 * The application handler runs when the root application command is
 * encountered during command resolution.
 *
 * ```ts
 * app.onRun(() => {
 *     zexi.terminal.info('Starting application...');
 * });
 * ```
 *
 * ## Register commands
 *
 * ```ts
 * app.command(
 *     new ZexiStaticCommand('build')
 *         .action(() => {
 *             zexi.terminal.info('Building project...');
 *         })
 * );
 * ```
 *
 * ## Run the application
 *
 * ```ts
 * const result = await app.run();
 * ```
 *
 * The returned value is the result produced by the executed command or
 * action.
 *
 * ---------------------------------------------------------------------
 * 🔷 EXECUTION
 * ---------------------------------------------------------------------
 *
 * Calling {@link run} creates an application runner for the root command
 * and executes the CLI using the current process arguments.
 *
 * Command resolution, middleware execution, option parsing, command
 * handlers, and command actions are performed by the application runner.
 *
 * @since 1.0.0
 */
class ZexiApp extends ZexiStaticCommand {
    /**
     * Creates a Zexi application.
     *
     * The application name is normalized before it is assigned to the root
     * command. When no name is provided, `Zexi` is used as the default name.
     *
     * The application description defaults to:
     *
     * `A command line tool built with Zexi`
     *
     * @param {object} configs - Application configuration.
     * @param {string} configs.name - Name of the CLI application.
     * @param {string} [configs.description] - Description displayed for the
     * application.
     *
     * @throws {TypeError} If the application name is not a valid string.
     * @throws {RangeError} If the normalized application name is invalid.
     *
     * @example
     * ```ts
     * const app = new ZexiApp({
     *     name: 'my-cli',
     *     description: 'My command line application'
     * });
     * ```
     *
     * @example
     * ```ts
     * const app = new ZexiApp({
     *     name: 'my-cli'
     * });
     * ```
     *
     * @since 1.0.0
     */
    constructor(configs: {
        name: string,
        description?: string,
    }) {
        const name = normalizeName(configs.name || 'Zexi');
        super(name);
        super.description(configs.description || 'A command line tool built with Zexi');
    }

    /**
     * Executes the Zexi application.
     *
     * The application is executed using the current process arguments.
     * Command resolution, option parsing, middleware, handlers, and the
     * selected command action are handled by the application runner.
     *
     * The returned value is the result produced by the command that was
     * ultimately executed. If execution is terminated without producing a
     * result, the returned value may be `undefined`.
     *
     * ```ts
     * const result = await app.run();
     * ```
     *
     * @returns {Promise<unknown>} A promise resolving to the result returned
     * by the executed command or action.
     *
     * @throws {Error} If command execution fails.
     * @throws {Error} If command parsing or validation fails.
     *
     * @example
     * ```ts
     * const app = new ZexiApp({
     *     name: 'my-cli'
     * });
     *
     * app.action(() => {
     *     return {
     *         success: true
     *     };
     * });
     *
     * const result = await app.run();
     *
     * console.log(result);
     * ```
     *
     * @since 1.0.0
     */
    run(): Promise<unknown> {
        const rootCMD = this._internal.accessCMD(ZexiCommandSymbol)!;
        const runner = new AppRunner(rootCMD);

        return runner.run();
    }

    /**
     * Registers a handler that runs when the root application command is
     * encountered during command resolution.
     *
     * The handler runs for every invocation of the application, including
     * invocations that execute a nested subcommand.
     *
     * This handler is intended for application-level behavior such as:
     *
     * - startup logging
     * - loading application configuration
     * - initializing shared resources
     * - enabling global behavior
     *
     * The handler does not replace the root command action. Use
     * {@link ZexiStaticCommand.action} to register the root action.
     *
     * ```ts
     * app.onRun(ctx => {
     *     zexi.terminal.info('Starting application...');
     * });
     * ```
     *
     * @param {CLIAppHandler} handler - Handler to execute when the application
     * root command is encountered.
     *
     * @returns {this} The current application instance (for chaining).
     *
     * @throws {Error} If the application has been finalized.
     * @throws {TypeError} If the handler is not a function.
     *
     * @example
     * ```ts
     * const app = new ZexiApp({
     *     name: 'my-cli'
     * });
     *
     * app.onRun(() => {
     *     zexi.terminal.info('Starting application...');
     * });
     * ```
     *
     * @example
     * ```ts
     * app
     *     .onRun(() => {
     *         initializeConfig();
     *     })
     *     .command(buildCommand)
     *     .command(deployCommand);
     * ```
     *
     * @since 1.0.0
     */
    onRun(handler: CLIAppHandler): this {
        const root = this._internal.accessCMD(ZexiCommandSymbol)!;
        root.set.handler.onRun(handler);
        return this;
    }
}

export default ZexiApp;