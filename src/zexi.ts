import zexiCLI from "./core/cli/zexi.cli";
import zexiTerminal from "./core/terminal/zexi.terminal";

class Zexi {
    readonly cli = zexiCLI;
    readonly terminal = zexiTerminal;
}

const zexi = new Zexi();
export default zexi;