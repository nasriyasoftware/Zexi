import parseRequest from "../../../../src/core/terminal/io/helpers/req.parser";

describe('parseRequest()', () => {
    it('parses output-only arguments', () => {
        const output = 'Hello';

        expect(parseRequest(output)).toEqual({
            output
        });
    });

    it('parses output and encoding arguments', () => {
        const output = 'Hello';

        expect(parseRequest(output, 'utf8')).toEqual({
            output,
            encoding: 'utf8'
        });
    });

    it('parses output and callback arguments', () => {
        const output = 'Hello';
        const callback = mock();

        expect(parseRequest(output, callback as any)).toEqual({
            output,
            callback
        });
    });

    it('parses output, encoding, and callback arguments', () => {
        const output = 'Hello';
        const callback = mock();

        expect(parseRequest(output, 'utf8', callback as any)).toEqual({
            output,
            encoding: 'utf8',
            callback
        });
    });

    it('preserves Uint8Array output', () => {
        const output = new Uint8Array([1, 2, 3]);

        const result = parseRequest(output);

        expect(result.output).toBe(output);
    });

    it('preserves the callback reference', () => {
        const callback = mock();

        const result = parseRequest('Hello', callback as any);

        expect(result.callback).toBe(callback);
    });

    it('uses the third argument as the callback when encoding is provided', () => {
        const callback = mock();

        const result = parseRequest('Hello', 'utf8', callback);

        expect(result.callback).toBe(callback);
    });

    it('suppresses absolute cursor positioning controls', () => {
        const output = '\x1b[10GHello\x1b[3;5HWorld';

        expect(parseRequest(output)).toEqual({ output: 'HelloWorld' });
    });

    it('suppresses relative cursor movement controls', () => {
        const output = '\x1b[2AHello\x1b[3BWorld\x1b[4C!\x1b[5D';

        expect(parseRequest(output)).toEqual({ output: 'HelloWorld!' });
    });

    it('suppresses line clearing controls', () => {
        const output = '\x1b[2KHello\x1b[KWorld';

        expect(parseRequest(output)).toEqual({ output: 'HelloWorld' });
    });

    it('suppresses screen clearing controls', () => {
        const output = '\x1b[0JHello\x1b[JWorld';

        expect(parseRequest(output)).toEqual({ output: 'HelloWorld' });
    });

    it('suppresses multiple known terminal controls in the same output', () => {
        const output = '\x1b[2K\x1b[1GHello\x1b[2A\x1b[3C\x1b[0JWorld';

        expect(parseRequest(output)).toEqual({ output: 'HelloWorld' });
    });

    it('preserves other ANSI control sequences', () => {
        const output = '\x1b[31mHello\x1b[0m';

        expect(parseRequest(output)).toEqual({ output });
    });

    it('preserves binary output without modification', () => {
        const output = new Uint8Array([
            0x1b, 0x5b, 0x32, 0x4b
        ]);

        const result = parseRequest(output);

        expect(result.output).toBe(output);
    });
});
