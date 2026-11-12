import terminalIO from "@/core/terminal/io";
import { TerminalSizeDetector } from "@/core/terminal/io/shared/size.detector/size.detector";

describe("TerminalSizeDetector", () => {
    afterEach(() => {
        mock.restore();
    });

    it("resolves its initial run after applying the queried dimensions", async () => {
        spyOn(terminalIO.input.query, "terminalSize").mockResolvedValue({
            width: 80,
            height: 10
        });

        const detector = new TerminalSizeDetector();
        const started = detector.run();

        expect(detector.height).not.toBe(10);

        await started;

        expect(detector.width).toBe(80);
        expect(detector.height).toBe(10);
        detector.stop();
    });
});
