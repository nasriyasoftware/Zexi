import zexi from "../../../../src";

describe("ZexiApp", () => {
    const originalArgv = process.argv;

    afterEach(() => {
        process.argv = [...originalArgv];
    });

    it("prevents duplicate middleware registration (behavioral check)", async () => {
        const app = zexi.cli.createApp('tool');

        let count = 0;

        const middleware = async (_ctx: any, terminate: any) => {
            count++;
            terminate({ ok: true });
        };

        app.use(middleware);
        app.use(middleware);

        process.argv = ["node", "test"];

        await app.run();

        expect(count).toBe(1);
    });

    it("throws when registering a non-function middleware", () => {
        const app = zexi.cli.createApp('tool');

        expect(() => app.use("bad" as any)).toThrow("Expected handler to be a function, but got string");
    });

    it("runs middleware before action", async () => {
        process.argv = ["node", "test"];

        const app = zexi.cli.createApp('tool');

        const events: string[] = [];

        app.action(async () => {
            events.push("action");
            return "done";
        });

        app.use(async (_ctx, terminate) => {
            events.push("mw:before");
        });

        const res = await app.run();
        console.log(events);
        expect(events).toEqual(["mw:before", "action"]);

        expect(res).toBe("done");
    });

    it("returns action result from run()", async () => {
        process.argv = ["node", "test"];

        const app = zexi.cli.createApp('tool');

        app.action(async () => {
            return { ok: true, value: 123 };
        });

        const res = await app.run();

        expect(res).toEqual({ ok: true, value: 123 });
    });
});