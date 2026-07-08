import contracts from "./contracts";
import ContractTester from "./contract.tester";
import TOKENS from "../../../../../../src/core/terminal/pipeline/3-tokenization/tokens";

describe("LayoutResolver", () => {

    /**
     * ---------------------------------------------------------------------
     * INLINE BEHAVIOR
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("inline behavior (%s)", (_name, contract) => {

        test("primitive object stays inline", () => {
            const tokens = contract.tokenize({ a: 1 });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });

        test("flat array stays inline", () => {
            const tokens = contract.tokenize([1, 2, 3]);
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });
    });

    /**
     * ---------------------------------------------------------------------
     * BLOCK CONDITIONS (STRUCTURAL)
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("block conditions (%s)", (_name, contract) => {

        test("nested object forces block", () => {
            const tokens = contract.tokenize({ a: { b: 1 } });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        test("Map forces block", () => {
            const tokens = contract.tokenize(new Map());
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        test("Set forces block", () => {
            const tokens = contract.tokenize(new Set([1, 2, 3]));
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        test("Error forces block", () => {
            const tokens = contract.tokenize(new Error("custom message"));
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });
    });

    /**
     * ---------------------------------------------------------------------
     * OBJECT RULES
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("object rules (%s)", (_name, contract) => {

        test("array property forces block", () => {
            const tokens = contract.tokenize({ a: [1] });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        test("function property forces block", () => {
            const tokens = contract.tokenize({ fn: () => { } });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        test("method syntax stays inline", () => {
            const tokens = contract.tokenize({
                fn() { }
            });

            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });
    });

    /**
     * ---------------------------------------------------------------------
     * ARRAY RULES (BOUNDARIES + RENDERER FILTERING)
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("array rules (%s)", (_name, contract) => {

        test("inline-safe array stays inline", () => {
            const tokens = contract.tokenize([1, 2, 3]);
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });

        test("nested array forces block", () => {
            const tokens = contract.tokenize([1, [2, 3]]);
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });

        /**
         * -----------------------------------------------------------------
         * BOUNDARY: raw size limit
         * -----------------------------------------------------------------
         */
        test("array with 5 elements stays inline (boundary)", () => {
            const tokens = contract.tokenize([1, 2, 3, 4, 5]);
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });

        test("array with 6 elements forces block (boundary)", () => {
            const input = Array.from({ length: 6 }, (_, i) => i + 1);
            const tokens = contract.tokenize(input);

            const tester = new ContractTester(contract, _name, tokens, 20);
            tester.expectLayout("block");
        });

        /**
         * -----------------------------------------------------------------
         * RENDERER FILTERING (undefined ignored in JSON mode)
         * -----------------------------------------------------------------
         */
        if (_name === 'json') {
            test("array with undefined elements does NOT affect layout density", () => {
                const tokens = contract.tokenize([1, undefined, 2, undefined, 3]);
                const tester = new ContractTester(contract, _name, tokens);

                tester.expectLayout("inline");
            });

            test("undefined elements do not push array over block threshold", () => {
                // raw length = 7
                // effective length (non-undefined) = 4 → should stay inline
                const tokens = contract.tokenize([
                    1,
                    undefined,
                    2,
                    undefined,
                    3,
                    undefined,
                    4
                ]);

                const tester = new ContractTester(contract, _name, tokens, 10);
                tester.expectLayout("inline");
            });

            test("mixed array crosses threshold only when visible elements exceed limit", () => {
                // effective values = 6 (1..6), should force block
                const tokens = contract.tokenize([
                    1,
                    undefined,
                    2,
                    3,
                    undefined,
                    4,
                    5,
                    6
                ]);

                const tester = new ContractTester(contract, _name, tokens, 10);
                tester.expectLayout("block");
            });
        }
    });

    /**
     * ---------------------------------------------------------------------
     * VISIBILITY RULES
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("visibility rules (%s)", (_name, contract) => {

        test("undefined value is ignored", () => {
            const tokens = contract.tokenize({ a: undefined });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });

        test("non-inline-safe value forces block", () => {
            const tokens = contract.tokenize({ a: [1] });
            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });
    });

    /**
     * ---------------------------------------------------------------------
     * NESTING / SCOPES
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("nesting rules (%s)", (_name, contract) => {

        test("deep nesting forces block", () => {
            const tokens = contract.tokenize({
                a: {
                    b: {
                        c: 1
                    }
                }
            });

            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("block");
        });
    });

    /**
     * ---------------------------------------------------------------------
     * EARLY TERMINATION
     * ---------------------------------------------------------------------
     */
    describe.each(contracts)("early termination (%s)", (_name, contract) => {

        test("stops at group-end and ignores trailing tokens", () => {

            const groupStart = (id: string): any => ({ kind: "group-start", id });
            const groupEnd = (id: string): any => ({ kind: "group-end", groupId: id });

            const tokens = [
                groupStart("g1"),
                new TOKENS.Primitive("string", "value"),
                groupEnd("g1"),
                ...contract.tokenize({ a: { b: 999 } }) // must be ignored
            ];

            const tester = new ContractTester(contract, _name, tokens);

            tester.expectLayout("inline");
        });
    });

});