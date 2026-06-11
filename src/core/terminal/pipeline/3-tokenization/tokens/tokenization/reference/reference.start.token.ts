import BaseToken from "../../assets/__base.token__";
import type { RepRefNode } from "../../../../2-representation/types";

export class ReferenceStartToken extends BaseToken<'reference-start'> {
    readonly #_node: RepRefNode;
    readonly #_count: number;

    constructor(node: RepRefNode, count: number) {
        super('reference-start');

        this.#_node = node;
        this.#_count = count;
    }

    get node() { return this.#_node; }
    get count() { return this.#_count; }

    static create(node: RepRefNode, count: number) {
        return new ReferenceStartToken(node, count);
    }
}