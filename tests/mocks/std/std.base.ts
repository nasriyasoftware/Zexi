import stdController from "./controller";
import { mock } from "bun:test";
import type { StdOutput, StdInput, Std } from "./types";

abstract class StdMockBase<T extends StdOutput | StdInput> {
    readonly #_type: T;

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
    });

    on = mock((...args: Parameters<Std<T>['on']>) => {
        stdController.newCall({
            source: this.type,
            command: 'on',
            args
        });
    });

    once = mock((...args: Parameters<Std<T>['once']>) => {
        stdController.newCall({
            source: this.type,
            command: 'once',
            args
        });
    });

    emit = mock((...args: Parameters<Std<T>['emit']>) => {
        stdController.newCall({
            source: this.type,
            command: 'emit',
            args
        });
    });

    off = mock((...args: Parameters<Std<T>['off']>) => {
        stdController.newCall({
            source: this.type,
            command: 'off',
            args
        });
    });

    addListener = mock((...args: Parameters<Std<T>['addListener']>) => {
        stdController.newCall({
            source: this.type,
            command: 'addListener',
            args
        });
    });
}

export default StdMockBase;