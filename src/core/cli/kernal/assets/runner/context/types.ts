import type CLICommand from "../../command/core/cli.command";

export type AppRunnerCTXData = {
    raw: string[];
    appCMD: CLICommand<'static'>;
    cmd: {
        options: Record<string, unknown>;
        words: string[];
        argsAfterBreak: string[];
    }
}