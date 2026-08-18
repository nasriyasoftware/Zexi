import zexiCLI from "./core/cli/zexi.cli";
import consoleStyler from "./core/terminal/styling/styler";
import zexiTerminal from "./core/terminal/zexi.terminal";

class Zexi {
    readonly cli = zexiCLI;
    readonly terminal = zexiTerminal;
    readonly styler = consoleStyler;
}

const zexi = new Zexi();
export default zexi;