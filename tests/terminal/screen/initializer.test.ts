import terminalIO, { ZexiTerminalIO } from "../../../src/core/terminal/io/terminal.io";
import ScreenInitializer from "../../../src/core/terminal/screen/initializer/initializer";
import StdMocks from "../../mocks/std";

describe('ScreenInitializer', () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();
    });

    describe('initialize()', () => {
        it('fails when no interactive terminal is available', async () => {
            ZexiTerminalIO.streams.stdout.isTTY = false;

            const queryCursorPosition = spyOn(terminalIO, 'queryCursorPosition');

            const initializer = new ScreenInitializer();

            await initializer.initialize();

            expect(initializer.initState).toBe('FAILED');
            expect(initializer.state).toBe('Disabled');

            expect(initializer.row).toBe(1);
            expect(initializer.column).toBe(1);

            expect(queryCursorPosition).not.toHaveBeenCalled();
        });

        it('initializes the original screen when the cursor position can be queried', async () => {
            const position = {
                row: 12,
                column: 34
            };

            const queryCursorPosition = spyOn(terminalIO, 'queryCursorPosition').mockResolvedValue(position);

            const initializer = new ScreenInitializer();

            await initializer.initialize();

            expect(initializer.initState).toBe('READY');
            expect(initializer.state).toBe('Original');

            expect(initializer.row).toBe(position.row);
            expect(initializer.column).toBe(position.column);

            expect(queryCursorPosition).toHaveBeenCalledTimes(1);
        });

        it('initializes the alternate screen when the cursor position cannot be queried', async () => {
            spyOn(terminalIO, 'queryCursorPosition').mockRejectedValue(new Error('Cursor query failed'));

            const write = spyOn(terminalIO, 'write').mockReturnValue(true);

            const initializer = new ScreenInitializer();

            await initializer.initialize();

            expect(initializer.initState).toBe('READY');
            expect(initializer.state).toBe('Alternate');

            expect(initializer.row).toBe(1);
            expect(initializer.column).toBe(1);

            expect(write).toHaveBeenCalledWith('[Zexi] Switching to alternate terminal screen...\r\n');
            expect(write).toHaveBeenCalledWith('\x1b[?1049h\x1b[2J\x1b[H');
        });

        it('does not initialize more than once', async () => {
            const position = {
                row: 5,
                column: 8
            };

            const queryCursorPosition = spyOn(terminalIO, 'queryCursorPosition').mockResolvedValue(position);

            const initializer = new ScreenInitializer();

            await initializer.initialize();
            await initializer.initialize();

            expect(initializer.initState).toBe('READY');
            expect(initializer.state).toBe('Original');

            expect(initializer.row).toBe(position.row);
            expect(initializer.column).toBe(position.column);

            expect(queryCursorPosition).toHaveBeenCalledTimes(1);
        });

        it('restores the original screen when the alternate screen is selected', async () => {
            spyOn(terminalIO, 'queryCursorPosition').mockRejectedValue(new Error('Cursor query failed'));

            const write = spyOn(terminalIO, 'write').mockReturnValue(true);

            const processOn = spyOn(process, 'on');

            const initializer = new ScreenInitializer();

            await initializer.initialize();

            const sigintRegistration = processOn.mock.calls.find(
                // @ts-ignore
                ([event]) => event === 'SIGINT'
            );

            expect(sigintRegistration).toBeDefined();

            const cleanup = sigintRegistration![1] as () => void;

            cleanup();

            expect(write).toHaveBeenCalledWith('\x1b[?1049l');
            expect(write).toHaveBeenCalledWith(
                '[Zexi] Restored original terminal screen.\r\n'
            );
        });
    });
});