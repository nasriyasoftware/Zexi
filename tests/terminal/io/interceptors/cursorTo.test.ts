import cursorToInterceptor from "../../../../src/core/terminal/io/interceptors/cursorTo";
import terminalIO from "../../../../src/core/terminal/io/terminal.io";

describe('cursorToInterceptor()', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([
        [0, 0],
        [10, 20],
    ])(
        'forwards row %i and column %i to terminalIO.cursorTo()',
        (column, row) => {
            const cursorTo = vi
                .spyOn(terminalIO, 'cursorTo')
                .mockReturnValue(true);

            expect(cursorToInterceptor(column, row)).toBe(true);

            expect(cursorTo).toHaveBeenCalledTimes(1);
            expect(cursorTo).toHaveBeenCalledWith(column, row);
        }
    );

    it('forwards the callback', () => {
        const callback = jest.fn();

        const cursorTo = vi
            .spyOn(terminalIO, 'cursorTo')
            .mockReturnValue(true);

        cursorToInterceptor(10, 20, callback);

        expect(cursorTo).toHaveBeenCalledTimes(1);
        expect(cursorTo).toHaveBeenCalledWith(10, 20, callback);
    });

    it('returns the result from terminalIO.cursorTo()', () => {
        const cursorTo = vi
            .spyOn(terminalIO, 'cursorTo')
            .mockReturnValue(false);

        expect(cursorToInterceptor(10, 20)).toBe(false);

        expect(cursorTo).toHaveBeenCalledTimes(1);
        expect(cursorTo).toHaveBeenCalledWith(10, 20);
    });
});