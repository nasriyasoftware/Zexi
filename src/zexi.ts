import zexiCLI from "./core/cli/zexi.cli";
import consoleStyler from "./core/terminal/styling/styler";
import zexiTerminal from "./core/terminal/zexi.terminal";

/**
 * ---------------------------------------------------------------------
 * 🔷 ZEXI
 * ---------------------------------------------------------------------
 *
 * Provides the unified API surface for the Zexi package.
 *
 * This class is used internally to compose the package's core
 * components into the {@link zexi} API instance. It is not part of the
 * public package API and is not intended to be instantiated directly.
 *
 * The resulting API is exposed through the package's default export:
 *
 * ```ts
 * import zexi from '@nasriya/zexi';
 *
 * zexi.terminal.info('Hello, world!');
 * ```
 *
 * Individual components can also be imported directly as named exports:
 *
 * ```ts
 * import { terminal } from '@nasriya/zexi';
 *
 * terminal.info('Hello, world!');
 * ```
 *
 * @since 1.0.0
 */
class Zexi {
    /**
     * -----------------------------------------------------------------
     * 🔷 CLI
     * -----------------------------------------------------------------
     *
     * Provides access to Zexi's command-line interface functionality.
     *
     * The CLI component is also available as a direct named export:
     *
     * ```ts
     * import { cli } from '@nasriya/zexi';
     *
     * cli;
     * ```
     *
     * When using the default Zexi instance, the component is available
     * through `zexi.cli`:
     *
     * ```ts
     * import zexi from '@nasriya/zexi';
     *
     * zexi.cli;
     * ```
     *
     * @since 1.0.0
     */
    readonly cli = zexiCLI;

    /**
     * -----------------------------------------------------------------
     * 🔷 TERMINAL
     * -----------------------------------------------------------------
     *
     * Provides access to Zexi's terminal interaction and output
     * functionality.
     *
     * The terminal component is also available as a direct named export:
     *
     * ```ts
     * import { terminal } from '@nasriya/zexi';
     *
     * terminal.info('Hello, world!');
     * ```
     *
     * When using the default Zexi instance, the component is available
     * through `zexi.terminal`:
     *
     * ```ts
     * import zexi from '@nasriya/zexi';
     *
     * zexi.terminal.info('Hello, world!');
     * ```
     *
     * @since 1.0.0
     */
    readonly terminal = zexiTerminal;

    /**
     * -----------------------------------------------------------------
     * 🔷 STYLER
     * -----------------------------------------------------------------
     *
     * Provides access to Zexi's console styling functionality.
     *
     * The styler component is also available as a direct named export:
     *
     * ```ts
     * import { styler } from '@nasriya/zexi';
     *
     * styler.color('Success!', 'green');
     * ```
     *
     * When using the default Zexi instance, the component is available
     * through `zexi.styler`:
     *
     * ```ts
     * import zexi from '@nasriya/zexi';
     *
     * zexi.styler.color('Success!', 'green');
     * ```
     *
     * @since 1.0.0
     */
    readonly styler = consoleStyler;
}

/**
 * ---------------------------------------------------------------------
 * 🔷 ZEXI INSTANCE
 * ---------------------------------------------------------------------
 *
 * The Zexi API instance.
 *
 * This is the single instance through which the package's core
 * components are exposed when using the default package import.
 *
 * ```ts
 * import zexi from '@nasriya/zexi';
 *
 * zexi.terminal.info('Hello, world!');
 * ```
 *
 * The individual components are also available as named exports:
 *
 * ```ts
 * import { terminal } from '@nasriya/zexi';
 *
 * terminal.info('Hello, world!');
 * ```
 *
 * @since 1.0.0
 */
const zexi = new Zexi();
export default zexi;