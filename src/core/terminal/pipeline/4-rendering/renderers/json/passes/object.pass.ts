import ObjectCache from "../assets/object.cache";
import keys from "../helpers/keys";

import type JSONHelpers from "../helpers/helpers";
import type ZexiRenderingContext from "../../../shared/context/context";
import type { PropertyToken } from "../../../../3-tokenization/tokens/tokenization/property.token";

/**
 * Object Rendering Pass
 * ---------------------
 *
 * A structural analysis pass responsible for determining how a JavaScript
 * object literal should be rendered in the JSON pipeline.
 *
 * This pass does NOT emit the final object structure directly.
 * Instead, it performs:
 *
 * - Token stream inspection
 * - Property visibility analysis
 * - Ignored-property tracking
 * - Structural collapse decisions (object → `{}`)
 * - Trailing separator optimization
 *
 * ---------------------------------------------------------------------
 * 🔷 DESIGN ROLE
 * ---------------------------------------------------------------------
 *
 * This pass acts as a **pre-render analysis stage** for object literals.
 *
 * It determines:
 *
 * - Which properties are renderable
 * - Which properties must be ignored
 * - Whether the entire object collapses into an empty object
 * - Whether trailing separators should be suppressed
 *
 * It is intentionally separated from rendering logic to ensure:
 *
 * - deterministic structural evaluation
 * - no side-effect rendering during analysis
 * - clean separation between analysis and emission phases
 *
 * ---------------------------------------------------------------------
 * 🔷 VISIBILITY RULES
 * ---------------------------------------------------------------------
 *
 * A property is considered non-renderable if its value token:
 *
 * - is not visible according to `helpers.isVisibleToken`
 * - represents:
 *     - `symbol`
 *     - `undefined`
 *     - other non-serializable primitives
 *
 * Only properties with visible values participate in rendering.
 *
 * ---------------------------------------------------------------------
 * 🔷 INTERNAL STATE MODEL
 * ---------------------------------------------------------------------
 *
 * - `props`
 *   Set of all detected property tokens in the object scope
 *
 * - `ignoredProps`
 *   Subset of properties whose values are not renderable
 *
 * - `scopes.opened / closed`
 *   Tracks nested object boundaries to ensure correct scope resolution
 *
 * - `index`
 *   Linear cursor into token stream
 *
 * - `item`
 *   Current token under inspection
 *
 * ---------------------------------------------------------------------
 * 🔷 OBJECT SCANNING STRATEGY
 * ---------------------------------------------------------------------
 *
 * The pass performs a single forward scan over the token stream:
 *
 * 1. Tracks object scope depth using:
 *    - `object-open`
 *    - `object-close`
 *
 * 2. Identifies property tokens:
 *    - must be `kind === 'property'`
 *    - must be `type === 'property'`
 *
 * 3. For each property:
 *    - retrieves associated value token (`index + 3`)
 *    - evaluates visibility via helper
 *    - classifies property as:
 *        - renderable
 *        - ignored
 *
 * 4. Collects all properties for later structural evaluation
 *
 * ---------------------------------------------------------------------
 * 🔷 COLLAPSE RULE (EMPTY OBJECT OPTIMIZATION)
 * ---------------------------------------------------------------------
 *
 * If either condition is true:
 *
 * - no properties were found
 * - all properties are ignored
 *
 * Then:
 *
 * - the object is collapsed into `{}` directly
 * - rendering of the current group is aborted
 *
 * This prevents unnecessary structural emission and reduces output noise.
 *
 * ---------------------------------------------------------------------
 * 🔷 TRAILING SEPARATOR OPTIMIZATION
 * ---------------------------------------------------------------------
 *
 * If the last property in the object is ignored, the pass performs:
 *
 * - identification of last visible property
 * - registration of suppression rule in ObjectCache
 *
 * This ensures:
 *
 * - no trailing commas after removed properties
 * - syntactically clean JSON output
 *
 * ---------------------------------------------------------------------
 * 🔷 CACHE INTEGRATION
 * ---------------------------------------------------------------------
 *
 * The pass stores an ObjectCache instance in rendering context:
 *
 *   ctx.data.set(keys.OBJECT_CACHE_KEY, cache)
 *
 * This cache is responsible for:
 *
 * - tracking ignored properties
 * - suppressing trailing separators
 * - coordinating later rendering phases
 *
 * ---------------------------------------------------------------------
 * 🔷 CONTEXT INTERACTIONS
 * ---------------------------------------------------------------------
 *
 * This pass interacts with:
 *
 * - `ctx.tokens`
 *   → for token traversal via peek
 *
 * - `ctx.writer`
 *   → for direct early emission of `{}` collapse
 *
 * - `ctx.data`
 *   → for storing object cache for later rendering phases
 *
 * - `helpers`
 *   → for visibility checks and group-level abortion control
 *
 * ---------------------------------------------------------------------
 * 🔷 SIDE EFFECTS
 * ---------------------------------------------------------------------
 *
 * - Mutates rendering context data (`OBJECT_CACHE_KEY`)
 * - May abort current rendering group via helper
 * - May directly write `{}` to output buffer
 * - May register suppression metadata for later formatting phases
 *
 * ---------------------------------------------------------------------
 * @param ctx
 * Rendering context providing:
 *
 * - token stream access
 * - scope tracking
 * - writer output buffer
 * - shared renderer state
 *
 * @param helpers
 * JSONHelpers instance providing:
 *
 * - visibility rules
 * - group abortion controls
 * - layout coordination utilities
 *
 * ---------------------------------------------------------------------
 * @throws Error
 * This pass does not explicitly throw in normal operation,
 * but may indirectly propagate invariant errors from:
 *
 * - token stream inconsistencies
 * - context corruption
 * - helper-level abort logic
 *
 * ---------------------------------------------------------------------
 * @since 1.0.0
 */
