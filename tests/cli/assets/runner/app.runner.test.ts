import CLICommand from "../../../../src/core/cli/kernal/assets/command/core/cli.command";
import CLIOption from "../../../../src/core/cli/kernal/assets/option/option";
import AppRunner from "../../../../src/core/cli/kernal/assets/runner/app.runner";
import ZexiApp from "../../../../src/core/cli/kernal/assets/app/app";
import { ZexiCommandSymbol } from "../../../../src/core/cli/kernal/assets/keys";
import type {CommandContext} from "../../../../src/core/cli/kernal/assets/runner/context/cmd.context";

const makeArgv = (args: string[]) => {
    process.argv = ["node", "test", ...args];
};

describe("AppRunner (modern CLICommand model)", () => {
    const originalArgv = process.argv;

    afterEach(() => {
        process.argv = [...originalArgv];
        jest.restoreAllMocks();
    });

    it("runs middleware, seen handlers, and action in order", async () => {
        makeArgv(["build", "--count=2", "--", "pos1"]);

        const root = new CLICommand("root", "static");
        const build = new CLICommand("build", "static");
        root.commands.add(build);

        build.options.add(new CLIOption({
            name: "count",
            dataType: "number",
            required: true,
        }));

        const events: string[] = [];

        root.set.handler.onSeen(async () => {
            events.push("seen:root");
        });

        build.set.handler.onSeen(async () => {
            throw new Error("ignored seen error");
        });

        build.set.handler.onAction(async (ctx: CommandContext) => {
            events.push(`action:${ctx.options.get("count")}:${ctx.args.positional.join(",")}`);
        });

        const runner = new AppRunner(root);

        await runner.run();

        expect(events).toEqual([
            "seen:root",
            "action:2:pos1",
        ]);
        expect(runner.running).toBe(false);
    });

    it("warns when unknown options are provided", async () => {
        makeArgv(["build", "--unknown=true"]);

        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

        const root = new CLICommand("root", "static");
        const build = new CLICommand("build", "static");

        root.commands.add(build);

        build.set.handler.onAction(async () => undefined);

        const runner = new AppRunner(root);
        await runner.run();

        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Unknown CLI parameters")
        );
    });

    it("throws on invalid option type and resets running state", async () => {
        makeArgv(["build", "--count=abc"]);

        const root = new CLICommand("root", "static");
        const build = new CLICommand("build", "static");

        root.commands.add(build);

        build.options.add(new CLIOption({
            name: "count",
            dataType: "number",
            required: true,
        }));

        build.set.handler.onAction(async () => undefined);

        const runner = new AppRunner(root);

        await expect(runner.run()).rejects.toThrow(
            'Invalid number value "abc" for option "count"'
        );

        expect(runner.running).toBe(false);
    });

    it("delegates execution to another app and resolves its command", async () => {
        makeArgv(["proxy", "run"]);

        const root = new CLICommand("root", "static");

        // Create delegated app
        const delegatedApp = new ZexiApp({ name: "target-app" });
        const delegatedRoot = delegatedApp._internal.accessCMD(ZexiCommandSymbol)!;

        // Add a real executable command INSIDE the delegated app
        const runCmd = new CLICommand("run", "dynamic");
        runCmd.set.handler.onAction(async () => {
            return "delegated-result";
        });

        delegatedRoot.commands.add(runCmd);

        // Delegator (dynamic only, no action)
        const proxy = new CLICommand("proxy", "dynamic", delegatedApp);
        root.commands.add(proxy);

        const runner = new AppRunner(root);

        const result = await runner.run();

        expect(result).toBe("delegated-result");
        expect(runner.running).toBe(false);
    });
});