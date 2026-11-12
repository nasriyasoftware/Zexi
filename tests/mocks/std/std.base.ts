import stdController from "./controller";
import { mock } from "bun:test";
import { EventEmitter } from "node:events";
import type { StdOutput, StdInput, Std } from "./types";

abstract class StdMockBase<T extends StdOutput | StdInput> {
    readonly #_type: T;
    readonly #_dimensions = { rows: 24, columns: 80 };
    readonly #_events = new EventEmitter();

    constructor(type: T) {
        this.#_type = type;
    }

    get type() {
        return this.#_type;
    }

    isTTY: boolean = true;

    reset() {
        stdController.reset();
        this.isTTY = true;
    }

    write = mock((...args: Parameters<Std<T>['write']>) => {
        stdController.newCall({
            source: this.type,
            command: 'write',
            args
        });

        return true;
    });

    removeListener = mock((...args: Parameters<Std<T>['removeListener']>) => {
        stdController.newCall({
            source: this.type,
            command: 'removeListener',
            args
        });

        this.#_events.removeListener(args[0], args[1]);
    });

    on = mock((...args: Parameters<Std<T>['on']>) => {
        stdController.newCall({
            source: this.type,
            command: 'on',
            args
        });

        this.#_events.on(args[0], args[1]);
    });

    once = mock((...args: Parameters<Std<T>['once']>) => {
        stdController.newCall({
            source: this.type,
            command: 'once',
            args
        });

        this.#_events.once(args[0], args[1]);
    });

    emit = mock((...args: Parameters<Std<T>['emit']>) => {
        stdController.newCall({
            source: this.type,
            command: 'emit',
            args
        });

        if (args[0] === 'resize') {
            this.#_dimensions.rows = args[1]?.rows || 24;
            this.#_dimensions.columns = args[1]?.columns || 80;
        }

        return this.#_events.emit(args[0], ...args.slice(1));
    });

    off = mock((...args: Parameters<Std<T>['off']>) => {
        stdController.newCall({
            source: this.type,
            command: 'off',
            args
        });

        this.#_events.off(args[0], args[1]);
    });

    addListener = mock((...args: Parameters<Std<T>['addListener']>) => {
        stdController.newCall({
            source: this.type,
            command: 'addListener',
            args
        });

        this.#_events.addListener(args[0], args[1]);
    });

    get columns() { return this.#_dimensions.columns; }
    get rows() { return this.#_dimensions.rows; }
}

export default StdMockBase;