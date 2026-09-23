import consoleStyler from "../../../src/core/terminal/styling/styler";
import ct from "./controller";
import StdInputMock from "./std.input";
import StdOutputMock from "./std.output";
import { ExpectPublicOptions, MockedCall, MockType, StdInput, StdOutput } from "./types";

class StdMocks {
    static reset() {
        ct.reset();
    }

    static get stdout() { return ct.stdout; }
    static get stderr() { return ct.stderr; }
    static get stdin() { return ct.stdin; }

    static expect = {
        stdout: {
            write: {
                toHaveBeenCalledWith: (output: string, options: ExpectPublicOptions = {}) => {
                    return ct.expect(output, {
                        ...options,
                        source: 'stdout',
                        command: 'write'
                    })
                },

                tohaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdout' && c.command === 'write');
                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toNot: {
                    haveBeenCalledWith: (output: string, options: ExpectPublicOptions = {}) => {
                        return this.expect.stdout.write.toHaveBeenCalledWith(output, { ...options, not: true });
                    },

                    haveBeenCalled: (options?: { not?: boolean }) => {
                        return this.expect.stdout.write.tohaveBeenCalled({ ...options, not: true });
                    }
                }
            },

            clearLine: {
                toHaveBeenCalledWith: (direction: -1 | 0 | 1 = 0, options: ExpectPublicOptions = {}) => {
                    const ansiDirection = direction === -1 ? 2 : direction;
                    const sequence = `\x1b[${ansiDirection}K`;

                    return ct.expect(sequence, {
                        ...options,
                        source: 'stdout',
                        command: 'write'
                    })
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => {
                        const base = c.source === 'stdout' && c.command === 'write';

                        const seqRegex = /\x1b\[(\d+)K/;
                        return base && seqRegex.test(c.args[0]);
                    });

                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => {
                        const base = c.source === 'stdout' && c.command === 'write';

                        const seqRegex = /\x1b\[(\d+)K/;
                        return base && seqRegex.test(c.args[0]);
                    });

                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalled: () => {
                        const calls = ct.getCalls(c => c.source === 'stdout' && c.command === 'write');
                        expect(calls.length).toBe(0);
                    },

                    haveBeenCalledWith: (direction: -1 | 0 | 1 = 0, options: ExpectPublicOptions = {}) => {
                        return this.expect.stdout.clearLine.toHaveBeenCalledWith(direction, { ...options, not: true });
                    }
                }
            },

            clearScreenDown: {
                toHaveBeenCalledWith: (options: ExpectPublicOptions = {}) => {
                    const sequence = '\x1b[0J';
                    return ct.expect(sequence, {
                        ...options,
                        source: 'stdout',
                        command: 'write'
                    })
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdout' && c.command === 'write' && c.args[0] === '\x1b[0J');
                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdout' && c.command === 'write' && c.args[0] === '\x1b[0J');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalledWith: (options: ExpectPublicOptions = {}) => {
                        return this.expect.stdout.clearScreenDown.toHaveBeenCalledWith({ ...options, not: true });
                    },

                    haveBeenCalled: (options?: { not?: boolean }) => {
                        return this.expect.stdout.clearScreenDown.toHaveBeenCalled({ ...options, not: true });
                    }
                }
            },

            cursorTo: {
                toHaveBeenCalledWith: (x: number, y: number | undefined, options: ExpectPublicOptions = {}) => {
                    const sequence = y === undefined
                        ? `\x1b[${x + 1}G`
                        : `\x1b[${y + 1};${x + 1}H`;

                    return ct.expect(sequence, {
                        ...options,
                        source: 'stdout',
                        command: 'write'
                    })
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => {
                        const base = c.source === 'stdout' && c.command === 'write';

                        const value = c.args[0];
                        const onlyXRegex = /\x1b\[(\d+)G/;
                        const seqRegex = /\x1b\[(\d+);(\d+)H/;

                        return base && (onlyXRegex.test(value) || seqRegex.test(value));
                    });

                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => {
                        const base = c.source === 'stdout' && c.command === 'write';

                        const value = c.args[0];
                        const onlyXRegex = /\x1b\[(\d+)G/;
                        const seqRegex = /\x1b\[(\d+);(\d+)H/;

                        return base && (onlyXRegex.test(value) || seqRegex.test(value));
                    });

                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalledWith: (column: number, row: number, options: ExpectPublicOptions = {}) => {
                        return this.expect.stdout.cursorTo.toHaveBeenCalledWith(column, row, { ...options, not: true });
                    },

                    haveBeenCalled: (options?: { not?: boolean }) => {
                        return this.expect.stdout.cursorTo.toHaveBeenCalled({ ...options, not: true });
                    }
                }
            }
        },

        stderr: {
            write: {
                toHaveBeenCalledWith: (output: string, options: ExpectPublicOptions = {}) => {
                    return ct.expect(output, {
                        ...options,
                        source: 'stderr',
                        command: 'write'
                    })
                },

                toNot: {
                    haveBeenCalledWith: (output: string, options: ExpectPublicOptions = {}) => {
                        return this.expect.stderr.write.toHaveBeenCalledWith(output, { ...options, not: true });
                    }
                }
            }
        },

        stdin: {
            on: {
                toHaveBeenCalledWith: (eventName: string, listener?: ((...args: any[]) => void) | undefined, options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'on' && c.args[0] === eventName);

                    if (typeof listener === 'function') {
                        const matched = calls.some(call => call.args[1] === listener);
                        expect(matched).toBe(!not);
                    } else {
                        if (not) {
                            expect(calls.length).toBe(0);
                            return;
                        }

                        expect(calls.length).toBeGreaterThan(0);
                    }
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'on');
                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'on');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalledWith: (eventName: string, listener?: ((...args: any[]) => void) | undefined) => {
                        return this.expect.stdin.on.toHaveBeenCalledWith(eventName, listener, { not: true });
                    },

                    haveBeenCalled: () => {
                        return this.expect.stdin.on.toHaveBeenCalled({ not: true });
                    }
                }
            },

            off: {
                toHaveBeenCalledWith: (eventName: string, listener?: ((...args: any[]) => void) | undefined, options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'off' && c.args[0] === eventName);

                    if (typeof listener === 'function') {
                        const matched = calls.some(call => call.args[1] === listener);
                        expect(matched).toBe(!not);
                    } else {
                        if (not) {
                            expect(calls.length).toBe(0);
                            return;
                        }

                        expect(calls.length).toBeGreaterThan(0);
                    }
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'off');
                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'off');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalledWith: (eventName: string, listener?: ((...args: any[]) => void) | undefined) => {
                        return this.expect.stdin.off.toHaveBeenCalledWith(eventName, listener, { not: true });
                    },

                    haveBeenCalled: () => {
                        return this.expect.stdin.off.toHaveBeenCalled({ not: true });
                    }
                }
            },

            setRawMode: {
                toHaveBeenCalledWith: (value: boolean, options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'setRawMode');

                    const matched = calls.some(call => call.args[0] === value);
                    expect(matched).toBe(!not);
                },

                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'setRawMode');

                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'setRawMode');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalledWith: (value: boolean) => {
                        return this.expect.stdin.setRawMode.toHaveBeenCalledWith(value, { not: true });
                    },

                    haveBeenCalled: () => {
                        return this.expect.stdin.setRawMode.toHaveBeenCalled({ not: true });
                    }
                }
            },

            resume: {
                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'resume');

                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'resume');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalled: () => {
                        return this.expect.stdin.resume.toHaveBeenCalled({ not: true });
                    }
                }
            },

            pause: {
                toHaveBeenCalled: (options?: { not?: boolean }) => {
                    const not = options?.not ?? false;
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'pause');

                    if (not) {
                        expect(calls.length).toBe(0);
                        return;
                    }

                    expect(calls.length).toBeGreaterThan(0);
                },

                toHaveBeenCalledTimes: (times: number) => {
                    const calls = ct.getCalls(c => c.source === 'stdin' && c.command === 'pause');
                    expect(calls.length).toBe(times);
                },

                toNot: {
                    haveBeenCalled: () => {
                        return this.expect.stdin.pause.toHaveBeenCalled({ not: true });
                    }
                }
            },
        }
    }

    static createNewMock<T extends StdOutput | StdInput>(mockFor: T): MockType<T> {
        const mocked = (() => {
            switch (mockFor) {
                case 'stdout':
                    return new StdOutputMock('stdout');
                case 'stderr':
                    return new StdOutputMock('stderr');
                case 'stdin':
                    return new StdInputMock('stdin');
            }
        })();

        return mocked as MockType<T>;
    }

    static printCalls(filter?: (call: MockedCall<StdOutput | StdInput>) => boolean) {
        const calls = JSON.stringify(ct.getCalls(filter), null, 2);

        const parts = [
            `Total calls: ${calls.length}`,
            '-'.repeat(20),
            calls,
            ''
        ];

        const content = parts.join('\n');
        process.stdout.write(content);
    }
}

export default StdMocks;