import { mock } from "bun:test";
import {
    stdinController,
    TextInputCapture
} from "@/core/terminal/io/input/assets";
import KeyInputSession from "@/core/terminal/io/input/assets/session/key.input.session";
import type TerminalCell from "@/core/terminal/screen/tom/cells/terminal.cell";
import StdMocks from "../../../mocks/std";

async function waitFor(predicate: () => boolean) {
    const deadline = Date.now() + 1_000;

    while (!predicate() && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 1));
    }

    expect(predicate()).toBe(true);
}

describe.serial("stdin sessions and text capture", () => {
    beforeEach(() => {
        StdMocks.reset();
    });

    afterEach(() => {
        mock.restore();
    });

    it("routes raw chunks only to the session that currently owns stdin", async () => {
        const firstHandler = mock();
        const secondHandler = mock();
        const first = stdinController.createSession(firstHandler);
        const second = stdinController.createSession(secondHandler);

        expect(first.status).toBe("Pending");
        expect(second.status).toBe("Pending");
        expect(StdMocks.stdin.setRawMode).not.toHaveBeenCalled();

        await first.start();
        const secondStarted = second.start();

        expect(first.status).toBe("Ready");
        expect(second.status).toBe("Queued");

        const firstChunk = Buffer.from("first");
        StdMocks.stdin.emit("data", firstChunk);
        expect(firstHandler).toHaveBeenCalledWith(firstChunk);
        expect(secondHandler).not.toHaveBeenCalled();

        first.release();
        expect(first.status).toBe("Ready");
        await secondStarted;

        expect(first.status).toBe("Released");
        expect(second.status).toBe("Ready");

        const secondChunk = Buffer.from("second");
        StdMocks.stdin.emit("data", secondChunk);
        expect(firstHandler).toHaveBeenCalledTimes(1);
        expect(secondHandler).toHaveBeenCalledWith(secondChunk);

        second.release();
        await waitFor(() => second.status === "Released");
        expect(StdMocks.stdin.setRawMode).toHaveBeenNthCalledWith(1, true);
        expect(StdMocks.stdin.setRawMode).toHaveBeenNthCalledWith(2, false);
    });

    it("cancels a queued session without interrupting the active owner", async () => {
        const activeHandler = mock();
        const canceledHandler = mock();
        const active = stdinController.createSession(activeHandler);
        const canceled = stdinController.createSession(canceledHandler);

        await active.start();
        const canceledStarted = canceled.start();
        canceled.cancel();
        await canceledStarted;

        expect(canceled.status).toBe("Cancelled");

        const chunk = Buffer.from("active");
        StdMocks.stdin.emit("data", chunk);
        expect(activeHandler).toHaveBeenCalledWith(chunk);
        expect(canceledHandler).not.toHaveBeenCalled();

        active.release();
        await waitFor(() => active.status === "Released");
        await Promise.resolve();

        expect(canceled.status).toBe("Cancelled");
        expect(StdMocks.controller.getCalls(call =>
            call.source === "stdin" && call.command === "setRawMode"
        )).toHaveLength(2);
    });

    it("parses keys for a key-input session and releases on request", async () => {
        const keys: unknown[] = [];
        let release!: () => void;
        const session = new KeyInputSession((key, finish) => {
            keys.push(key);
            release = finish;
        });

        await expect(session.acquire()).resolves.toEqual({ acquired: true });
        StdMocks.stdin.emit("data", Buffer.from("q"));

        await waitFor(() => keys.length === 1);
        expect(keys).toEqual([{ type: "character", value: "q" }]);

        release();
        await waitFor(() => session.status === "Released");
    });

    it("captures and masks text until Enter submits it", async () => {
        const updateParams = mock();
        const cell = { updateParams } as unknown as TerminalCell;
        const capture = TextInputCapture.capture(cell, { privacy: "password" });

        await waitFor(() => StdMocks.stdin.setRawMode.mock.calls.some(
            ([enabled]) => enabled === true
        ));

        StdMocks.stdin.emit("data", Buffer.from("secret"));
        await waitFor(() => updateParams.mock.calls.some(
            ([params]) => params.input === "******"
        ));

        StdMocks.stdin.emit("data", Buffer.from("\r"));

        await expect(capture).resolves.toBe("secret");
        await waitFor(() => StdMocks.stdin.setRawMode.mock.calls.some(
            ([enabled]) => enabled === false
        ));

        expect(updateParams).toHaveBeenCalledWith({ input: "******" });
    });

    it("rejects invalid capture options", () => {
        const cell = { updateParams: mock() } as unknown as TerminalCell;

        expect(() => TextInputCapture.capture(cell, {
            privacy: "unknown" as "visible"
        })).toThrow(TypeError);

        expect(() => TextInputCapture.capture(cell, {
            timeoutAfter: 999
        })).toThrow(RangeError);
    });
});
