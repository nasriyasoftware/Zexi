import TerminalEntry from "../../../src/core/terminal/screen/terminal-cell";
import type {
    ScreenCellEngineEvents,
    TerminalEntryUpdateLogger
} from "../../../src/core/terminal/screen/types";

const createEvents = (): ScreenCellEngineEvents => ({
    onUpdate: () => { },
    onRemove: () => { }
});

describe("TerminalEntry", () => {
    let entry: TerminalEntry;
    let logger: jest.MockedFunction<TerminalEntryUpdateLogger>;

    beforeEach(() => {
        logger = jest.fn();

        entry = new TerminalEntry(
            createEvents(),
            {
                value: "Initial"
            }
        );

        TerminalEntry.attachLogger(entry, logger);
    });

    describe("construction", () => {
        it("creates an entry with the initial value", () => {
            expect(entry.value).toBe("Initial");
            expect(entry.final).toBe(false);
            expect(entry.height).toBe(1);
            expect(entry.template).toBeUndefined();
            expect(entry.params).toEqual({});
        });

        it("supports template-based entries", () => {
            const templateEntry = new TerminalEntry(
                createEvents(),
                {
                    params: {
                        name: "World"
                    },
                    template: "Hello ${name}"
                }
            );

            TerminalEntry.attachLogger(templateEntry, logger);

            expect(templateEntry.value).toBe("Hello World");
            expect(templateEntry.template).toBe("Hello ${name}");
            expect(templateEntry.params).toEqual({
                name: "World"
            });
        });

        it("does not invoke the logger during construction", () => {
            const templateEntry = new TerminalEntry(
                createEvents(),
                {
                    params: {
                        name: "World"
                    },
                    template: "Hello ${name}"
                }
            );

            TerminalEntry.attachLogger(templateEntry, logger);

            expect(logger).not.toHaveBeenCalled();
        });
    });

    describe("attachLogger()", () => {
        it("attaches the logger to the entry", () => {
            entry.update("Updated");

            expect(logger).toHaveBeenCalledTimes(1);
        });

        it("throws when a logger is already attached", () => {
            expect(() => {
                TerminalEntry.attachLogger(entry, logger);
            }).toThrow(
                "Invariant violation: logger is already attached."
            );
        });
    });

    describe("update()", () => {
        it("updates the entry value", () => {
            entry.update("Updated");

            expect(entry.value).toBe("Updated");
        });

        it("preserves the active template", () => {
            const templateEntry = new TerminalEntry(
                createEvents(),
                {
                    params: {
                        name: "World"
                    },
                    template: "Hello ${name}"
                }
            );

            TerminalEntry.attachLogger(templateEntry, logger);

            templateEntry.update("Updated");

            expect(templateEntry.value).toBe("Updated");
            expect(templateEntry.template).toBe("Hello ${name}");
            expect(templateEntry.params).toEqual({
                name: "World"
            });
        });

        it("does not log updates by default", () => {
            entry.update("Updated");

            expect(logger).toHaveBeenCalledWith(
                "Updated",
                {
                    log: false,
                    level: "info"
                }
            );
        });

        it("passes the requested log level to the logger", () => {
            entry.update("Updated", {
                log: true,
                level: "error"
            });

            expect(logger).toHaveBeenCalledWith(
                "Updated",
                {
                    log: true,
                    level: "error"
                }
            );
        });

        it("defaults the log level to info", () => {
            entry.update("Updated", {
                log: true
            });

            expect(logger).toHaveBeenCalledWith(
                "Updated",
                {
                    log: true,
                    level: "info"
                }
            );
        });

        it("logs the resulting rendered value", () => {
            entry.update("Updated");

            expect(logger).toHaveBeenLastCalledWith(
                entry.value,
                {
                    log: false,
                    level: "info"
                }
            );
        });

        it("forwards finalization", () => {
            entry.update("Updated", {
                final: true
            });

            expect(entry.value).toBe("Updated");
            expect(entry.final).toBe(true);

            expect(() => {
                entry.update("Another update");
            }).toThrow();
        });

        it("does not pass logging options to ScreenCell", () => {
            entry.update("Updated", {
                log: true,
                level: "warn"
            });

            expect(entry.value).toBe("Updated");
            expect(entry.final).toBe(false);
        });

        it("does not invoke the logger when the underlying update fails", () => {
            entry.finalize();

            expect(() => {
                entry.update("Updated");
            }).toThrow();

            expect(logger).not.toHaveBeenCalled();
        });
    });

    describe("updateParams()", () => {
        beforeEach(() => {
            entry = new TerminalEntry(
                createEvents(),
                {
                    params: {
                        progress: 0,
                        status: "Starting"
                    },
                    template: "${status}: ${progress}%"
                }
            );

            TerminalEntry.attachLogger(entry, logger);
        });

        it("updates the rendered value", () => {
            entry.updateParams({
                progress: 50
            });

            expect(entry.value).toBe("Starting: 50%");
        });

        it("patches parameters by default", () => {
            entry.updateParams({
                progress: 50
            });

            entry.updateParams({
                status: "Downloading"
            });

            expect(entry.value).toBe("Downloading: 50%");
        });

        it("replaces parameters when patch is false", () => {
            entry.updateParams(
                {
                    progress: 50
                },
                {
                    patch: false
                }
            );

            expect(entry.value).toBe("${status}: 50%");
            expect(entry.params).toEqual({
                progress: 50
            });
        });

        it("passes logging options to the logger", () => {
            entry.updateParams(
                {
                    progress: 50
                },
                {
                    log: true,
                    level: "error"
                }
            );

            expect(logger).toHaveBeenCalledWith(
                "Starting: 50%",
                {
                    log: true,
                    level: "error"
                }
            );
        });

        it("defaults logging options", () => {
            entry.updateParams({
                progress: 50
            });

            expect(logger).toHaveBeenCalledWith(
                "Starting: 50%",
                {
                    log: false,
                    level: "info"
                }
            );
        });

        it("forwards finalization", () => {
            entry.updateParams(
                {
                    progress: 100
                },
                {
                    final: true
                }
            );

            expect(entry.value).toBe("Starting: 100%");
            expect(entry.final).toBe(true);

            expect(() => {
                entry.updateParams({
                    progress: 101
                });
            }).toThrow();
        });

        it("forwards patch mode", () => {
            entry.updateParams(
                {
                    progress: 50
                },
                {
                    patch: false
                }
            );

            expect(entry.value).toBe("${status}: 50%");
            expect(entry.params).toEqual({
                progress: 50
            });
        });

        it("logs the resulting rendered value", () => {
            entry.updateParams({
                progress: 75
            });

            expect(logger).toHaveBeenLastCalledWith(
                "Starting: 75%",
                {
                    log: false,
                    level: "info"
                }
            );
        });

        it("does not invoke the logger when the underlying update fails", () => {
            entry.finalize();

            expect(() => {
                entry.updateParams({
                    progress: 50
                });
            }).toThrow();

            expect(logger).not.toHaveBeenCalled();
        });
    });

    describe("finalization", () => {
        it("prevents direct updates after finalization", () => {
            entry.finalize();

            expect(() => {
                entry.update("Updated");
            }).toThrow(
                "Unable to update a terminal entry that has already been finalized"
            );
        });

        it("prevents parameter updates after finalization", () => {
            const templateEntry = new TerminalEntry(
                createEvents(),
                {
                    params: {
                        value: 1
                    },
                    template: "Value: ${value}"
                }
            );

            TerminalEntry.attachLogger(templateEntry, logger);

            templateEntry.finalize();

            expect(() => {
                templateEntry.updateParams({
                    value: 2
                });
            }).toThrow(
                "Unable to update a terminal entry that has already been finalized"
            );

            expect(templateEntry.value).toBe("Value: 1");
            expect(templateEntry.params).toEqual({
                value: 1
            });
        });
    });

    describe("inherited ScreenCell behavior", () => {
        it("emits update notifications through the supplied events object", () => {
            const onUpdate = jest.fn();

            const testEntry = new TerminalEntry(
                {
                    onUpdate,
                    onRemove: () => { }
                },
                {
                    value: "Initial"
                }
            );

            TerminalEntry.attachLogger(testEntry, logger);

            testEntry.update("Updated");

            expect(onUpdate).toHaveBeenCalledTimes(1);
        });

        it("emits removal notifications through the supplied events object", () => {
            const onRemove = jest.fn();

            const testEntry = new TerminalEntry(
                {
                    onUpdate: () => { },
                    onRemove
                },
                {
                    value: "Initial"
                }
            );

            TerminalEntry.attachLogger(testEntry, logger);

            testEntry.remove();

            expect(onRemove).toHaveBeenCalledTimes(1);
        });
    });
});