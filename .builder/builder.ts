import buildConfigs from "./config.read";
import os from "os";
import fs from "fs";
import path from "path";

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const temp = path.join(os.tmpdir(), 'Nasriya', 'Zexi', 'build');

type BuildFiles = {
    declarations: string;
    esm?: string;
    cjs?: string;
};

class Builder {
    static readonly #_helpers = {
        createBaseCompilerOptions: () => {
            return {
                target: buildConfigs.target.toLowerCase(),
                strict: true,
                noImplicitOverride: true,
                noImplicitReturns: true,
                noFallthroughCasesInSwitch: true,
                useUnknownInCatchVariables: true,
                resolveJsonModule: true,
                isolatedModules: true,
                esModuleInterop: true,
                forceConsistentCasingInFileNames: true,
                skipLibCheck: true,

                types: ['node'],
                typeRoots: [
                    path.resolve(buildConfigs.root, 'node_modules/@types')
                ]
            };
        },

        generateConfigFor: {
            declaration: () => {
                const sourceDir = path.resolve(
                    buildConfigs.root,
                    buildConfigs.sourceDir
                );

                return {
                    compilerOptions: {
                        ...this.#_helpers.createBaseCompilerOptions(),
                        module: 'ESNext',
                        moduleResolution: 'Bundler',
                        rootDir: sourceDir,
                        declaration: true,
                        emitDeclarationOnly: true,
                        declarationDir: path.resolve(buildConfigs.root, buildConfigs.outDir, '@types')
                    },
                    include: [sourceDir],
                    exclude: [
                        path.resolve(buildConfigs.root, 'node_modules'),
                        path.resolve(buildConfigs.root, buildConfigs.outDir)
                    ]
                };
            },

            esm: () => {
                const sourceDir = path.resolve(
                    buildConfigs.root,
                    buildConfigs.sourceDir
                );

                return {
                    compilerOptions: {
                        ...this.#_helpers.createBaseCompilerOptions(),
                        module: 'ES2022',
                        moduleResolution: 'Bundler',
                        rootDir: sourceDir,
                        outDir: path.join(buildConfigs.root, buildConfigs.outDir, 'esm'),
                        declaration: false,
                    },
                    include: [sourceDir],
                    exclude: [
                        path.resolve(buildConfigs.root, 'node_modules'),
                        path.resolve(buildConfigs.root, buildConfigs.outDir)
                    ]
                };
            },

            cjs: () => {
                const sourceDir = path.resolve(
                    buildConfigs.root,
                    buildConfigs.sourceDir
                );

                return {
                    compilerOptions: {
                        ...this.#_helpers.createBaseCompilerOptions(),
                        module: 'CommonJS',
                        moduleResolution: 'Bundler',
                        rootDir: sourceDir,
                        outDir: path.join(buildConfigs.root, buildConfigs.outDir, 'cjs'),
                        declaration: false
                    },
                    include: [sourceDir],
                    exclude: [
                        path.resolve(buildConfigs.root, 'node_modules'),
                        path.resolve(buildConfigs.root, buildConfigs.outDir)
                    ]
                };
            }
        },

