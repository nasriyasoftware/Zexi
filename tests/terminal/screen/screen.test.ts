import { StdoutMock } from '../../mocks/stdout.mock';
import ScreenEngine from '../../../src/core/terminal/screen/engine';

describe('ScreenEngine', () => {
    let mock: StdoutMock;

    beforeEach(() => {
        mock = new StdoutMock();

        // Replace stdout
        Object.defineProperty(process, 'stdout', {
            value: mock,
            configurable: true
        });
    });

    afterEach(() => {
        mock.reset();
    });

    // Creates and renders a cell
    it('renders initial value', () => {
        const renderer = new ScreenEngine();

        renderer.create({ value: 'Hello\n' });

        expect(mock.write).toHaveBeenCalledWith('Hello\n');
    });

    // Updates without height change (uses clearLine)
    it('updates same height using clearLine only', () => {
        const renderer = new ScreenEngine();

        const cell = renderer.create({ value: 'Hello\n' });
        mock.reset();

        cell.update('World\n');

        expect(mock.clearLine).toHaveBeenCalled();
        expect(mock.clearScreenDown).not.toHaveBeenCalled();
        expect(mock.write).toHaveBeenCalledWith('World\n');
    });

    // Updates with height change (cascade)
    it('re-renders below when height changes', () => {
        const renderer = new ScreenEngine();

        const a = renderer.create({ value: 'A\n' });
        const b = renderer.create({ value: 'B\n' });

        mock.reset();

        a.update('A\nA2\n'); // height change

        expect(mock.clearScreenDown).toHaveBeenCalled();

        // Should re-render both A and B
        expect(mock.write).toHaveBeenCalledWith('A\nA2\n');
        expect(mock.write).toHaveBeenCalledWith('B\n');
    });

    // No-op when value unchanged
    it('does nothing if value does not change', () => {
        const renderer = new ScreenEngine();

        const cell = renderer.create({ value: 'Hello\n' });
        mock.reset();

        cell.update('Hello\n');

        expect(mock.write).not.toHaveBeenCalled();
    });

    // Cursor positioning is correct
    it('positions cursor correctly before writing', () => {
        const renderer = new ScreenEngine();

        renderer.create({ value: 'A\n' });
        renderer.create({ value: 'B\n' });

        const cell = renderer.create({ value: 'C\n' });

        mock.reset();

        cell.update('Z\n');

        expect(mock.cursorTo).toHaveBeenCalled();
    });
});