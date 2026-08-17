import ScreenEngine from "../screen/engine";
import { EventEmitter } from "@nasriya/atomix/tools";
import type { TerminalLogEvents } from "../events/types";

class ZexiTerminalController {
    #_screenEngine?: ScreenEngine;
    #_events?: EventEmitter<TerminalLogEvents>;

    get screenEngine(): ScreenEngine {
        if (!this.#_screenEngine) {
            this.#_screenEngine = new ScreenEngine();
        }

        return this.#_screenEngine;
    }

    get events(): EventEmitter<TerminalLogEvents> {
        if (!this.#_events) {
            this.#_events = new EventEmitter<TerminalLogEvents>();
            this.#_events.maxTotalHandlers = Infinity;
        }

        return this.#_events;
    }
}

const ZexiTerminalControllerInstance = new ZexiTerminalController();
export default ZexiTerminalControllerInstance;