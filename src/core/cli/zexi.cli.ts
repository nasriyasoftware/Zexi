import ZexiApp from "./kernal/assets/app/app";
import { ZexiDynamicCommand, ZexiStaticCommand, ZexiDelegatorCommand } from "./kernal/assets/command";
import type { CommandMode } from "./kernal/assets/command/types";

/**
 * The main entrypoint for creating Zexi CLI applications and commands.
 *
 * This class provides factory methods to construct commands (static or dynamic)
 * and initialize a CLI application instance.
 *
 * @example
 * const app = zexi.cli.createApp('my-cli', 'My awesome CLI tool');
 *
 * const serve = zexi.cli.createCommand('serve')
 *   .description('Start the server')
 *   .action(ctx => {
 *     console.log('Serving...');
 *   });
 *
 * app.command(serve).run();
 * 
 * @since 1.0.0
 */
class ZexiCLI {
    /**
     * Creates a new CLI command.
     *
     * By default, commands are created as **static commands**, meaning they can
     * have subcommands.
     *
     * Passing `"dynamic"` as the mode creates a **dynamic command**, which:
     * - Cannot have subcommands
     * - Treats all remaining CLI input as arguments
     *
     * @overload
     * @param {string} name - The name of the command.
     * @returns {ZexiStaticCommand} A static command instance.
     *
     * @overload
     * @param {string} name - The name of the command.
     * @param {'static'} mode - Explicitly create a static command.
     * @returns {ZexiStaticCommand} A static command instance.
     *
     * @overload
     * @param {string} name - The name of the command.
     * @param {'dynamic'} mode - Create a dynamic command.
     * @returns {ZexiDynamicCommand} A dynamic command instance.
     *
     * @overload
     * @param {string} name - The delegator command name.
     * @param {'dynamic'} mode - Create a dynamic delegator command.
     * @param {ZexiApp} delegatedTo - Target static command tree handled by another app.
     * @returns {ZexiDelegatorCommand} A delegator command instance.
     *
     * @example
     * const build = zexi.cli.createCommand('build');
     *
     * const checkout = zexi.cli.createCommand('checkout', 'dynamic');
     * 
     * @since 1.0.0
     */
    createCommand(name: string): ZexiStaticCommand;
    createCommand(name: string, mode: 'static'): ZexiStaticCommand;
    createCommand(name: string, mode: 'dynamic'): ZexiDynamicCommand;
    createCommand(name: string, mode: 'dynamic', delegatedTo: ZexiApp): ZexiDelegatorCommand;
    createCommand(name: string, mode?: CommandMode, delegatedTo?: ZexiApp) {
        if (mode === 'dynamic') {
            if (delegatedTo) {
                return new ZexiDelegatorCommand(name, delegatedTo);
            }
            
            return new ZexiDynamicCommand(name);
        } else {
            return new ZexiStaticCommand(name);
        }
    }

    /**
     * Creates a new CLI application instance.
     *
     * The app acts as the root command and is responsible for:
     * - Registering top-level commands
     * - Parsing CLI input
     * - Resolving and executing commands
     *
     * @param {string} name - The name of the CLI application.
     * @param {string} [description] - Optional description shown in help output.
     * @returns {ZexiApp} A new CLI application instance.
     *
     * @example
     * const app = zexi.cli.createApp('nst', 'Nasriya CLI tool');
     * 
     * @since 1.0.0
     */
    createApp(name: string, description?: string): ZexiApp {
        return new ZexiApp({ name, description });
    }
}

const zexiCLI = new ZexiCLI();
export default zexiCLI;