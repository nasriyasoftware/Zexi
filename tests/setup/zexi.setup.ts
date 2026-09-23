import StdMocks from "../mocks/std";
import terminalIO from "../../src/core/terminal/io/terminal.io";

process.env.ZEXI_ENV = 'testing';

terminalIO.replaceStreams({
    output: StdMocks.stdout,
    input: StdMocks.stdin,
    error: StdMocks.stderr
});

terminalIO.intercepting = true;
StdMocks.reset();