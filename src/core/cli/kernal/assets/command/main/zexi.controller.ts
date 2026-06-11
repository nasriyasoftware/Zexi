import CLIOption from "../../option/option";
import { ZexiCommandSymbol } from "../../keys";
import type CLICommand from "../core/cli.command";
import type { OptionDataType, CLIOptionParams } from "../../option/types";
import type { CommandMode, CLICommandHandler, CLICommandMiddlewareHandler, ZexiCommand } from "../types";

class ZexiCommandController<M extends CommandMode> {
    readonly #_cmd: CLICommand<M>;
    #_finalized = false;

    constructor(cmd: CLICommand<M>) {
        this.#_cmd = cmd;
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
     */
    onSeen(handler: CLICommandHandler) {
        this.#_cmd.set.handler.onSeen(handler);
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
     *
     * @throws {Error} If an action is already defined.
     * @throws {Error} If the command is a delegator.
     */
    onAction(handler: CLICommandHandler) {
        this.#_cmd.set.handler.onAction(handler);
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
     *
     * @throws {Error} If the middleware is not a function.
     */
    use(fn: CLICommandMiddlewareHandler) {
        this.#_cmd.use(fn);
    }

    /**
     * Sets the description of the command.
     *
     * If the description is omitted or set to null, then the description of the command will be set to undefined.
     *
     * @throws {Error} If the command is already finalized.
     *
     * @param {string | null} [description] - The description of the command.
     */
    setDescription(description?: string | null) {
        if (this.#_finalized) { throw new Error('Cannot modify a finalized command'); }

        if (description === undefined || description === null) {
            this.#_cmd.set.description(undefined);
            return;
        }

        this.#_cmd.set.description(description);
    }

    /**
     * Sets the aliases of the command.
     *
     * If the aliases is omitted or set to null, then the aliases of the command will be set to an empty array.
     *
     * @throws {Error} If the command is already finalized.
     *
     * @param {string | string[]} [aliases] - The aliases of the command.
     */
    setAliases(aliases: string | string[]) {
        if (this.#_finalized) { throw new Error('Cannot modify a finalized command'); }
        if (!Array.isArray(aliases)) {
            aliases = [aliases];
        }

        this.#_cmd.set.aliases(aliases)
    }

    /**
     * Adds options to the command.
     *
     * If the options is omitted or set to null, then no options will be added.
     *
     * @throws {Error} If the command is already finalized.
     * @throws {Error} If an option with the same name or abbreviation already exists.
     *
     * @param {CLIOptionParams<K> | CLIOptionParams<K>[]} options - The options to add to the command.
     *
     * @returns {this} The current ZexiCommandController object.
     */
    addOptions<K extends OptionDataType>(options: CLIOptionParams<K> | CLIOptionParams<K>[]): this {
        if (this.#_finalized) { throw new Error('Cannot modify a finalized command'); }

        if (!Array.isArray(options)) {
            options = [options];
        }

        // Validate and store user input
        const createdOptions = new Set<CLIOption<K>>();
        for (const opt of options) {
            const option = new CLIOption(opt);
            createdOptions.add(option);
        }

        // Lookup duplicates
        for (const option of createdOptions) {
            const existing = this.#_cmd.options.find([option.name, option.abbrev!]);
            if (existing) {
                throw new Error(`Option with name "${option.name}" or abbreviation "${option.abbrev}" already exists`);
            }
        }

        // Add options
        for (const option of createdOptions) {
            this.#_cmd.options.add(option);
        }

        return this;
    }

    /**
     * Adds commands to the static command.
     *
     * If the command is a dynamic command, then an error will be thrown.
     * If the command is already finalized, then an error will be thrown.
     * If one or more commands are already attached and cannot be reused, then an error will be thrown.
     * If only one dynamic command is allowed per command, and a dynamic command already exists, then an error will be thrown.
     *
     * @param {ZexiCommand | ZexiCommand[]} commands - The commands to add to the static command.
     *
     * @returns {this} The current ZexiCommandController object.
     */
    addCommands(commands: ZexiCommand | ZexiCommand[]): this {
        if (this.#_cmd.mode === 'dynamic') { throw new Error('Cannot add commands to a dynamic command'); }
        const thisCMD = this.#_cmd as CLICommand<'static'>;

        if (this.#_finalized) { throw new Error('Cannot modify a finalized command'); }
        if (!Array.isArray(commands)) {
            commands = [commands];
        }

        let hasDynamic = thisCMD.commands.hasDynamic();
        for (const command of commands) {
            if (command._internal.isFinalized()) {
                throw new Error('One or more commands are already attached and cannot be reused');
            }

            const cmd = command._internal.accessCMD(ZexiCommandSymbol)!;
            const validity = thisCMD.commands.validateEntry(cmd);
            if (!validity.valid) {
                throw new Error(validity.message);
            }

            if (cmd.mode === 'dynamic') {
                if (hasDynamic) {
                    throw new Error('Only one dynamic command is allowed per command');
                }

                hasDynamic = true;
            }
        }

        for (const command of commands) {
            const cmd = command._internal.accessCMD(ZexiCommandSymbol)!;
            thisCMD.commands.add(cmd, true);

            command._internal.finalize();
        }

        return this;
    }

    /**
     * Attempts to authorize a given token
     *
     * If no via is given, then false is returned.
     *
     * @param {symbol} [via] - The via to check.
     * @returns {boolean} true if the via is authorized, false otherwise.
     */
    auth(via?: symbol): boolean {
        if (via === ZexiCommandSymbol) { return true; }
        return false;
    }

    /**
     * Gets the underlying command.
     *
     * @returns {CLICommand<M>} The underlying command.
     */
    get cmd(): CLICommand<M> { return this.#_cmd; }

    /**
     * Whether the command is finalized.
     *
     * A command is finalized once it is registered to the CLI.
     * Once finalized, the command cannot be modified further.
     *
     * @returns {boolean} true if the command is finalized, false otherwise.
     */
    get finalized(): boolean { return this.#_finalized; }

    /**
     * Sets whether the command is finalized.
     *
     * If the command is finalized, then it cannot be modified further.
     * Once finalized, the command is registered to the CLI.
     *
     * @throws {Error} If the command is already finalized.
     */
    set finalized(value: true) {
        if (this.#_finalized) { throw new Error('Cannot modify a finalized command'); }
        this.#_finalized = value;
    }
}

export default ZexiCommandController;