        generateFiles: async (tempPath: string) => {
            await fs.promises.mkdir(tempPath, { recursive: true });

            const promises: Promise<void>[] = [];

            const files: BuildFiles = {
                declarations: path.join(tempPath, 'tsconfig.declarations.json'),
            }

            promises.push(
                fs.promises.writeFile(
                    files.declarations,
                    JSON.stringify(this.#_helpers.generateConfigFor.declaration(), null, 4),
                    'utf8'
                )
            )

            if (buildConfigs.compileTo === 'ESM' || buildConfigs.compileTo === 'Both') {
                files.esm = path.join(tempPath, 'tsconfig.esm.json');

                promises.push(
                    fs.promises.writeFile(
                        files.esm,
                        JSON.stringify(this.#_helpers.generateConfigFor.esm(), null, 4),
                        'utf8'
                    )
                );
            }

            if (buildConfigs.compileTo === 'CJS' || buildConfigs.compileTo === 'Both') {
                files.cjs = path.join(tempPath, 'tsconfig.cjs.json');

                promises.push(
                    fs.promises.writeFile(
                        files.cjs,
                        JSON.stringify(this.#_helpers.generateConfigFor.cjs(), null, 4),
                        'utf8'
                    )
                );
            }

            await Promise.all(promises);
            return files;
        },

        lock: async () => {
            const lock = {
                filePath: path.join(buildConfigs.root, '.build.lock'),
                acquired: false
            };

            try {
                await fs.promises.writeFile(lock.filePath, '', { flag: 'wx' });
                lock.acquired = true;
            } catch (error) {
                if (
                    error &&
                    typeof error === 'object' &&
                    'code' in error &&
                    error.code === 'EEXIST'
                ) {
                    return lock;
                }

                throw error;
            }

            return lock;
        },

        compileFile: async (configFile: string) => {
            await execFileAsync(
                process.platform === 'win32'
                    ? 'tsc.cmd'
                    : 'tsc',
                ['--project', configFile],
                {
                    cwd: buildConfigs.root
                }
            );
        },

        compileFiles: async (files: BuildFiles) => {
            const builds: Promise<void>[] = [
                this.#_helpers.compileFile(files.declarations)
            ];

            if (files.esm) {
                builds.push(
                    this.#_helpers.compileFile(files.esm)
                );
            }

            if (files.cjs) {
                builds.push(
                    this.#_helpers.compileFile(files.cjs)
                );
            }

            await Promise.all(builds);
        },

        prepareCJS: async () => {
            const cjsDir = path.resolve(
                buildConfigs.root,
                buildConfigs.outDir,
                'cjs'
            );

            await fs.promises.mkdir(cjsDir, {
                recursive: true
            });

            await fs.promises.writeFile(
                path.join(cjsDir, 'package.json'),
                JSON.stringify({ type: 'commonjs' }, null, 4),
                'utf8'
            );
        },

        cleanOutput: async () => {
            await fs.promises.rm(
                path.resolve(
                    buildConfigs.root,
                    buildConfigs.outDir
                ),
                {
                    recursive: true,
                    force: true
                }
            );
        },

        resolveESMImport: (filePath: string, importPath: string): string => {
            if (
                !importPath.startsWith('./') &&
                !importPath.startsWith('../')
            ) {
                return importPath;
            }

            if (importPath.endsWith('.js')) {
                return importPath;
            }

            const importerDir = path.dirname(filePath);
            const target = path.resolve(importerDir, importPath);

            // `./foo` -> `./foo.js`
            if (fs.existsSync(`${target}.js`)) {
                return `${importPath}.js`;
            }

            // `./foo` -> `./foo/index.js`
            if (
                fs.existsSync(target) &&
                fs.statSync(target).isDirectory() &&
                fs.existsSync(path.join(target, 'index.js'))
            ) {
                return `${importPath}/index.js`;
            }

            return importPath;
        },

        addExtensions: async (dir: string) => {
            const content = await fs.promises.readdir(dir, { withFileTypes: true });

            const directories = content.filter(i => i.isDirectory());
            const files = content.filter(i => i.isFile() && i.name.toLowerCase().endsWith('.js'));

            const filesToProcess = files.map(async (file) => {
                const fullPath = path.join(dir, file.name);

                const original = await fs.promises.readFile(fullPath, 'utf8');
                let content = original.replace(
                    /((?:import|export)[^'"]*?\sfrom\s*|import\s*)['"](\.{1,2}\/[^'"]+)['"]/g,
                    (match, prefix, importPath) => {
                        const resolved = this.#_helpers.resolveESMImport(
                            fullPath,
                            importPath
                        );

                        const quote = match.includes('"') ? '"' : "'";

                        return `${prefix}${quote}${resolved}${quote}`;
                    }
                );

                if (content !== original) {
                    await fs.promises.writeFile(fullPath, content, 'utf8');
                }
            });

            const directoriesToProcess = directories.map((dir) => {
                return this.#_helpers.addExtensions(path.join(dir.parentPath, dir.name));
            });

            await Promise.all([...filesToProcess, ...directoriesToProcess]);
        },

        finalize: {
            esm: () => {
                return this.#_helpers.addExtensions(
                    path.resolve(
                        buildConfigs.root,
                        buildConfigs.outDir,
                        'esm'
                    )
                );
            }
        }
    }

    static async build() {
        await fs.promises.mkdir(temp, { recursive: true });

        // Create a process lockfile
        const lock = await this.#_helpers.lock();
        if (!lock.acquired) {
            throw new Error(
                'Build already in progress. Please try again later.'
            );
        }

        const tempPath = await fs.promises.mkdtemp(path.join(temp, 'build-'));
        let success = false;

        try {
            await this.#_helpers.cleanOutput();
            const files = await this.#_helpers.generateFiles(tempPath);

            if (files.cjs) {
                await this.#_helpers.prepareCJS();
            }

            await this.#_helpers.compileFiles(files);

            if (files.esm) {
                await this.#_helpers.finalize.esm();
            }
            success = true;
        } finally {
            await Promise.all([
                fs.promises.rm(lock.filePath, { force: true }),
                fs.promises.rm(tempPath, { recursive: true, force: true }),
                success ? Promise.resolve() : fs.promises.rm(
                    path.resolve(buildConfigs.root, buildConfigs.outDir),
                    { recursive: true, force: true }
                )
            ]);
        }
    }
}

await Builder.build();