import StdMocks from "../mocks/std";
import terminalIO, { ZexiTerminalIO } from '@/core/terminal/io';

process.env.ZEXI_ENV = 'testing';

terminalIO.output.interception.uninstall();

ZexiTerminalIO.replaceStreams({
    output: StdMocks.stdout,
    input: StdMocks.stdin,
    error: StdMocks.stderr
});

terminalIO.output.interception.intercepting = true;
StdMocks.reset();