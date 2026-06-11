import BaseToken from "../../assets/__base.token__";

/**
 * Terminates an active indentation scope within the rendering pipeline.
 *
 * `IndentEnd` signals that the current indentation level should be
 * decreased and that subsequent rendered lines should return to the
 * previous indentation depth.
 *
 * ---------------------------------------------------------------------
 * 🔷 ARCHITECTURAL ROLE
 * ---------------------------------------------------------------------
 *
 * `IndentEnd` closes an indentation scope previously opened by
 * `IndentStart`.
 *
 * Together, these tokens allow renderers to maintain structured,
 * nested indentation without embedding physical whitespace into
 * semantic tokens.
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN INTENT
 * ---------------------------------------------------------------------
 *
 * The token exists to:
 *
 * - restore parent indentation state
 * - terminate nested indentation scopes
 * - support multiline structured layouts
 * - preserve indentation semantics independently of rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 INDENTATION STACK MODEL
 * ---------------------------------------------------------------------
 *
 * Renderers commonly maintain an internal indentation stack.
 *
 * Upon encountering `IndentEnd`, renderers typically:
 *
 * - decrease indentation depth
 * - restore parent indentation
 * - finalize nested layout state
 *
 * ---------------------------------------------------------------------
 * 🔷 BALANCING RULE
 * ---------------------------------------------------------------------
 *
 * Every `IndentStart` should eventually be matched by a corresponding
 * `IndentEnd`.
 *
 * Balanced indentation scopes are important for:
 *
 * - deterministic rendering
 * - multiline formatting correctness
 * - nested structure rendering
 *
 * ---------------------------------------------------------------------
 * 🔷 RENDERING RESPONSIBILITY
 * ---------------------------------------------------------------------
 *
 * `IndentEnd` itself produces no visible output.
 *
 * Renderers are responsible for:
 *
 * - updating indentation depth
 * - applying indentation strings to future lines
 * - coordinating indentation with wrapping logic
 *
 * ---------------------------------------------------------------------
 * 🔷 WIDTH & LAYOUT SEMANTICS
 * ---------------------------------------------------------------------
 *
 * `IndentEnd` contributes:
 *
 * - zero printable width
 * - zero visible characters
 *
 * It is purely structural.
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export class IndentEnd extends BaseToken<'indent-end'> {
    /**
     * Creates a new indentation scope termination token.
     *
     * @since 1.0.0
     */
    constructor() {
        super('indent-end');
    }
}