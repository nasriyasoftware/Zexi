import zexi from "./zexi";
import zexiCLI from "./core/cli/zexi.cli";
import consoleStyler from "./core/terminal/styling/styler";
import zexiTerminal from "./core/terminal/zexi.terminal";

/**
 * ---------------------------------------------------------------------
 * 🔷 CLI
 * ---------------------------------------------------------------------
 *
 * Provides direct access to Zexi's command-line interface functionality.
 *
 * The CLI can be imported directly from the package:
 *
 * ```ts
 * import { cli } from '@nasriya/zexi';
 *
 * cli;
 * ```
 *
 * The same component is also available through the default Zexi
 * instance as `zexi.cli`:
 *
 * ```ts
 * import zexi from '@nasriya/zexi';
 *
 * zexi.cli;
 * ```
 *
 * @since 1.0.0
 */
export const cli = zexiCLI;

/**
 * ---------------------------------------------------------------------
 * 🔷 TERMINAL
 * ---------------------------------------------------------------------
 *
 * Provides direct access to Zexi's terminal interaction and output
 * functionality.
 *
 * The terminal can be imported directly from the package:
 *
 * ```ts
 * import { terminal } from '@nasriya/zexi';
 *
 * terminal.info('Hello, world!');
 * ```
 *
 * The same component is also available through the default Zexi
 * instance as `zexi.terminal`:
 *
 * ```ts
 * import zexi from '@nasriya/zexi';
 *
 * zexi.terminal.info('Hello, world!');
 * ```
 *
 * @since 1.0.0
 */
export const terminal = zexiTerminal;

/**
 * ---------------------------------------------------------------------
 * 🔷 STYLER
 * ---------------------------------------------------------------------
 *
 * Provides direct access to Zexi's console styling functionality.
 *
 * The styler can be imported directly from the package:
 *
 * ```ts
 * import { styler } from '@nasriya/zexi';
 *
 * styler.color('Success!', 'green');
 * ```
 *
 * The same component is also available through the default Zexi
 * instance as `zexi.styler`:
 *
 * ```ts
 * import zexi from '@nasriya/zexi';
 *
 * zexi.styler.color('Success!', 'green');
 * ```
 *
 * @since 1.0.0
 */
export const styler = consoleStyler;

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
export default zexi;