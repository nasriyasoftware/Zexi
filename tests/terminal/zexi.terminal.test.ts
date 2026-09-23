import terminalIO from '../../src/core/terminal/io/terminal.io';
import zexiTerminal, { ZexiTerminal } from '../../src/core/terminal/zexi.terminal';
import ZexiTerminalControllerInstance from '../../src/core/terminal/controller/controller';
import StdMocks from '../mocks/std';
import type { ZexiLogLevel } from '../../src/core/terminal/types';
import type { TerminalEventName, TerminalLogEvent } from '../../src/core/terminal/events/types';

type LogMethod = Extract<
    keyof ZexiTerminal,
    "fatal" | "error" | "warn" | "info" | "debug"
>;

describe("ZexiTerminal", () => {
    let terminal!: ZexiTerminal;

    beforeEach(async () => {
        StdMocks.reset();
        ZexiTerminalControllerInstance.events.dispose();
        terminal = zexiTerminal.with();
    });

    afterEach(() => {
        mock.restore();
    })

    afterAll(() => {
        ZexiTerminalControllerInstance.events.dispose();
        StdMocks.reset();
    });

    describe("clear()", () => {
        it("clears the terminal", () => {
            zexiTerminal.clear();

            // Assert the screen/terminal effect here.
        });

        it("emits a clear event after the screen has been cleared", async () => {
            let listener;

            await new Promise(resolve => {
                listener = mock((event) => resolve(event));
                terminal.events.on("clear", listener);
                terminal.clear();
            })

            expect(listener).toHaveBeenCalledTimes(1);
        });

        it("does not emit the clear event synchronously", () => {
            const listener = mock();
            terminal.events.on('clear', listener);

            terminal.clear();

            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe("events", () => {
        it("emits a level-specific log event", () => {
            const listener = mock();

            terminal.events.on("log.info", listener);

            terminal.info("Hello", { print: false });

            expect(listener).toHaveBeenCalledTimes(1);

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.name).toBe("log.info");
            expect(event.level).toBe("info");
        });

        it("emits the general log event", async () => {
            const listener = mock();

            terminal.events.on("log", listener);
            terminal.info("Hello", { print: false });

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(listener).toHaveBeenCalledTimes(1);

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.name).toBe("log.info");
            expect(event.level).toBe("info");
        });

        it("emits the same event object through both log events", async () => {
            const levelListener = mock();
            const generalListener = mock();

            terminal.events.on("log.info", levelListener);
            terminal.events.on("log", generalListener);

            terminal.info("Hello", { print: false });

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(levelListener).toHaveBeenCalledTimes(1);
            expect(generalListener).toHaveBeenCalledTimes(1);

            expect(levelListener.mock.calls[0][0]).toBe(generalListener.mock.calls[0][0]);
        });

        it("emits frozen log events", async () => {
            const listener = mock();

            terminal.events.on("log.info", listener);
            terminal.info("Hello", { print: false });

            await new Promise<void>(resolve => setImmediate(resolve));

            const event = listener.mock.calls[0][0];

            expect(Object.isFrozen(event)).toBe(true);
        });

        it("only invokes once listeners once", async () => {
            const listener = mock();

            terminal.events.once("log.info", listener);
            terminal.info("First", { print: false });
            await new Promise<void>(resolve => setImmediate(resolve));

            terminal.info("Second", { print: false });
            await new Promise<void>(resolve => setImmediate(resolve));

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });


    describe("logging methods", () => {
        it.each<[LogMethod, ZexiLogLevel]>([
            ["fatal", "fatal"],
            ["error", "error"],
            ["warn", "warn"],
            ["info", "info"],
            ["debug", "debug"]
        ])(
            "%s emits the correct log level",
            async (method, level) => {
                const event = await new Promise<TerminalLogEvent>(resolve => {
                    const eventName = `log.${level}` as TerminalEventName;

                    terminal.events.on(eventName, resolve);
                    terminal[method]("Hello", { print: false });
                })
                
                expect(event.level).toBe(level);
            }
        );

        it("does not print when print is false", async () => {
            terminal.info("Hello", { print: false });

            await terminal.drain();
            StdMocks.expect.stdout.write.toNot.haveBeenCalled();
        });

        it("prints when print is enabled", async () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            terminal.info("Hello");

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(write).toHaveBeenCalled();
        });

        it("prints messages at or above the configured level", async () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            const terminal = zexiTerminal.with({ logLevel: "warn" });

            terminal.error("Error");
            terminal.fatal("Fatal");

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(write).toHaveBeenCalled();
        });

        it("does not print messages below the configured level", async () => {
            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            const terminal = zexiTerminal.with({ logLevel: "warn" });

            terminal.info("Info");

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(write).not.toHaveBeenCalled();
        });

        it("still emits messages below the configured level", async () => {
            const terminal = zexiTerminal.with({ logLevel: "warn" });
            const listener = mock();

            terminal.events.on("log.info", listener);

            terminal.info("Info");

            await new Promise<void>(resolve => setImmediate(resolve));
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe("log options", () => {
        it("does not print when print is false", async () => {
            const listener = mock();
            zexiTerminal.events.on("log.info", listener);

            const write = spyOn(terminalIO, "write").mockReturnValue(true);

            zexiTerminal.info("Hello", { print: false });

            await new Promise<void>(resolve => setImmediate(resolve));

            expect(listener).toHaveBeenCalledTimes(1);
            expect(write).not.toHaveBeenCalled();
        });

        it("captures a stack trace when trace is enabled", async () => {
            const listener = mock();

            zexiTerminal.events.on("log.info", listener);
            zexiTerminal.info("Hello", { trace: true, print: false });

            await new Promise<void>(resolve => setImmediate(resolve));

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.trace).toBeDefined();
            expect(event.trace?.original).toBeDefined();
            expect(event.trace?.printable).toBeDefined();
        });

        it("does not capture a stack trace by default", async () => {
            const listener = mock();

            zexiTerminal.events.on("log.info", listener);
            zexiTerminal.info("Hello", { print: false });

            await new Promise<void>(resolve => setImmediate(resolve));
            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.trace).toBeUndefined();
        });
    });
});