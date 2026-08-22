import zexiTerminal from "../../../../../terminal/zexi.terminal";
import ZexiApp from "../../app/app";
import CommandDelegation from "./cli.delegation";
import CLIOptionManager from "../../option/manager";
import CLICommandManager from "./manager";
import { normalizeName } from "../../../utils/utils";
import { compose } from "./helpers";
import { ZexiCommandSymbol } from "../../keys";
import type { CLIAppHandler, CLICommandHandler, CLICommandInternalHandlers, CLICommandMiddlewareHandler, CommandMode } from "../types";
import type { CommandName } from "../../../types/types";
import type { CommandContext } from "../../runner/context/cmd.context";

class CLICommand<M extends CommandMode> {
    readonly #_commands?: CLICommandManager;
    readonly #_options = new CLIOptionManager();
    readonly #_aliases = new Set<CommandName>();
    readonly #_name: CommandName;
    readonly #_mode: M;

    #_description: string | undefined = undefined;
    #_owner: CLICommand<CommandMode> | null = null;
    #_handlers: CLICommandInternalHandlers = { onRun: undefined, onAction: undefined, onSeen: undefined, middlewares: [] }
    #_delegation: CommandDelegation;

    constructor(name: string, mode: M, delegatedTo?: ZexiApp) {
        if (typeof name !== 'string') {
            throw new TypeError(`Expected name to be a string, but got ${typeof name}`);
        }

        this.#_name = normalizeName(name) as CommandName;
        this.#_delegation = new CommandDelegation(mode, delegatedTo);

        this.#_mode = mode;
        if (mode === 'static') {
            this.#_commands = new CLICommandManager(this as CLICommand<'static'>);
        }
    }

