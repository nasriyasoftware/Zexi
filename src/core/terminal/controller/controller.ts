import ScreenEngine from "../screen/engine";
import { EventEmitter } from "@nasriya/atomix/tools";
import type { TerminalEvents } from "../events/types";

class ZexiTerminalController {
    #_screenEngine?: ScreenEngine;
    #_events?: EventEmitter<TerminalEvents>;

    get screenEngine(): ScreenEngine {
        if (!this.#_screenEngine) {
            this.#_screenEngine = new ScreenEngine();
        }

        return this.#_screenEngine;
    }

    get events(): EventEmitter<TerminalEvents> {
        if (!this.#_events) {
            this.#_events = new EventEmitter<TerminalEvents>();
            this.#_events.maxTotalHandlers = Infinity;
        }

        return this.#_events;
    }
}

const ZexiTerminalControllerInstance = new ZexiTerminalController();
export default ZexiTerminalControllerInstance;