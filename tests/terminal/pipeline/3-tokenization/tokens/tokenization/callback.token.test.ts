import { CallbackToken } from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens/tokenization/callback.token";

describe("CallbackToken", () => {
    it("executes the handler when run is called", () => {
        let executed = false;

        const token = new CallbackToken(() => {
            executed = true;
        });

        token.run();

        expect(executed).toBe(true);
    });

    it("executes the handler exactly once per run call", () => {
        let count = 0;

        const token = new CallbackToken(() => {
            count++;
        });

        token.run();
        token.run();

        expect(count).toBe(2);
    });

    it("does not expose internal handler function", () => {
        const token = new CallbackToken(() => { });

        expect((token as any)._handler).toBeUndefined();
        expect((token as any).handler).toBeUndefined();
    });

    it("is a callback token with correct kind", () => {
        const token = new CallbackToken(() => { });

        expect(token.kind).toBe("callback");
    });

    it("creates independent instances", () => {
        const a = new CallbackToken(() => { });
        const b = new CallbackToken(() => { });

        expect(a).not.toBe(b);
        expect(a.kind).toBe(b.kind);
    });

    it("does not return a value from run", () => {
        const token = new CallbackToken(() => { });

        expect(token.run()).toBeUndefined();
    });
});