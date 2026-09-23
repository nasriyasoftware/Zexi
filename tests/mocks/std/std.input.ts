import stdController from "./controller";
import StdMockBase from "./std.base";
import { mock } from "bun:test";
import type { StdInput, Std } from "./types";

class StdInputMock extends StdMockBase<StdInput> {
    constructor(type: StdInput) {
        super(type);
    }

    setRawMode = mock((...args: Parameters<Std<StdInput>['setRawMode']>) => {
        stdController.newCall({
            source: this.type,
            command: 'setRawMode',
            args
        });
    });

    resume = mock((...args: Parameters<Std<StdInput>['resume']>) => {
        stdController.newCall({
            source: this.type,
            command: 'resume',
            args
        });
    });

    pause = mock((...args: Parameters<Std<StdInput>['pause']>) => {
        stdController.newCall({
            source: this.type,
            command: 'pause',
            args
        });
    });
}

export default StdInputMock;