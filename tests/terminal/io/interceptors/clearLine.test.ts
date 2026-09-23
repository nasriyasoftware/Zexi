import clearLineInterceptor from "../../../../src/core/terminal/io/interceptors/clearLine";
import terminalIO from "../../../../src/core/terminal/io/terminal.io";

describe('clearLineInterceptor()', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([-1, 0, 1] as const)(
        'forwards direction %i to terminalIO.clearLine()',
        (direction) => {
            const clearLine = vi
                .spyOn(terminalIO, 'clearLine')
                .mockReturnValue(true);

            expect(clearLineInterceptor(direction)).toBe(true);

            expect(clearLine).toHaveBeenCalledTimes(1);
            expect(clearLine).toHaveBeenCalledWith(direction);
        }
    );

    it('forwards the callback', () => {
        const callback = jest.fn();

        const clearLine = vi
            .spyOn(terminalIO, 'clearLine')
            .mockReturnValue(true);

        clearLineInterceptor(1, callback);

        expect(clearLine).toHaveBeenCalledTimes(1);
        expect(clearLine).toHaveBeenCalledWith(1, callback);
    });

    it('returns the result from terminalIO.clearLine()', () => {
        const clearLine = vi
            .spyOn(terminalIO, 'clearLine')
            .mockReturnValue(false);

        expect(clearLineInterceptor(0)).toBe(false);

        expect(clearLine).toHaveBeenCalledWith(0);
    });
});