import ZexiApp from "../../../../src/core/cli/kernal/assets/app/app";
import CLICommand from "../../../../src/core/cli/kernal/assets/command/core/cli.command";
import CLIOption from "../../../../src/core/cli/kernal/assets/option/option";
import CommandContext from "../../../../src/core/cli/kernal/assets/runner/context/cmd.context";
import { ZexiCommandSymbol } from "../../../../src/core/cli/kernal/assets/keys";


const makeContext = (path: string[] = ["root"]): CommandContext =>
    new CommandContext({
        raw: [...path],
        path: [...path],
        options: new Map(),
        args: {
            positional: [],
            loose: [],
            all: [],
        },
    });

describe("CLICommand.help", () => {
    it("renders static command structure with options and subcommands", () => {
        const root = new CLICommand("root", "static");
        const sub = new CLICommand("build", "dynamic");

        root.set.description("Root command");
        root.set.aliases(["r"]);

        root.options.add(new CLIOption({
            name: "port",
            abbrev: "p",
            dataType: "number",
            required: true,
            description: "Server port",
        }));

        root.commands.add(sub);

        const help = root.help;

        expect(help).toContain("Command: root");
        expect(help).toContain("Mode: static");
        expect(help).toContain("Description: Root command");
        expect(help).toContain("Aliases: r");
        expect(help).toContain("--port, -p <number>");
        expect(help).toContain("Subcommands:");
        expect(help).toContain("build (dynamic)");
    });

    it("renders delegated dynamic command help (construction-time delegation)", () => {
        const app = new ZexiApp({ name: "target-app" });
        const cmd = new CLICommand("proxy", "dynamic", app);

        const help = cmd.help;

        expect(help).toContain("Command: proxy");
        expect(help).toContain("Mode: dynamic");
        expect(help).toContain("Usage: proxy <path...>");
        expect(help).toContain("Delegation target: target-app");
    });

    it("includes options in help output", () => {
        const cmd = new CLICommand("test", "dynamic");

        cmd.options.add(new CLIOption({
            name: "flag",
            abbrev: "f",
            dataType: "string",
            required: false,
        }));

        expect(cmd.help).toContain("--flag, -f [string]");
    });
});

describe("CLICommand.execute", () => {
    it("rejects external execution without internal symbol", async () => {
        const cmd = new CLICommand("secure", "dynamic");
        const ctx = makeContext(["secure"]);

        await expect(cmd.execute(ctx)).rejects.toThrow(
            'Unable to execute command "secure" directly'
        );
    });

    it("executes action and returns value", async () => {
        const cmd = new CLICommand("build", "dynamic");
        const ctx = makeContext(["build"]);

        const action = jest.fn(() => {
            return "ok";
        });

        cmd.set.handler.onAction(action);

        const res = await cmd.execute(ctx, ZexiCommandSymbol);

        expect(action).toHaveBeenCalledTimes(1);
        expect(res).toBe("ok");
    });

    it("executes middleware and allows execution to continue when not terminated", async () => {
        const cmd = new CLICommand("cmd", "dynamic");
        const ctx = makeContext(["cmd"]);

        const events: string[] = [];

        cmd.use((ctx, terminate) => {
            events.push("mw1");
        });

        cmd.use((ctx, terminate) => {
            events.push("mw2");
        });

        cmd.set.handler.onAction(() => {
            events.push("action");
            return "done";
        });

        const res = await cmd.execute(ctx, ZexiCommandSymbol);

        expect(events).toEqual(["mw1", "mw2", "action"]);
        expect(res).toBe("done");
    });

    it("supports termination stopping execution before action", async () => {
        const cmd = new CLICommand("stop", "dynamic");
        const ctx = makeContext(["stop"]);

        const events: string[] = [];

        cmd.use((ctx, terminate) => {
            events.push("mw1");
            terminate({ ok: false, reason: 'user_error', message: 'stop' });
        });

        cmd.use((ctx, terminate) => {
            events.push("mw2");
        });

        cmd.set.handler.onAction(() => {
            events.push("action");
        });

        const res = await cmd.execute(ctx, ZexiCommandSymbol);

        expect(events).toEqual(["mw1"]);
        expect(res).toBeUndefined();
    });

    it("returns undefined when no action or middleware exists", async () => {
        const cmd = new CLICommand("empty", "dynamic");
        const ctx = makeContext(["empty"]);

        const res = await cmd.execute(ctx, ZexiCommandSymbol);

        expect(res).toBeUndefined();
    });

    it("supports onSeen lifecycle hook", async () => {
        const cmd = new CLICommand("seen", "dynamic");
        const ctx = makeContext(["seen"]);

        const seen = jest.fn();

        cmd.set.handler.onSeen(seen);

        await cmd.handleSeen(ctx, ZexiCommandSymbol);

        expect(seen).toHaveBeenCalledTimes(1);
        expect(seen).toHaveBeenCalledWith(ctx);
    });

    it("delegated command executes without requiring action handler", async () => {
        const app = new ZexiApp({ name: "target-app" });
        const cmd = new CLICommand("proxy", "dynamic", app);

        const ctx = makeContext(["proxy"]);

        const res = await cmd.execute(ctx, ZexiCommandSymbol);

        expect(res).toBeUndefined();
    });
});