export class StdoutMock {
    buffer: string[] = [];
    cursor = { x: 0, y: 0 };

    write = jest.fn((str: string) => {
        this.buffer.push(str);
    });

    cursorTo = jest.fn((x: number, y?: number) => {
        this.cursor.x = x;
        if (typeof y === 'number') {
            this.cursor.y = y;
        }
    });

    clearLine = jest.fn((_dir?: number) => {
        this.buffer.push('[clearLine]');
    });

    clearScreenDown = jest.fn(() => {
        this.buffer.push('[clearScreenDown]');
    });

    reset() {
        this.buffer = [];
        this.cursor = { x: 0, y: 0 };
        jest.clearAllMocks();
    }

    output() {
        return this.buffer.join('');
    }
}