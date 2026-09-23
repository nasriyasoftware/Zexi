import consoleStyler from "../../../src/core/terminal/styling/styler";
import StdInputMock from "./std.input";
import StdOutputMock from "./std.output";
import type { ExpectPublicOptions, InputCMDs, MockedCall, OutputCMDs, StdInput, StdOutput } from "./types";

export const CURSOR_POSITION_RESPONSE = { row: 12, column: 34 } as const;

class StdController {
    readonly #_calls: MockedCall<StdOutput | StdInput>[] = [];
    readonly #_stds = {
        out: new StdOutputMock('stdout'),
        err: new StdOutputMock('stderr'),
        in: new StdInputMock('stdin')
    };

    readonly #_helpers = {
        respondTo: {
            cursorPositionQuery: () => {
                setTimeout(() => {
                    this.#_helpers.emitToStdin(
                        `\x1b[${CURSOR_POSITION_RESPONSE.row};${CURSOR_POSITION_RESPONSE.column}R`
                    );
                }, 100);
            }
        },
        emitToStdin: (data: string) => {
            this.getCalls(call =>
                call.source === 'stdin' &&
                (call.command === 'on' || call.command === 'once') &&
                call.args[0] === 'data'
            ).forEach(call => {
                const [, listener] = call.args;
                listener?.(Buffer.isBuffer(data) ? data : Buffer.from(data));
            });
        }
    }

    reset() {
        this.#_calls.length = 0;
        if (this.#_stds?.out) { this.#_stds.out.isTTY = true; }
        if (this.#_stds?.err) { this.#_stds.err.isTTY = true; }
        if (this.#_stds?.in) { this.#_stds.in.isTTY = true; }
    }

    newCall(call: MockedCall<StdOutput | StdInput>) {
        this.#_calls.push(call);

        if (
            call.command === 'emit' &&
            call.source === 'stdin'
        ) {
            this.#_helpers.emitToStdin(call.args[1]);
        }

        if (
            call.command === 'write' &&
            call.source === 'stdout' &&
            call.args[0] === '\x1b[6n'
        ) {
            this.#_helpers.respondTo.cursorPositionQuery();
        }
    }

    getCalls(filter?: (call: MockedCall<StdOutput | StdInput>) => boolean) {
        return this.#_calls.filter(filter ?? (() => true));
    }

    expect<
        S extends StdOutput | StdInput,
        C extends (S extends StdOutput ? OutputCMDs : InputCMDs)
    >(
        output: string,
        options: ExpectPublicOptions & {
            source: S,
            command: C
        }
    ) {
        const ignoreANSI = options.ignoreAnsi ?? true;
        const ignoreCase = options.ignoreCase ?? false;
        const not = options.not ?? false;

        const calls = this.#_calls.filter(call =>
            call.source === options.source && call.command === options.command
        );

        const matched = calls.some(call => {
            return call.args.some(arg => {
                const value = ignoreANSI ? consoleStyler.strip(arg) : arg;

                if (value === output) {
                    return true;
                }

                return ignoreCase && value.toLowerCase() === output.toLowerCase();
            })
        });

        if (not) {
            expect(matched).toBe(false);
        } else {
            expect(matched).toBe(true);
        }
    }

    get stdout() {
        return this.#_stds.out;
    }

    get stderr() {
        return this.#_stds.err;
    }

    get stdin() {
        return this.#_stds.in;
    }
}

const stdController = new StdController();
export default stdController;