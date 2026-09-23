import moveCursorInterceptor from "../../../../src/core/terminal/io/interceptors/moveCursor";
import terminalIO from "../../../../src/core/terminal/io/terminal.io";

describe('moveCursorInterceptor()', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        [0, 0],
        [10, 20],
        [-10, -20],
    ])(
        'forwards x %i and y %i to terminalIO.moveCursor()',
        (x, y) => {
            const moveCursor = vi
                .spyOn(terminalIO, 'moveCursor')
                .mockReturnValue(true);

            expect(moveCursorInterceptor(x, y)).toBe(true);

            expect(moveCursor).toHaveBeenCalledTimes(1);
            expect(moveCursor).toHaveBeenCalledWith(x, y);
        }
    );

    it('forwards the callback', () => {
        const callback = jest.fn();

        const moveCursor = vi
            .spyOn(terminalIO, 'moveCursor')
            .mockReturnValue(true);

        moveCursorInterceptor(10, 20, callback);

        expect(moveCursor).toHaveBeenCalledTimes(1);
        expect(moveCursor).toHaveBeenCalledWith(10, 20, callback);
    });

    it('returns the result from terminalIO.moveCursor()', () => {
        const moveCursor = vi
            .spyOn(terminalIO, 'moveCursor')
            .mockReturnValue(false);

        expect(moveCursorInterceptor(10, 20)).toBe(false);

        expect(moveCursor).toHaveBeenCalledTimes(1);
        expect(moveCursor).toHaveBeenCalledWith(10, 20);
    });
});