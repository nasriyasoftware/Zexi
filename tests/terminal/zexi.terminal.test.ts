import zexiTerminal from '../../src/core/terminal/zexi.terminal';
import ZexiTerminalControllerInstance from '../../src/core/terminal/controller/controller';
import { StdoutMock } from '../mocks/stdout.mock';
import type { ZexiLogLevel } from '../../src/core/terminal/types';
import type { TerminalEventName, TerminalLogEvent } from '../../src/core/terminal/events/types';

jest.mock('../../src/core/terminal/screen/cursor-position', () => ({
    __esModule: true,
    default: {
        initialized: true,
        row: 1,
        column: 0
    }
}));

type LogMethod = Extract<
    keyof typeof zexiTerminal,
    'fatal' | 'error' | 'warn' | 'info' | 'debug'
>;

describe('ZexiTerminal', () => {
    let mock: StdoutMock;

    beforeEach(() => {
        mock = new StdoutMock();

        Object.defineProperty(process, 'stdout', {
            value: mock,
            configurable: true
        });
    });

    afterEach(() => {
        mock.reset();
    });

    afterAll(() => {
        ZexiTerminalControllerInstance.events.dispose();
    });

    describe('clear()', () => {
        it('clears the terminal', async () => {
            await zexiTerminal.clear();

            // Assert the screen/terminal effect here.
        });

        it('emits a clear event after the screen has been cleared', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('clear', listener);

            await zexiTerminal.clear();

            expect(listener).toHaveBeenCalledTimes(1);

            const event = listener.mock.calls[0][0];

            expect(event).toEqual({
                id: expect.any(String),
                time: expect.any(String),
                name: 'clear'
            });
        });

        it('emits the clear event only after the clear operation completes', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('clear', listener);

            const promise = zexiTerminal.clear();

            expect(listener).not.toHaveBeenCalled();

            await promise;

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('events', () => {
        it('emits a level-specific log event', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log.info', listener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            expect(listener).toHaveBeenCalledTimes(1);

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.name).toBe('log.info');
            expect(event.level).toBe('info');
        });

        it('emits the general log event', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log', listener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            expect(listener).toHaveBeenCalledTimes(1);

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.name).toBe('log.info');
            expect(event.level).toBe('info');
        });

        it('emits the same event object through both log events', async () => {
            const levelListener = jest.fn();
            const generalListener = jest.fn();

            zexiTerminal.events.on('log.info', levelListener);
            zexiTerminal.events.on('log', generalListener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            expect(levelListener).toHaveBeenCalledTimes(1);
            expect(generalListener).toHaveBeenCalledTimes(1);

            expect(levelListener.mock.calls[0][0])
                .toBe(generalListener.mock.calls[0][0]);
        });

        it('emits frozen log events', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log.info', listener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            const event = listener.mock.calls[0][0];

            expect(Object.isFrozen(event)).toBe(true);
        });

        it('only invokes once listeners once', async () => {
            const listener = jest.fn();

            zexiTerminal.events.once('log.info', listener);

            await zexiTerminal.info('First', {
                print: false
            });

            await zexiTerminal.info('Second', {
                print: false
            });

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('logging methods', () => {
        it.each<[LogMethod, ZexiLogLevel]>([
            ['fatal', 'fatal'],
            ['error', 'error'],
            ['warn', 'warn'],
            ['info', 'info'],
            ['debug', 'debug']
        ])(
            '%s emits the correct log level',
            async (method, level) => {
                const listener = jest.fn();

                zexiTerminal.events.on(
                    `log.${level}` as TerminalEventName,
                    listener
                );

                await zexiTerminal[method](
                    'Hello',
                    { print: false }
                );

                expect(listener).toHaveBeenCalledTimes(1);
                expect(listener.mock.calls[0][0].level)
                    .toBe(level);
            }
        );

        it('does not print when print is false', async () => {
            await zexiTerminal.info('Hello', {
                print: false
            });

            expect(mock.write).not.toHaveBeenCalled();
        });

        it('prints when print is enabled', async () => {
            await zexiTerminal.info('Hello');

            expect(mock.write).toHaveBeenCalled();
        });

        it('prints messages at or above the configured level', async () => {
            const terminal = zexiTerminal.with({
                logLevel: 'warn'
            });

            await terminal.error('Error');
            await terminal.fatal('Fatal');

            expect(mock.write).toHaveBeenCalled();
        });

        it('does not print messages below the configured level', async () => {
            const terminal = zexiTerminal.with({
                logLevel: 'warn'
            });

            await terminal.info('Info');

            expect(mock.write).not.toHaveBeenCalled();
        });

        it('still emits messages below the configured level', async () => {
            const terminal = zexiTerminal.with({
                logLevel: 'warn'
            });

            const listener = jest.fn();

            terminal.events.on('log.info', listener);

            await terminal.info('Info');

            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('log options', () => {
        it('does not print when print is false', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log.info', listener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            expect(listener).toHaveBeenCalledTimes(1);
            expect(mock.write).not.toHaveBeenCalled();
        });

        it('captures a stack trace when trace is enabled', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log.info', listener);

            await zexiTerminal.info('Hello', {
                trace: true,
                print: false
            });

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.trace).toBeDefined();
            expect(event.trace?.original).toBeDefined();
            expect(event.trace?.printable).toBeDefined();
        });

        it('does not capture a stack trace by default', async () => {
            const listener = jest.fn();

            zexiTerminal.events.on('log.info', listener);

            await zexiTerminal.info('Hello', {
                print: false
            });

            const event = listener.mock.calls[0][0] as TerminalLogEvent;

            expect(event.trace).toBeUndefined();
        });
    });
});