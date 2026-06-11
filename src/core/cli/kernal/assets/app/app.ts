import AppRunner from "../runner/app.runner";
import ZexiStaticCommand from "../command/main/zexi.static.cmd";
import { normalizeName } from "../../utils/utils";
import { ZexiCommandSymbol } from "../keys";
import type { CLIAppHandler } from "../command/types";

class ZexiApp extends ZexiStaticCommand {
    constructor(configs: {
        name: string,
        description?: string,
    }) {
        const name = normalizeName(configs.name || 'Zexi');
        super(name);
        super.description(configs.description || 'A command line tool built with Zexi');
    }

    async run() {
        const rootCMD = this._internal.accessCMD(ZexiCommandSymbol)!;
        const runner = new AppRunner(rootCMD);

        return await runner.run();
    }

    onRun(handler: CLIAppHandler) {
        const root = this._internal.accessCMD(ZexiCommandSymbol)!;
        root.set.handler.onRun(handler);
        return this;
    }
}

export default ZexiApp;