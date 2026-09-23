import "./zexi.setup";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    mock,
    test,
    spyOn
} from "bun:test";

Object.assign(globalThis, {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    spyOn,
    describe,
    expect,
    it,
    mock,
    test
});