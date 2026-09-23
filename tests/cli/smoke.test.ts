import zexi from "../../src";
import terminalIO from "../../src/core/terminal/io/terminal.io";
import StdMocks from "../mocks/std";

describe("Zexi CLI Smoke Tests", () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();

        if (!terminalIO.intercepting) {
            terminalIO.intercepting = true;
        }
    });

    // ---------------------------
    // SEEN HANDLERS
    // ---------------------------

    it("seen handlers run in correct order", async () => {
        const calls: string[] = [];

        const app = zexi.cli.createApp("app");

        app.command(
            zexi.cli.createCommand("a")
                .onSeen(() => calls.push("a"))
                .command(
                    zexi.cli.createCommand("b")
                        .onSeen(() => calls.push("b"))
                        .action(() => { })
                )
        );

        setArgv("a b");

        await app.run();

        expect(calls).toEqual([
            "a",
            "b"
        ]);
    });

    // ---------------------------
    // ROOT
    // ---------------------------

    it("runs root action", async () => {
        const app = createTestApp();
        setArgv("");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("root onRun");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("middleware hit");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("root action");

        expect(res).toBe("root-result");
    });

    // ---------------------------
    // VERSION COMMAND
    // ---------------------------

    it("runs version command (default)", async () => {
        const app = createTestApp();
        setArgv("version");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("onSeen: version");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("text-output");

        expect(res).toBe("1.0.0");
    });

    it("runs version with long option", async () => {
        const app = createTestApp();
        setArgv("version --output=json");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("onSeen: version");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("json-output");

        expect(res).toEqual({ version: "1.0.0" });
    });

    it("runs version with short option", async () => {
        const app = createTestApp();
        setArgv("version -o json");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("onSeen: version");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("json-output");

        expect(res).toEqual({ version: "1.0.0" });
    });

    it("runs version via alias", async () => {
        const app = createTestApp();
        setArgv("v");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("onSeen: version");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("text-output");

        expect(res).toBe("1.0.0");
    });

    // ---------------------------
    // DELEGATION
    // ---------------------------

    it("delegates to pkg app", async () => {
        const app = createTestApp();
        setArgv("pkgs install react");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("pkgApp onRun");
        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Packages: react");

        expect(res).toEqual({
            installed: ["react"],
            source: "npm",
            saveDev: false
        });
    });

    it("delegation with options", async () => {
        const app = createTestApp();
        setArgv("pkgs install react -d --source=github");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Packages: react");

        expect(res).toEqual({
            installed: ["react"],
            source: "github",
            saveDev: true
        });
    });

    it("multiple packages", async () => {
        const app = createTestApp();
        setArgv("pkgs install react vue svelte");

        const res = await app.run() as { installed: string[]; };
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("Packages: react, vue, svelte");

        expect(res.installed).toEqual([
            "react",
            "vue",
            "svelte"
        ]);
    });

    it("no packages", async () => {
        const app = createTestApp();
        setArgv("pkgs install");

        const res = await app.run() as { installed: string[]; };
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("No packages");

        expect(res.installed).toEqual([]);
    });

    it("delegation preserves remaining args correctly", async () => {
        const app = createTestApp();
        setArgv("pkgs install react vue -- --flag");

        const res = await app.run() as { installed: string[]; };

        expect(res.installed).toEqual([
            "react",
            "vue",
            "--flag"
        ]);
    });

    it("delegated command return propagates to root", async () => {
        const app = createTestApp();
        setArgv("pkgs install react");

        const res = await app.run() as { installed: string[]; };

        expect(res.installed).toEqual(["react"]);
    });

    // ---------------------------
    // TERMINATION
    // ---------------------------

    it("middleware user_error terminates execution", async () => {
        const app = createTestApp();
        setArgv("--fail");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toHaveBeenCalledWith("middleware hit");
        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("root action");

        expect(res).toBeUndefined();
    });

    it("middleware success termination stops execution", async () => {
        const app = zexi.cli.createApp("test")
            .use(async (_ctx, terminate) => {
                terminate({
                    ok: true,
                    message: "Stopped early"
                });
            })
            .action(async () => {
                zexi.terminal.info("should not run");
            });

        setArgv("");

        const res = await app.run();
        await zexi.terminal.drain();

        StdMocks.expect.stdout.write.toNot.haveBeenCalledWith("should not run");

        expect(res).toBeUndefined();
    });

    // ---------------------------
    // OPTIONS / PARSING
    // ---------------------------

    it("flag without value works", async () => {
        const app = createTestApp();
        setArgv("pkgs install react -d");

        const res = await app.run() as { saveDev: boolean; };

        expect(res.saveDev).toBe(true);
    });

    it("-- stops option parsing", async () => {
        const app = createTestApp();
        setArgv("pkgs install -- --not-an-option file.txt");

        const res = await app.run() as { installed: string[]; };

        expect(res.installed).toContain("--not-an-option");
        expect(res.installed).toContain("file.txt");
    });

    it("unknown options trigger warning", async () => {
        const app = createTestApp();
        setArgv("version --unknown=123");

        const warnSpy = spyOn(zexi.terminal, "warn").mockImplementation(() => undefined);

        await app.run();

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0][0]).toEqual(
            expect.stringContaining("unknown")
        );
    });

    it("invalid boolean value throws", async () => {
        const app = createTestApp();
        setArgv("version --output=maybe");

        await expect(app.run()).rejects.toThrow();
    });

    it("invalid number option throws", async () => {
        const app = zexi.cli.createApp("test")
            .command(
                zexi.cli.createCommand("run")
                    .option({
                        name: "port",
                        dataType: "number",
                        required: true
                    })
                    .action(() => { })
            );

        setArgv("run --port=abc");

        await expect(
            app.run()
        ).rejects.toThrow(
            "Invalid number value"
        );
    });

    it("missing required option throws", async () => {
        const app = zexi.cli.createApp("test")
            .command(
                zexi.cli.createCommand("deploy")
                    .option({
                        name: "env",
                        dataType: "string",
                        required: true
                    })
                    .action(() => { })
            );

        setArgv("deploy");

        await expect(
            app.run()
        ).rejects.toThrow(
            'Option "env" is required'
        );
    });

    it("last option wins", async () => {
        const app = createTestApp();
        setArgv("version --output=text --output=json");

        const res = await app.run() as { version: string; };

        expect(res.version).toBe("1.0.0");
    });

    it("explicit overrides abbrev even if abbrev is later", async () => {
        const app = createTestApp();
        setArgv("version --output=json -o text");

        const res = await app.run() as { version: string; };

        expect(res.version).toBe("1.0.0");
    });

    it("last explicit option wins among explicit options", async () => {
        const app = createTestApp();
        setArgv("version --output=text --output=json");

        const res = await app.run() as { version: string; };

        expect(res.version).toBe("1.0.0");
    });

    it("last abbrev option wins among abbrevs", async () => {
        const app = createTestApp();
        setArgv("version -o text -o json");

        const res = await app.run() as { version: string; };

        expect(res.version).toBe("1.0.0");
    });

    it("explicit still wins even if multiple abbrevs appear after it", async () => {
        const app = createTestApp();
        setArgv("version --output=json -o text -o xml");

        const res = await app.run() as { version: string; };

        expect(res.version).toBe("1.0.0");
    });

    // ---------------------------
    // ERROR PROPAGATION
    // ---------------------------

    it("system error in middleware throws", async () => {
        const app = zexi.cli.createApp("err")
            .use(async (_ctx, terminate) => {
                terminate({
                    ok: false,
                    reason: "error",
                    error: new Error("boom")
                });
            });

        setArgv("");

        await expect(
            app.run()
        ).rejects.toThrow("boom");
    });
});

