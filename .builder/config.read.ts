import type { TSConfigs } from './types';
import path from 'path';

const configsModule = await import('./configs');

const configsDraft: Required<TSConfigs> = {
    root: process.cwd(),
    target: 'ES2024',
    outDir: 'dist',
    sourceDir: 'src',
    testsDir: 'tests',
    compileTo: 'ESM',
    testingFramework: 'jest'
}

if (configsModule) {
    const configsFile = configsModule.configs;

    if ('target' in configsFile) {
        const target = configsFile.target as string;

        switch (target.toLowerCase()) {
            case 'es2024':
                configsDraft.target = 'ES2024';
                break;

            case 'es2025':
                configsDraft.target = 'ES2025';
                break;

            case 'esnext':
                configsDraft.target = 'ESNext';
                break;

            default:
                throw new Error(`Unknown or unsupported target: ${target}`);
        }
    }

    if ('outDir' in configsFile) {
        const outDir = configsFile.outDir as string;
        if (outDir.length === 0) {
            throw new Error('outDir cannot be empty');
        }

        configsDraft.outDir = outDir;
    }

    if ('sourceDir' in configsFile) {
        const sourceDir = configsFile.sourceDir as string;
        if (sourceDir.length === 0) {
            throw new Error('sourceDir cannot be empty');
        }

        const resolved = path.resolve(configsDraft.root, sourceDir);

        if (!resolved.toLowerCase().startsWith(configsDraft.root.toLowerCase())) {
            throw new Error('sourceDir cannot be outside of the current working directory');
        }

        configsDraft.sourceDir = sourceDir;
    }

    if ('testsDir' in configsFile) {
        const testsDir = configsFile.testsDir as string;
        if (testsDir.length === 0) {
            throw new Error('testsDir cannot be empty');
        }

        const resolved = path.resolve(configsDraft.root, testsDir);

        if (!resolved.toLowerCase().startsWith(configsDraft.root.toLowerCase())) {
            throw new Error('testsDir cannot be outside of the current working directory');
        }

        configsDraft.testsDir = testsDir;
    }

    if ('compileTo' in configsFile) {
        const compileTo = configsFile.compileTo as string;

        switch (compileTo.toLowerCase()) {
            case 'esm':
                configsDraft.compileTo = 'ESM';
                break;

            case 'cjs':
                configsDraft.compileTo = 'CJS';
                break;

            case 'both':
                configsDraft.compileTo = 'Both';
                break;

            default:
                throw new Error(`Unknown or unsupported compileTo: ${compileTo}`);
        }
    }

    if ('testingFramework' in configsFile) {
        const testingFramework = configsFile.testingFramework as string;

        switch (testingFramework.toLowerCase()) {
            case 'jest':
                configsDraft.testingFramework = 'jest';
                break;

            case 'vitest':
                configsDraft.testingFramework = 'vitest';
                break;

            case 'mocha':
                configsDraft.testingFramework = 'mocha';
                break;

            case 'none':
                configsDraft.testingFramework = 'none';
                break;

            default:
                throw new Error(`Unknown or unsupported testingFramework: ${testingFramework}`);
        }
    }
}

const buildConfigs = Object.freeze(configsDraft);
export default buildConfigs;