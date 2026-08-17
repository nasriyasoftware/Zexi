import { DeepReadonly, Prettify } from "@nasriya/atomix";
import type { ZexiLogLevel } from "../types";
import type { StackTraceLine } from "../pipeline/1-graphing/types";

type EventNamesMap = Prettify<{
    'log': `log.${ZexiLogLevel}`;
} & {
    [K in ZexiLogLevel as `log.${K}`]: `log.${K}`;
}>

export type TerminalEvents = {
    [K in keyof EventNamesMap]: (event: DeepReadonly<TerminalEvent<K>>) => void
}

export type TerminalEventName = keyof TerminalEvents;

export type TerminalEvent<N extends TerminalEventName = TerminalEventName> = {
    id: string;
    time: string;
    level: ZexiLogLevel;
    name: N;
    original: {
        value: unknown;
        stack?: StackTraceLine[]
    }
    content: {
        value: string;
        stack?: string;
    }
};

export type UnsubscribeHandler = () => boolean;