export type TSConfigs = {
    /**
     * Specifies the root directory of the project.
     */
    root?: string;

    /**
     * Specifies the JavaScript language target.
     *
     * @default 'ES2024'
     */
    target?: 'ES2024' | 'ES2025' | 'ESNext';

    /**
     * Specifies the directory where build output is written.
     *
     * @default 'dist'
     */
    outDir?: string;

    /**
     * Specifies the directory containing the source files.
     *
     * @default 'src'
     */
    sourceDir?: string;

    /**
     * Specifies the directory containing the test files.
     *
     * @default 'tests'
     */
    testsDir?: string;

    /**
     * Specifies which module formats should be generated.
     *
     * @default 'ESM'
     */
    compileTo?: 'ESM' | 'CJS' | 'Both';

    /**
     * Specifies the testing framework used by the project.
     *
     * @default 'jest'
     */
    testingFramework?: 'jest' | 'vitest' | 'mocha' | 'none';
};