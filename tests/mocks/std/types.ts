import type StdInputMock from "./std.input";
import type StdOutputMock from "./std.output";

export type StdOutput = 'stdout' | 'stderr';
export type StdInput = 'stdin';
export type Std<T extends StdOutput | StdInput> = typeof process[T];

type SharedCMDs =
    | 'removeListener'
    | 'addListener'
    | 'on'
    | 'emit'
    | 'once'
    | 'off';

export type OutputCMDs =
    | 'write'
    | 'moveCursor'
    | 'cursorTo'
    | 'clearLine'
    | 'clearScreenDown'
    | 'moveCursorUp'
    | 'moveCursorDown'
    | 'moveCursorLeft'
    | 'moveCursorRight'
    | SharedCMDs;

export type InputCMDs =
    | 'setRawMode'
    | 'resume'
    | 'pause'
    | SharedCMDs;


export type MockedCall<T extends StdOutput | StdInput> = {
    source: T;
    command: T extends StdInput ? InputCMDs : OutputCMDs;
    args: any[];
}

export type ExpectPublicOptions = {
    ignoreAnsi?: boolean;
    ignoreCase?: boolean;
    not?: boolean;
}

export type MockType<T extends StdOutput | StdInput> =
    T extends StdInput ? StdInputMock :
    T extends 'stdout' ? StdOutputMock<'stdout'> :
    T extends 'stderr' ? StdOutputMock<'stderr'> :
    never