function setArgv(input: string) {
    process.argv = [
        "node",
        "test",
        ...input.split(" ").filter(Boolean)
    ];
}

function createTestApp() {
    const pkgApp = zexi.cli.createApp("packages-manager").command(
        zexi.cli.createCommand("install", "dynamic")
            .aliases(["i", "ins"])
            .option([
                {
                    name: "source",
                    abbrev: "s",
                    dataType: "string",
                    defaultValue: "npm"
                },
                {
                    name: "save-dev",
                    abbrev: "d",
                    dataType: "boolean",
                    defaultValue: false
                }
            ])
            .action(async ctx => {
                const source = ctx.options.get("source");
                const saveDev = ctx.options.get("save-dev");

                const pkgs = ctx.args.all;

                if (pkgs.length > 0) {
                    zexi.terminal.info(
                        `Packages: ${pkgs.join(", ")}`
                    );
                } else {
                    zexi.terminal.info("No packages");
                }

                return {
                    installed: pkgs,
                    source,
                    saveDev
                };
            })
    ).onRun(async () => {
        zexi.terminal.info("pkgApp onRun");
    });

    const app = zexi.cli.createApp("my-cli").onRun(async () => {
        zexi.terminal.info("root onRun");
    });

    app.option({
        name: "fail",
        dataType: "boolean",
        defaultValue: false
    });

    app.command(
        zexi.cli.createCommand("version")
            .aliases("v")
            .option({
                name: "output",
                abbrev: "o",
                dataType: "string",
                defaultValue: "text"
            })
            .onSeen(async () => {
                zexi.terminal.info("onSeen: version");
            })
            .action(async ctx => {
                const out = ctx.options.get("output");

                if (out === "json") {
                    zexi.terminal.info("json-output");

                    return {
                        version: "1.0.0"
                    };
                }

                if (out === "text") {
                    zexi.terminal.info("text-output");

                    return "1.0.0";
                }

                throw new Error(
                    `Unknown output type: ${out}`
                );
            })
    );

    app.command(
        zexi.cli.createCommand("pkgs", "dynamic", pkgApp)
    );

    app.action(async () => {
        zexi.terminal.info("root action");

        return "root-result";
    });

    app.use(async (ctx, terminate) => {
        zexi.terminal.info("middleware hit");

        if (
            ctx.options.has("fail") &&
            ctx.options.get("fail") === true
        ) {
            return terminate({
                ok: false,
                reason: "user_error",
                message: "Forced failure"
            });
        }
    });

    return app;
}