export default function objectPass(
    ctx: ZexiRenderingContext,
    helpers: JSONHelpers
) {
    const ignoredProps = new Set<PropertyToken>();
    const cache = new ObjectCache(ignoredProps);

    // Store the cache in the context
    ctx.data.set(keys.OBJECT_CACHE_KEY, cache);

    let index = 0;
    let item = ctx.tokens.peek(++index);
    const scopes = { opened: 0, closed: 0 }

    const props = new Set<PropertyToken>();

    do {
        try {
            if (!item) { break; }
            if (item.kind === 'object-close') {
                scopes.closed++;
                if (scopes.opened === scopes.closed) {
                    break;
                }

                continue;
            }

            if (item.kind === 'object-open') {
                scopes.opened++;
                continue;
            }

            // Checking if we're in the correct scope
            if (scopes.closed + 1 !== scopes.opened) { continue; }

            if (
                item.kind === 'property' && // The token kind is a property
                item.type === 'property'    // The property type is a property, not a method, getter, etc.
            ) {
                props.add(item);

                const valueToken = ctx.tokens.peek(index + 3);

                const isVisible = valueToken && helpers.isVisibleToken(valueToken);
                if (!isVisible) {
                    ignoredProps.add(item);
                }
            }
        } finally {
            index++;
            item = ctx.tokens.peek(index);
        }
    } while (item);

    if (
        props.size === 0 ||
        props.size === ignoredProps.size
    ) {
        helpers.ignoreCurrentGroup();
        ctx.writer.write('{}');
        return;
    }

    // Detect if the last property is ignored
    const allProps = Array.from(props);
    const ignored = Array.from(ignoredProps);

    const lastProp = allProps[allProps.length - 1];
    const lastIgnoredProp = ignored[ignored.length - 1];

    if (lastProp === lastIgnoredProp) {
        // Mark the last visible property to ignore its separator
        const visibleProps = allProps.filter(prop => !ignored.includes(prop));
        const lastVisibleProp = visibleProps[visibleProps.length - 1];
        cache.suppressTrailingOf(lastVisibleProp);
    }
}