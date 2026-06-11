import ZexiApp from "../../app/app";
import type { CommandMode } from "../types";

/**
 * Tracks one-time delegation of a command to a target application.
 */
class CommandDelegation {
    #_target?: ZexiApp;

    constructor(mode: CommandMode, app?: ZexiApp) {
        if (mode === 'dynamic' && app) {
            if (!(app instanceof ZexiApp)) {
                throw new Error('The "app" argument must be an instance of ZexiApp');
            }

            this.#_target = app;
        }
    }

    /**
     * Indicates whether a delegation target has already been assigned.
     * @returns {boolean}
     */
    get assigned(): boolean { return this.#_target ? true : false }

    /**
     * Returns the delegated target application if one has been assigned.
     */
    get target(): ZexiApp | undefined { return this.#_target }
}

export default CommandDelegation;