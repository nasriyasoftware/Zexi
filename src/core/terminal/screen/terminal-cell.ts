import ScreenCell from "./cell";

/**
 * Represents a dynamic entry in the terminal output.
 *
 * A terminal entry provides a persistent region of terminal output that can
 * be updated independently after it has been created.
 *
 * Entries are useful for dynamic terminal output such as:
 *
 * - progress indicators
 * - download status
 * - build or deployment status
 * - counters and statistics
 * - long-running task status
 *
 * ---------------------------------------------------------------------
 * 🔷 USAGE
 * ---------------------------------------------------------------------
 *
 * ## Progress indicator
 *
 * ```ts
 * const download = await zexi.terminal.createEntry({
 *     template: 'Downloading package... ${value}%',
 *     params: { value: 0 }
 * });
 *
 * download.updateParams({ value: 25 });
 * download.updateParams({ value: 50 });
 * download.updateParams({ value: 75 });
 * download.updateParams({ value: 100 });
 *
 * download.update('Download complete.');
 * ```
 *
 * ## Build status
 *
 * ```ts
 * const build = await zexi.terminal.createEntry({
 *     value: 'Building project...'
 * });
 *
 * await buildProject();
 * build.update('Build complete.');
 * ```
 *
 * ## Live statistics
 *
 * ```ts
 * const stats = await zexi.terminal.createEntry({
 *     template: 'Processed: ${processed} / ${total}',
 *     params: {
 *         processed: 0,
 *         total: 1000
 *     }
 * });
 *
 * for (let processed = 0; processed <= 1000; processed += 100) {
 *     stats.updateParams({ processed });
 * }
 * ```
 *
 * An entry can be permanently finalized once its output is complete:
 *
 * ```ts
 * const task = await zexi.terminal.createEntry({
 *     value: 'Running task...'
 * });
 *
 * await runTask();
 *
 * task.update('Task complete.');
 * task.finalize();
 * ```
 *
 * @since 1.0.0
 */
class TerminalEntry extends ScreenCell {
    /**
     * Creates a terminal entry from the supplied screen-cell configuration.
     *
     * @param args - Screen-cell construction arguments.
     *
     * @since 1.0.0
     */
    constructor(...args: ConstructorParameters<typeof ScreenCell>) {
        super(...args);
    }
}

export default TerminalEntry;