    /**
     * Adds a middleware handler to the command.
     *
     * @param {CLICommandMiddlewareHandler} handler - The middleware handler to add.
     * @throws {TypeError} If the handler is not a function.
     */
    use(handler: CLICommandMiddlewareHandler) {
        if (typeof handler !== 'function') {
            throw new TypeError(`Expected handler to be a function, but got ${typeof handler}`);
        }

        if (this.#_handlers.middlewares.includes(handler)) { return; }
        this.#_handlers.middlewares.push(handler);
    }

    readonly set = {
        /**
         * Sets the owner command of this command.
         *
         * The owner command is the command that contains this command as a subcommand.
         * If this command is not a subcommand of any other command, then the owner command is null.
         *
         * @param {CLICommand} owner - The owner command to set.
         * @throws {Error} If the command already has a owner command.
         * @throws {TypeError} If the given owner is not a CLICommand.
         */
        owner: (owner: CLICommand<CommandMode>) => {
            if (owner instanceof CLICommand) {
                if (this.#_owner) {
                    throw new Error(`The command "${this.name}" already has a owner command`);
                }

                this.#_owner = owner;
            } else {
                throw new TypeError(`Expected owner to be a CLICommand, but got ${typeof owner}`);
            }
        },

        /**
         * Sets the aliases of this command.
         *
         * An alias is an alternate name for the command.
         * Aliases are used by the command line tool to determine which command to execute when the user types a command.
         *
         * @param {string[]} input - The aliases to set for the command.
         * @throws {Error} If the command has an alias that is the same as its name.
         */
        aliases: (input: string[]) => {
            // Check for duplicates
            if (new Set(input).size !== input.length) {
                zexiTerminal.warn(`Command "${this.name}" has duplicate aliases, which will be ignored`);
            }

            // Normalize names
            const aliases = input.map(a => normalizeName<CommandName>(a));

            for (const alias of aliases) {
                if (alias === this.name) {
                    throw new Error(`The command ${this.name} cannot have an alias of the same name`);
                }
            }

            // Clear aliases
            this.#_aliases.clear();

            for (const alias of aliases) {
                this.#_aliases.add(alias);
            }
        },

        /**
         * Sets the description of the command.
         *
         * The description of the command is a human-readable description of what the command does.
         * It is used by the command line tool to generate help messages.
         *
         * @param {string | undefined} description - The description to set for the command.
         */
        description: (description: string | undefined) => {
            if (description === undefined) {
                this.#_description = undefined;
                return;
            }

            if (typeof description !== 'string') {
                throw new TypeError(`Expected description to be a string, but got ${typeof description}`);
            }

            description = description.trim();
            if (description.length === 0) {
                throw new Error(`Expected description to be a non-empty string, but got ${description}`);
            }

            this.#_description = description;
        },

        handler: {
            /**
             * Sets the action handler for the command.
             *
             * @param {CLICommandHandler} handler - The action handler to set.
             * @throws {TypeError} If the handler is not a function.
             */
            onAction: (handler: CLICommandHandler) => {
                if (this.mode === 'dynamic' && this.delegation.assigned) {
                    throw new Error(`The "action" handler cannot be set on a delegation command`);
                }

                if (typeof handler !== 'function') {
                    throw new TypeError(`Expected the "action" handler to be a function, but got ${typeof handler}`);
                }

                if (this.mode === 'dynamic' && this.delegation.assigned) {
                    throw new Error(`The "action" handler cannot be set on a delegation command`);
                }

                this.#_handlers.onAction = handler;
            },

            /**
             * Sets the seen handler for the command.
             *
             * @param {CLICommandHandler} handler - The seen handler to set.
             * @throws {TypeError} If the handler is not a function.
             */
            onSeen: (handler: CLICommandHandler) => {
                if (typeof handler !== 'function') {
                    throw new TypeError(`Expected the "seen" handler to be a function, but got ${typeof handler}`);
                }

                this.#_handlers.onSeen = handler;
            },

            /**
             * Sets the `onRun` handler for the command.
             *
             * @param {CommandRunHandler} handler - The `onRun` handler to set.
             * @throws {TypeError} If the handler is not a function.
             */
            onRun: (handler: CLIAppHandler) => {
                if (this.mode === 'static' && !this.owner) {
                    this.#_handlers.onRun = handler;
                } else {
                    throw new Error(`The "init" handler can only be set on the root command`);
                }
            }
        }
    }

    /**
     * Gets the command delegation for this command.
     *
     * @returns {CommandDelegation} The command delegation for this command.
     * @readonly The command delegation is a read-only property, so it cannot be changed after the command object is created.
     */
    get delegation(): CommandDelegation { return this.#_delegation; }

    /**
     * Gets a printable command-definition tree for debugging.
     *
     * This reflects how commands are registered in the application (definition
     * structure), not the exact user input typed at runtime.
     *
     * @returns {string} A tree-like debug string for this command branch.
     * @readonly The command definition tree is computed on-demand.
     */
    get cmdChain(): string {
        const lines: string[] = [];

        const renderNode = (command: CLICommand<CommandMode>, prefix: string, branch: string) => {
            const aliases = command.aliases.length > 0 ? ` aliases=[${command.aliases.join(', ')}]` : '';
            const delegatedTo = command.delegation.assigned ? ` -> delegates:${command.delegation.target!.name}` : '';

            lines.push(`${prefix}${branch}${command.name} (${command.mode})${aliases}${delegatedTo}`);

            if (command.mode !== 'static') {
                return;
            }

            const staticCommand = command as CLICommand<'static'>;
            const children = Array.from(staticCommand.commands.data.values());
            children.forEach((child, index) => {
                const isLast = index === children.length - 1;
                const nextBranch = isLast ? '└─ ' : '├─ ';
                const nextPrefix = `${prefix}${branch ? (branch === '└─ ' ? '   ' : '│  ') : ''}`;
                renderNode(child, nextPrefix, nextBranch);
            });
        };

        renderNode(this, '', '');
        return lines.join('\n');
    }

    /**
     * Gets the mode of the command.
     *
     * The mode of the command determines whether the command is a static command or a dynamic command.
     * Static commands are commands that have a fixed set of subcommands, while dynamic commands are commands that can have any number of subcommands.
     *
     * @returns {M} The mode of the command.
     * @readonly The mode of the command is a read-only property, so it cannot be changed after the command object is created.
     */
    get mode(): M { return this.#_mode; }

    /**
     * Gets the name of the command.
     *
     * The name of the command is a unique identifier for the command.
     * It is used by the command line tool to determine which command to execute when the user types a command.
     *
     * @returns {CommandName} The name of the command.
     * @readonly The name of the command is a read-only property, so it cannot be changed after the command object is created.
     */
    get name(): CommandName { return this.#_name; }

    /**
     * Gets the owner of this command.
     *
     * The owner of this command is the command that owns this command.
     * If this command is a top-level command, then the owner is null.
     *
     * @returns {CLICommand<'static'> | null} The owner of this command, or null if this command is a top-level command.
     * @readonly The owner of this command is a read-only property, so it cannot be changed after the command object is created.
     */
    get owner(): CLICommand<CommandMode> | null { return this.#_owner; }

    /**
     * Gets the aliases of the command.
     *
     * An alias is an alternate name for the command.
     * Aliases are used by the command line tool to determine which command to execute when the user types a command.
     *
     * @returns {Set<CommandName>} The aliases of the command.
     * @readonly The aliases of the command are a read-only property, so they cannot be changed after the command object is created.
     */
    get aliases(): CommandName[] {
        return Array.from(this.#_aliases);
    }

    /**
     * Gets the description of the command.
     *
     * The description is a longer text that describes the purpose and usage of the command.
     * It is used by the command line tool to generate help messages when the user types the help command.
     *
     * @returns {string | undefined} The description of the command, or undefined if no description is set.
     * @readonly The description is a read-only property, so it cannot be changed after the command object is created.
     */
    get description(): string | undefined { return this.#_description; }

    /**
     * Gets the command manager associated with this command.
     *
     * The command manager is used to manage subcommands of this command.
     * It provides methods for adding, removing, and looking up subcommands.
     *
     * If this command is a dynamic command, then this method returns undefined.
     * If this command is a static command, then this method returns the command manager associated with this command.
     *
     * @returns {CLICommandManager | undefined} The command manager associated with this command, or undefined if this command is a dynamic command.
     * @readonly The command manager is a read-only property, so it cannot be changed after the command object is created.
     */
    get commands(): M extends 'static' ? CLICommandManager : undefined {
        if (this.mode === 'static') {
            return this.#_commands! as M extends 'static' ? CLICommandManager : undefined;
        }

        return undefined as M extends 'static' ? CLICommandManager : undefined;
    }

    /**
     * Gets the option manager associated with this command.
     *
     * The option manager is used to manage options of this command.
     * It provides methods for adding, removing, and looking up options.
     *
     * @returns {CLIOptionManager} The option manager associated with this command.
     * @readonly The option manager is a read-only property, so it cannot be changed after the command object is created.
     */
    get options(): CLIOptionManager { return this.#_options; }

    get help(): string {
        const fullPath = (() => {
            const nodes: CLICommand<CommandMode>[] = [];
            let cursor: CLICommand<CommandMode> | null = this;
            while (cursor) {
                nodes.unshift(cursor);
                cursor = cursor.owner;
            }

            return nodes.map(cmd => cmd.name).join(' ');
        })();

        const formatOption = (name: string, required: boolean): string => {
            return required ? `<${name}>` : `[${name}]`;
        };

        const lines: string[] = [];
        lines.push(`Command: ${fullPath}`);
        lines.push(`Mode: ${this.mode}`);

        if (this.description) {
            lines.push(`Description: ${this.description}`);
        }

        const hasHandler = this.#_handlers.onAction || this.#_handlers.middlewares.length > 0;
        const options = this.options.list();

        const getUsageParts = (hasCommands: boolean) => {
            const usageParts = [fullPath];
            if (this.mode === 'static') {
                if (hasCommands) {
                    usageParts.push('[subcommand]');
                }
            } else {
                usageParts.push('<path...>');
            }

            if (options.length > 0) {
                usageParts.push('[options]');
            }

            return usageParts.join(' ');
        }

        if (hasHandler) {
            lines.push('Usage:');
            lines.push(`- ${getUsageParts(false)}`);
            lines.push(`- ${getUsageParts(true)}`);
        } else {
            lines.push(`Usage: ${getUsageParts(true)}`);
        }

        if (this.aliases.length > 0) {
            lines.push('');
            lines.push(`Aliases: ${this.aliases.join(', ')}`);
        }

        if (options.length > 0) {
            lines.push('');
            lines.push('Options:');
            for (const option of options) {
                const names = [`--${option.name}`];
                if (option.abbrev) {
                    names.push(`-${option.abbrev}`);
                }

                const valueHint = option.dataType === 'boolean'
                    ? ''
                    : ` ${formatOption(option.dataType, option.required)}`;

                const details: string[] = [];
                details.push(option.required ? 'required' : 'optional');
                details.push(`type:${option.dataType}`);
                if (option.defaultValue !== undefined) {
                    details.push(`default:${String(option.defaultValue)}`);
                }

                const description = option.description ?? 'No description';
                lines.push(`  ${names.join(', ')}${valueHint} - ${description} (${details.join(', ')})`);
            }
        }

        if (this.mode === 'static') {
            const manager = this.commands;
            const subcommands = manager ? Array.from(manager.data.values()) : [];
            if (subcommands.length > 0) {
                lines.push('');
                lines.push('Subcommands:');
                for (const subcommand of subcommands) {
                    const aliases = subcommand.aliases.length > 0 ? ` [aliases: ${subcommand.aliases.join(', ')}]` : '';
                    const description = subcommand.description ?? 'No description';
                    lines.push(`  ${subcommand.name} (${subcommand.mode}) - ${description}${aliases}`);
                }
            }
        }

        if (this.delegation.assigned && this.delegation.target) {
            lines.push('');
            lines.push(`Delegation target: ${this.delegation.target.name}`);
        }

        return lines.join('\n');
    }

    /**
     * Gets the `onRun` handler for the command.
     *
     * @returns {CommandRunHandler} The `onRun` handler for the command.
     * @readonly The `onRun` handler is a read-only property, so it cannot be changed after the command object is created.
     */
    get onRun(): CLIAppHandler | undefined {
        if (this.mode === 'static' && !this.#_owner) {
            return this.#_handlers.onRun;
        }

        return undefined;
    }

    /**
     * Executes a command handler through the internal runner pathway.
     *
     * Direct external execution is blocked; calls must provide the internal
     * command symbol. Supports `action` and `seen` handlers, where `seen` is
     * optional and treated as a no-op when missing.
     *
     * @param {CommandContext} context - The command context.
     * @returns {Promise<unknown>} A promise that resolves with the result of the main action handler.
     * @throws {TypeError} If the main action handler is not a function.
     */
    async execute(ctx: CommandContext, via?: symbol): Promise<unknown> {
        if (via !== ZexiCommandSymbol) {
            throw new Error(`Unable to execute command "${this.name}" directly`);
        }

        if (this.#_handlers.onAction || this.#_handlers.middlewares.length > 0) {
            const runner = compose(this.#_handlers.middlewares, this.#_handlers.onAction);
            return await runner(ctx);
        } else {
            zexiTerminal.info(this.help);

            /**
             * If the command is a non-delegation command, and is not the root command;
             * Show an error message for the user
             */
            if (!this.delegation.assigned && this.owner) {
                zexiTerminal.error(`The command "${this.name}" action is not implemented. Read the above help message for more information on usage.`);
            }
            return;
        }
    }

    /**
     * Executes the seen handler for the command.
     *
     * @returns {Promise<void>} A promise that resolves when the seen handler has completed execution.
     * @throws {TypeError} If the seen handler is not a function.
     */
    async handleSeen(ctx: CommandContext, via?: symbol): Promise<void> {
        if (via !== ZexiCommandSymbol) {
            throw new Error(`Unable to execute command "${this.name}" directly`);
        }

        if (this.#_handlers.onSeen) {
            await this.#_handlers.onSeen(ctx);
        }
    }
}

export default CLICommand;