import BaseToken from "../../assets/__base.token__";

/**
 * Begins a new indentation scope within the rendering pipeline.
 *
 * `IndentStart` signals to renderers that all subsequent lines rendered
 * within the current scope should increase their indentation level until
 * a matching `IndentEnd` token is encountered.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `IndentStart` belongs to the semantic token stream and provides
 * structural indentation semantics independently of:
 *
 * - actual whitespace characters
 * - terminal formatting
 * - serialization strategy
 *
 * This separation allows indentation to remain:
 *
 * - renderer-controlled
 * - width-aware
 * - layout-aware
 * - target-independent
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The token exists to represent logical indentation structure
 * without embedding physical indentation into strings.
 *
 * This allows renderers to:
 *
 * - apply tabs or spaces dynamically
 * - collapse indentation in compact layouts
 * - support pretty-print formatting
 * - coordinate nested rendering scopes
 *
 * ---------------------------------------------------------------------
 * 🔷 INDENTATION MODEL
 * ---------------------------------------------------------------------
 *
 * Indentation scopes are stack-based.
 *
 * Each `IndentStart` increases the active indentation depth
 * until a matching `IndentEnd` closes the scope.
 *
 * Example:
 *
 * ```text
 * {
 *     nested: {
 *         value: 1
 *     }
 * }
 * ```
 *
 * Nested structures commonly introduce additional indentation scopes.
 *
 * ---------------------------------------------------------------------
 * 🔷 RELATIONSHIP WITH GROUP TOKENS
 * ---------------------------------------------------------------------
 *
 * Indentation scopes are independent from grouping scopes.
 *
 * A renderer may:
 *
 * - increase indentation
 * - keep content inline
 * - collapse groups entirely
 *
 * without changing semantic indentation ownership.
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * Renderers are responsible for:
 *
 * - tracking indentation depth
 * - applying indentation strings
 * - deciding indentation width
 * - deciding tabs vs spaces
 *
 * `IndentStart` itself contributes no visible output.
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `IndentStart` contributes:
 *
 * - zero printable width
 * - zero visible characters
 *
 * It is purely structural.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class IndentStart extends BaseToken<'indent-start'> {
    /**
     * Creates a new indentation scope start token.
     *
     * @since 1.0.0
     */
    constructor() {
        super('indent-start');
    }
}