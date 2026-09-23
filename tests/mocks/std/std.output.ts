import stdController from "./controller";
import StdMockBase from "./std.base";
import { mock } from "bun:test";
import type { Std, StdOutput } from "./types";

class StdOutputMock<T extends StdOutput> extends StdMockBase<StdOutput> {
    constructor(type: T) {
        super(type);
    }

    cursorTo = mock((...args: Parameters<Std<T>['cursorTo']>) => {
        stdController.newCall({
            source: this.type,
            command: 'cursorTo',
            args
        });

        return true;
    });

    moveCursor = mock((...args: Parameters<Std<T>['moveCursor']>) => {
        stdController.newCall({
            source: this.type,
            command: 'moveCursor',
            args
        });

        return true;
    });

    clearLine = mock((...args: Parameters<Std<T>['clearLine']>) => {
        stdController.newCall({
            source: this.type,
            command: 'clearLine',
            args
        });

        return true;
    });

    clearScreenDown = mock((...args: Parameters<Std<T>['clearScreenDown']>) => {
        stdController.newCall({
            source: this.type,
            command: 'clearScreenDown',
            args
        });

        return true;
    });
}

export default StdOutputMock;