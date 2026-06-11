import ArrayGraphNode from "./array.node"
import DateGraphNode from "./date.node"
import ErrorGraphNode from "./error.node"
import FunctionGraphNode from "./function.node"
import MapGraphNode from "./map.node"
import ObjectGraphNode from "./object.node"
import PrimitiveGraphNode from "./primitive.node"
import RegExpGraphNode from "./regex.node"
import SetGraphNode from "./set.node"
import UnknownGraphNode from "./unknown.node"

const GRAPH_NODES = {
    Array: ArrayGraphNode,
    Date: DateGraphNode,
    Error: ErrorGraphNode,
    Function: FunctionGraphNode,
    Map: MapGraphNode,
    Object: ObjectGraphNode,
    Primitive: PrimitiveGraphNode,
    RegExp: RegExpGraphNode,
    Set: SetGraphNode,
    Unknown: UnknownGraphNode
}

export default GRAPH_NODES;