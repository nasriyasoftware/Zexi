import zexi from "../../src";
import { ZexiCommandSymbol } from "../../src/core/cli/kernal/assets/keys";

describe('App', () => {
    it('Creates apps correctly', () => {
        const main = zexi.cli.createApp('CLI-Tool', 'A command line tool');

        expect(main.name).toBe('cli-tool');
        expect(main._internal.accessCMD(ZexiCommandSymbol)!.description).toBe('A command line tool');
    });

    it('Creates commands correctly', () => {
        expect(zexi.cli.createCommand('test')._internal.accessCMD(ZexiCommandSymbol)!.mode).toBe('static');
        expect(zexi.cli.createCommand('test', 'static')._internal.accessCMD(ZexiCommandSymbol)!.mode).toBe('static');
        expect(zexi.cli.createCommand('test', 'dynamic')._internal.accessCMD(ZexiCommandSymbol)!.mode).toBe('dynamic');

        {
            // Delegation
            const tmpApp = zexi.cli.createApp('tempApp');
            const command = zexi.cli.createCommand('test', 'dynamic', tmpApp);
            const cmd = command._internal.accessCMD(ZexiCommandSymbol)!;

            expect(cmd.mode).toBe('dynamic');
            expect(cmd.delegation.assigned).toBe(true);
            expect(cmd.delegation.target).toBe(tmpApp);
        }
    })
})