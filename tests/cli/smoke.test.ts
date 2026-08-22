import zexi from '../../src';

describe('Zexi CLI Smoke Tests', () => {
    let logSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function setArgv(input: string) {
        process.argv = ['node', 'test', ...input.split(' ').filter(Boolean)];
    }

    function createTestApp() {
        const pkgApp = zexi.cli.createApp('packages-manager').command(
            zexi.cli.createCommand('install', 'dynamic')
                .aliases(['i', 'ins'])
                .option([
                    {
                        name: 'source',
                        abbrev: 's',
                        dataType: 'string',
                        defaultValue: 'npm'
                    },
                    {
                        name: 'save-dev',
                        abbrev: 'd',
                        dataType: 'boolean',
                        defaultValue: false
                    }
                ])
                .action(ctx => {
                    const source = ctx.options.get('source');
                    const saveDev = ctx.options.get('save-dev');

                    const pkgs = ctx.args.all;

                    if (pkgs.length > 0) {
                        console.log(`Packages: ${pkgs.join(', ')}`);
                    } else {
                        console.log(`No packages`);
                    }

                    return { installed: pkgs, source, saveDev };
                })
        ).onRun(() => {
            console.log('pkgApp onRun');
        });

        const app = zexi.cli.createApp('my-cli').onRun(() => {
            console.log('root onRun');
        });

        app.option({
            name: 'fail',
            dataType: 'boolean',
            defaultValue: false
        });

        app.command(
            zexi.cli.createCommand('version')
                .aliases('v')
                .option({
                    name: 'output',
                    abbrev: 'o',
                    dataType: 'string',
                    defaultValue: 'text'
                })
                .onSeen(() => {
                    console.log('onSeen: version');
                })
                .action(ctx => {
                    const out = ctx.options.get('output');

                    if (out === 'json') {
                        console.log('json-output');
                        return { version: '1.0.0' };
                    }

                    if (out === 'text') {
                        console.log('text-output');
                        return '1.0.0';
                    }

                    throw new Error(`Unknown output type: ${out}`);
                })
        );

        // Delegator (NO action)
        app.command(
            zexi.cli.createCommand('pkgs', 'dynamic', pkgApp)
        );

        // Root action
        app.action(() => {
            console.log('root action');
            return 'root-result';
        });

        // Middleware
        app.use((ctx, terminate) => {
            console.log('middleware hit');

            if (ctx.options.has('fail') && ctx.options.get('fail') === true) {
                return terminate({
                    ok: false,
                    reason: 'user_error',
                    message: 'Forced failure'
                });
            }
        });

        return app;
    }

    test('seen handlers run in correct order', async () => {
        const calls: string[] = [];

        const app = zexi.cli.createApp('app');

        app.command(
            zexi.cli.createCommand('a')
                .onSeen(() => calls.push('a'))
                .command(
                    zexi.cli.createCommand('b')
                        .onSeen(() => calls.push('b'))
                        .action(() => { })
                )
        );

        setArgv('a b');
        await app.run();

        expect(calls).toEqual(['a', 'b']);
    });

    // ---------------------------
    // ROOT
    // ---------------------------

    test('runs root action', async () => {
        const app = createTestApp();

        setArgv('');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('root onRun');
        expect(logSpy).toHaveBeenCalledWith('middleware hit');
        expect(logSpy).toHaveBeenCalledWith('root action');
        expect(res).toBe('root-result');
    });

    // ---------------------------
    // VERSION COMMAND
    // ---------------------------

    test('runs version command (default)', async () => {
        const app = createTestApp();

        setArgv('version');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('onSeen: version');
        expect(logSpy).toHaveBeenCalledWith('text-output');
        expect(res).toBe('1.0.0');
    });

    test('runs version with long option', async () => {
        const app = createTestApp();

        setArgv('version --output=json');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('json-output');
        expect(res).toEqual({ version: '1.0.0' });
    });

    test('runs version with short option', async () => {
        const app = createTestApp();

        setArgv('version -o json');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('json-output');
        expect(res).toEqual({ version: '1.0.0' });
    });

    test('runs version via alias', async () => {
        const app = createTestApp();

        setArgv('v');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('text-output');
        expect(res).toBe('1.0.0');
    });

    // ---------------------------
    // DELEGATION
    // ---------------------------

    test('delegates to pkg app', async () => {
        const app = createTestApp();

        setArgv('pkgs install react');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('pkgApp onRun');
        expect(logSpy).toHaveBeenCalledWith('Installing packages from npm');
        expect(logSpy).toHaveBeenCalledWith('Save dev: false');
        expect(logSpy).toHaveBeenCalledWith('Packages: react');

        expect(res).toEqual({
            installed: ['react'],
            source: 'npm',
            saveDev: false
        });
    });

    test('delegation with options', async () => {
        const app = createTestApp();

        setArgv('pkgs install react -d --source=github');
        const res = await app.run();

        expect(logSpy).toHaveBeenCalledWith('Installing packages from github');
        expect(logSpy).toHaveBeenCalledWith('Save dev: true');

        expect(res).toEqual({
            installed: ['react'],
            source: 'github',
            saveDev: true
        });
    });

    test('multiple packages', async () => {
        const app = createTestApp();

        setArgv('pkgs install react vue svelte');
        const res = await app.run() as { installed: string[]; };

        expect(logSpy).toHaveBeenCalledWith('Packages: react, vue, svelte');
        expect(res.installed).toEqual(['react', 'vue', 'svelte']);
    });

    test('no packages', async () => {
        const app = createTestApp();

        setArgv('pkgs install');
        const res = await app.run() as { installed: string[]; };

        expect(logSpy).toHaveBeenCalledWith('No packages');
        expect(res.installed).toEqual([]);
    });

    test('delegation preserves remaining args correctly', async () => {
        const app = createTestApp();

        setArgv('pkgs install react vue -- --flag');

        const res = await app.run() as { installed: string[] };

        expect(res.installed).toEqual(['react', 'vue', '--flag']);
    });

    test('delegated command return propagates to root', async () => {
        const app = createTestApp();

        setArgv('pkgs install react');

        const res = await app.run() as { installed: string[] };

        expect(res.installed).toEqual(['react']);
    });

    // ---------------------------
    // TERMINATION
    // ---------------------------

    test('middleware user_error terminates execution', async () => {
        const app = createTestApp();

        setArgv('--fail');
        const res = await app.run();

        expect(errorSpy).toHaveBeenCalledWith('Forced failure');
        expect(logSpy).not.toHaveBeenCalledWith('root action');
        expect(res).toBeUndefined();
    });

    test('middleware success termination stops execution', async () => {
        const app = zexi.cli.createApp('test').use((ctx, terminate) => {
            terminate({ ok: true, message: 'Stopped early' });
        }).action(() => {
            console.log('should not run');
        });

        setArgv('');
        const res = await app.run();

        expect(logSpy).not.toHaveBeenCalledWith('should not run');
        expect(res).toBeUndefined();
    });

    // ---------------------------
    // OPTIONS / PARSING
    // ---------------------------

    test('flag without value works', async () => {
        const app = createTestApp();

        setArgv('pkgs install react -d');
        const res = await app.run() as { saveDev: boolean; };

        expect(logSpy).toHaveBeenCalledWith('Save dev: true');
        expect(res.saveDev).toBe(true);
    });

    test('-- stops option parsing', async () => {
        const app = createTestApp();

        setArgv('pkgs install -- --not-an-option file.txt');
        const res = await app.run() as { installed: string[]; };

        expect(res.installed).toContain('--not-an-option');
        expect(res.installed).toContain('file.txt');
    });

    test('unknown options trigger warning', async () => {
        const app = createTestApp();

        setArgv('version --unknown=123');
        await app.run();

        expect(warnSpy).toHaveBeenCalled();
    });

    test('invalid boolean value throws', async () => {
        const app = createTestApp();

        setArgv('version --output=maybe');

        await expect(app.run()).rejects.toThrow();
    });

    test('invalid number option throws', async () => {
        const app = zexi.cli.createApp('test')
            .command(
                zexi.cli.createCommand('run')
                    .option({
                        name: 'port',
                        dataType: 'number',
                        required: true
                    })
                    .action(() => { })
            );

        setArgv('run --port=abc');

        await expect(app.run()).rejects.toThrow('Invalid number value');
    });

    test('missing required option throws', async () => {
        const app = zexi.cli.createApp('test')
            .command(
                zexi.cli.createCommand('deploy')
                    .option({
                        name: 'env',
                        dataType: 'string',
                        required: true
                    })
                    .action(() => { })
            );

        setArgv('deploy');

        await expect(app.run()).rejects.toThrow('Option "env" is required');
    });

    test('last option wins', async () => {
        const app = createTestApp();

        setArgv('version --output=text --output=json');

        const res = await app.run() as { version: string };

        expect(res.version).toBe('1.0.0');
    });

    test('explicit overrides abbrev even if abbrev is later', async () => {
        const app = createTestApp();

        setArgv('version --output=json -o text');

        const res = await app.run() as { version: string };

        expect(res.version).toBe('1.0.0'); // json wins
    });

    test('last explicit option wins among explicit options', async () => {
        const app = createTestApp();

        setArgv('version --output=text --output=json');

        const res = await app.run() as { version: string };

        expect(res.version).toBe('1.0.0');
    });

    test('last abbrev option wins among abbrevs', async () => {
        const app = createTestApp();

        setArgv('version -o text -o json');

        const res = await app.run() as { version: string };

        expect(res.version).toBe('1.0.0');
    });

    test('explicit still wins even if multiple abbrevs appear after it', async () => {
        const app = createTestApp();

        setArgv('version --output=json -o text -o xml');

        const res = await app.run() as { version: string };

        expect(res.version).toBe('1.0.0'); // json must still win
    });

    // ---------------------------
    // ERROR PROPAGATION
    // ---------------------------

    test('system error in middleware throws', async () => {
        const app = zexi.cli.createApp('err')
            .use((ctx, terminate) => {
                terminate({
                    ok: false,
                    reason: 'error',
                    error: new Error('boom')
                });
            });

        setArgv('');
        await expect(app.run()).rejects.toThrow('boom');
    });
});