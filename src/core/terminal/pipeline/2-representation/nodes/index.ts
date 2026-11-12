import ArrayRepresentationNode from "./array.node";
import DateRepresentationNode from "./date.node";
import ErrorRepresentationNode from "./error.node";
import FunctionRepresentationNode from "./function.node";
import MapRepresentationNode from "./map.node";
import ObjectRepresentationNode from "./object.node";
import PrimitiveRepresentationNode from "./primitive.node";
import RegExpRepresentationNode from "./regex.node";
import SetRepresentationNode from "./set.node";

/**
 * Registry of representation-node constructors keyed by graph-node kind.
 *
 * The representation builder uses this map to convert supported graph nodes
 * into their corresponding output representation nodes.
 *
 * @since 1.0.0
 */
const REP_NODES = {
    Array: ArrayRepresentationNode,
    Date: DateRepresentationNode,
    Error: ErrorRepresentationNode,
    Function: FunctionRepresentationNode,
    Map: MapRepresentationNode,
    Object: ObjectRepresentationNode,
    Primitive: PrimitiveRepresentationNode,
    RegExp: RegExpRepresentationNode,
    Set: SetRepresentationNode
};

export default REP_NODES;