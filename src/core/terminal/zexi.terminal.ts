import ScreenEngine from "./screen/engine";
import consoleStyler from "./styling/consoleStyler";
import { getLogContext } from "./helpers/helpers";
import type { LogFormatOptions, ZexiLogLevel } from "./types";


class ZexiTerminal {
    readonly #_renderer = new ScreenEngine();

    readonly #_helpers = {
        printOnLevel: (input: unknown, logLevel: ZexiLogLevel, options?: LogFormatOptions) => {
            const { tag, colorCode } = getLogContext(logLevel);
            const { value, originalType } = dataConverter.convert(input);

            const parts = [
                tag,
                colorCode,
                value
            ]

            if (logLevel === 'trace' && originalType !== 'error') {
                try {
                    throw new Error();
                } catch (error) {
                    const originalStack = (error as Error).stack;

                    if (originalStack) {
                        // Detect and remove the irrelevant part of the stack trace
                        const lines = originalStack.split('\n')

                        const INTERNAL_PATH = '@nasriya/zexi';
                        const output = lines.filter(line => !line.includes(INTERNAL_PATH));
                        parts.push(`\n${output.join('\n')}`);
                    }
                }
            }

            // Reset the styling
            parts.push(this.consoleStyler.ansi.reset);

            // construct the output
            const output = parts.join('');

            // render the output
            this.#_renderer.create({ value: output, final: true });
        }
    }

    readonly consoleStyler = consoleStyler;

    warn(input: unknown, options?: Pick<LogFormatOptions, 'color'>) {
        this.#_helpers.printOnLevel(input, 'warn', options);
    }

    error(input: unknown, options?: Pick<LogFormatOptions, 'color'>) {
        this.#_helpers.printOnLevel(input, 'error', options);
    }

    fatal(input: unknown, options?: Pick<LogFormatOptions, 'color'>) {
        this.#_helpers.printOnLevel(input, 'fatal', options);
    }

    log(input: unknown, options?: LogFormatOptions) {
        this.#_helpers.printOnLevel(input, 'log', options);
    }

    debug(input: unknown, options?: Pick<LogFormatOptions, 'color'>) {
        this.#_helpers.printOnLevel(input, 'debug', options);
    }

    info(input: unknown, options?: Pick<LogFormatOptions, 'color'>) {
        this.#_helpers.printOnLevel(input, 'info', options);
    }

    trace(input: unknown, options?: LogFormatOptions) {
        this.#_helpers.printOnLevel(input, 'trace', options);
    }
}