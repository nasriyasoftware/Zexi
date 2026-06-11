import BaseToken from "../../assets/__base.token__";

export class ReferenceEndToken extends BaseToken<'reference-end'> {

    constructor() {
        super('reference-end');
    }

    static create() {
        return new ReferenceEndToken();
    }
}