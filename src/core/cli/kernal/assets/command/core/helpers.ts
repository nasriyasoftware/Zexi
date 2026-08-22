import globalUtils from "../../../../../../utils";
import zexiTerminal from "../../../../../terminal/zexi.terminal";
import type { CommandContext } from "../../runner/context/cmd.context";
import type { CLICommandHandler, CLICommandMiddlewareHandler, MiddlewareTerminateFunction, MiddlewareTerminateResult } from "../types";

/**
 * Composes middleware functions into a single handler function.
 *
 * @param {CLICommandMiddlewareHandler[]} middlewares - The middleware functions to compose.
 * @param {CLICommandHandler} [action] - The action handler to execute after the middleware functions.
 * @returns {(ctx: CommandContext) => Promise<void>} - The composed handler function.
 * @throws {TypeError} - If the middlewares or action parameters are not of the expected types.
 */
export function compose(middlewares: CLICommandMiddlewareHandler[], action?: CLICommandHandler): (ctx: CommandContext) => Promise<unknown> {
    return async function run(ctx: CommandContext): Promise<unknown> {
        let terminationResult: MiddlewareTerminateResult | undefined;
        let terminated = false;
        let processed = 0;

        /**
         * Terminates the middleware processing flow and provides a termination result.
         *
         * @param {MiddlewareTerminateResult} result - The termination result.
         */
        const terminate: MiddlewareTerminateFunction = (result: MiddlewareTerminateResult) => {
            if (terminated) {
                throw new Error('terminate() called more than once');
            }

            terminated = true;

            if (result === undefined) {
                throw new SyntaxError(`The command middleware was terminated without specifying the result.`);
            }

            if (!globalUtils.isRecord(result)) {
                throw new TypeError(`The command middleware result must be an object literal, received ${typeof result}.`);
            }

            if (globalUtils.hasOwnProp(result, 'ok')) {
                const value = result.ok;
                if (typeof value !== 'boolean') {
                    throw new TypeError(`The "ok" property of the command middleware result must be a boolean, received ${typeof value}.`);
                }
            } else {
                throw new SyntaxError(`The command middleware result must contain a "ok" property.`);
            }

            if (result.ok) {
                if (globalUtils.hasOwnProp(result, 'message')) {
                    const value = result.message;
                    if (typeof value !== 'string') {
                        throw new TypeError(`The "message" property of the command middleware success result must be a string, received ${typeof value}.`);
                    }

                    if (value.trim().length === 0) {
                        throw new SyntaxError(`The "message" property of the command middleware success result cannot be an empty string.`);
                    }

                    result.message = value.trim();
                }
            } else {
                if (globalUtils.hasOwnProp(result, 'reason')) {
                    const value = result.reason;
                    if (typeof value !== 'string') {
                        throw new TypeError(`The "reason" property of the command middleware failure result must be a string, received ${typeof value}.`);
                    }

                    if (!(value === 'error' || value === 'user_error')) {
                        throw new SyntaxError(`The "reason" property of the command middleware failure result must be "error" or "user_error".`);
                    }

                    if (value === 'error') {
                        if (globalUtils.hasOwnProp(result, 'error')) {
                            const error = result.error;
                            if (!(error instanceof Error)) {
                                throw new TypeError(`The "error" property of the command middleware error result must be an instance of Error, received ${typeof error}.`);
                            }
                        } else {
                            throw new SyntaxError(`The command middleware error result must contain an "error" property.`);
                        }
                    }

                    if (value === 'user_error') {
                        if (globalUtils.hasOwnProp(result, 'message')) {
                            const message = result.message;
                            if (typeof message !== 'string') {
                                throw new TypeError(`The "message" property of the command middleware user error result must be a string, received ${typeof message}.`);
                            }

                            if (message.trim().length === 0) {
                                throw new SyntaxError(`The "message" property of the command middleware user error result cannot be an empty string.`);
                            }

                            result.message = message.trim();
                        } else {
                            throw new SyntaxError(`The command middleware user error result must contain a "message" property.`);
                        }

                        if (globalUtils.hasOwnProp(result, 'meta')) {
                            if (!globalUtils.isRecord(result.meta)) {
                                throw new TypeError(`The "meta" property of the command middleware user error result must be an object literal, received ${typeof result.meta}.`);
                            }

                            const meta = result.meta;
                            if (globalUtils.hasOwnProp(meta, 'source')) {
                                const source = meta.source;
                                if (typeof source !== 'string') {
                                    throw new TypeError(`The "source" property of the "meta" property of the command middleware user error result must be a string, received ${typeof source}.`);
                                }

                                if (source.trim().length === 0) {
                                    throw new SyntaxError(`The "source" property of the "meta" property of the command middleware user error result cannot be an empty string.`);
                                }

                                meta.source = source.trim();
                            }
                        }
                    }
                } else {
                    throw new SyntaxError(`The command middleware failure result must contain a "reason" property.`);
                }
            }

            terminationResult = result;
        }

        while (processed < middlewares.length && !terminated) {
            const mdware = middlewares[processed];

            try {
                await mdware(ctx, terminate);
                processed++;
            } catch (error) {
                terminate({ ok: false, reason: 'error', error: error as Error });
            }
        }

        if (terminated) {
            const res = terminationResult!;
            if (res.ok) {
                if (res.message) { zexiTerminal.debug(res.message); }
            } else {
                if (res.reason === 'error') {
                    throw res.error;
                }

                if (res.reason === 'user_error') {
                    zexiTerminal.error(res.message);
                    if (res.meta) { zexiTerminal.debug(res.meta); }
                }
            }
            return;
        }

        return await action?.(ctx);
    }
}