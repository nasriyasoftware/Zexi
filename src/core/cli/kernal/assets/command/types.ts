import type { CLIOptionManager } from "../option/manager";
import type { CommandContext } from "../runner/context/cmd.context";
import type { ZexiDelegatorCommand } from "./main/zexi.delegator.cmd";
import type { ZexiDynamicCommand } from "./main/zexi.dynamic.cmd";
import type { ZexiStaticCommand } from "./main/zexi.static.cmd";
import type { CLICommandManager } from "./core/manager";
import type { OptionAbbrev, OptionName } from "../../types/types";
import type { OptionData } from "../option/option.data";

export type CLICommandParamsType<M extends CommandMode> = {
    /**
     * The name of the option
     * @example
     * build
     */
    name: string;

    /**
     * The mode of the option
     * @required by the builder
     */
    mode: M;

    /**
     * The aliases of the option
     * @example
     * const aliases = 'create';
     * const aliases = ['create'];
     */
    aliases?: string | string[];

    /**
     * The description of the option
     * @example
     * description
     */
    description?: string;

}

export type CLICommandConfigType = {
    name: string;
    description: string | undefined;
    aliases: Set<string>;
    options: CLIOptionManager;
    commands: CLICommandManager;
}

export type CommandMode = 'static' | 'dynamic';
export type ZexiCommand = ZexiDynamicCommand | ZexiDelegatorCommand | ZexiStaticCommand;
export type CreatedCommand<T extends CommandMode> = T extends 'dynamic' ? ZexiDynamicCommand : ZexiStaticCommand;

export type AppCMDOptions = Record<OptionName | OptionAbbrev, unknown>;
export type AppCMDArgs = { positional: readonly string[]; loose: readonly string[]; all: readonly string[] };
export type CommandContextOptions = Map<OptionName | OptionAbbrev, OptionData>;

export type CommandContextData = {
    path: string[];
    options: CommandContextOptions;
    args: AppCMDArgs;
    raw: string[];
}

export type AppGlobalContext = {
    options: Record<string, unknown>;
    args: AppCMDArgs;
    raw: string[];
    path: string[];
}

export type CLICommandHandler = (ctx: CommandContext) => unknown | Promise<unknown>;
export type CLIAppHandler = (ctx: AppGlobalContext) => void | Promise<void>;
export type CLICommandMiddlewareHandler = (ctx: CommandContext, terminate: MiddlewareTerminateFunction) => unknown | Promise<unknown>;

export type MiddlewareTerminateResult =
    | { ok: true; message?: string }
    | { ok: false; reason: 'error'; error: Error }
    | { ok: false; reason: 'user_error'; message: string; meta?: { source?: string;[key: string]: any; } };

export type MiddlewareTerminateFunction = (result: MiddlewareTerminateResult) => void;
export type CLICommandInternalHandlers = {
    onRun: CLIAppHandler | undefined
    onAction: CLICommandHandler | undefined;
    onSeen: CLICommandHandler | undefined;
    middlewares: CLICommandMiddlewareHandler[]
}