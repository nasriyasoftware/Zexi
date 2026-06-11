import type CLICommand from "./cli.command";
import type { CommandName } from "../../../types/types";
import type { CommandMode } from "../types";

export class CLICommandManager {
    readonly #_owner: CLICommand<'static'>;
    readonly #_data = new Map<string, CLICommand<CommandMode>>();

    constructor(owner: CLICommand<'static'>) {
        this.#_owner = owner;
    }

    /**
     * Looks up a command in the command manager.
     *
     * The command is looked up by its name or aliases.
     *
     * @param {CommandName[]} names - The names to look up. If the names array is empty, then null is returned.
     * @returns {CLICommand | null} The command if it exists, or null if it does not exist.
     */
    find(names: CommandName[]): CLICommand<CommandMode> | null {
        const aliases = new Set<CommandName>(names);

        for (const command of this.#_data.values()) {
            for (const name of aliases) {
                if (command.name === name || command.aliases.includes(name)) {
                    return command;
                }
            }
        }

        return null;
    }

    /**
     * Validates whether a command can be added to the command manager.
     *
     * A command can be added if it is not already registered and does not have an alias that is already registered.
     *
     * @param {CLICommand} command - The command to validate.
     * @returns {{ valid: boolean; message?: string }}
     *   - valid: Whether the command can be added to the command manager.
     *   - message: An error message if the command cannot be added to the command manager.
     */
    validateEntry(command: CLICommand<CommandMode>): { valid: boolean; message?: string } {
        const badResponse = { valid: false, message: undefined as string | undefined };
        const cmd = this.find([command.name, ...command.aliases]);

        if (!cmd) {
            return { valid: true };
        }

        if (cmd.owner && cmd.owner !== this.#_owner) {
            badResponse.message = `Command "${command.name}" is already registered as a subcommand:\n${command.cmdChain}`;
            return badResponse;
        }

        badResponse.message = `Command "${command.name}" is already registered.`;
        return badResponse;
    }

    /**
     * Adds a command to the command manager.
     *
     * If the command is already registered or has an alias that is already registered, then an error is thrown.
     * If no errors are thrown, then the command is added to the command manager.
     *
     * @param {CLICommand} command - The command to add to the command manager.
     * @throws {Error} If the command is already registered or has an alias that is already registered.
     * @returns {void} No return value.
     */
    add(command: CLICommand<CommandMode>, bypassValidation = false): void {
        if (bypassValidation !== true) {
            const validity = this.validateEntry(command);
            if (!validity.valid) { throw new Error(validity.message); }
        }

        command.set.owner(this.#_owner);
        this.#_data.set(command.name, command);
    }

    /**
     * Checks whether the command manager has any dynamic commands.
     *
     * @returns {boolean} True if the command manager has any dynamic commands, false otherwise.
     */
    hasDynamic(): boolean {
        for (const cmd of this.#_data.values()) {
            if (cmd.mode === 'dynamic') { return true; }
        }
        return false;
    }

    get data(): Map<string, CLICommand<CommandMode>> { return this.#_data; }
}

export default CLICommandManager;