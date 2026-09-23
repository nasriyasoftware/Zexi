import clearScreenDownInterceptor from "../../../../src/core/terminal/io/interceptors/clearScreenDown";
import terminalIO from "../../../../src/core/terminal/io/terminal.io";

describe('clearScreenDownInterceptor()', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('forwards the callback', () => {
        const callback = jest.fn();

        const clearScreenDown = vi
            .spyOn(terminalIO, 'clearScreenDown')
            .mockReturnValue(true);

        clearScreenDownInterceptor(callback);

        expect(clearScreenDown).toHaveBeenCalledTimes(1);
        expect(clearScreenDown).toHaveBeenCalledWith(callback);
    });

    it('returns the result from terminalIO.clearScreenDown()', () => {
        const clearScreenDown = vi
            .spyOn(terminalIO, 'clearScreenDown')
            .mockReturnValue(false);

        expect(clearScreenDownInterceptor()).toBe(false);

        expect(clearScreenDown).toHaveBeenCalledTimes(1);
        expect(clearScreenDown).toHaveBeenCalledWith();
    });
});