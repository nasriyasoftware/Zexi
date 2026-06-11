import type { CLIOptionToken } from "../types";

const isOptionToken = (t: string) => t.startsWith('--') || /^-[a-zA-Z]/.test(t);

export function parseTokens(tokens: string[]): { words: string[]; argsAfterBreak: string[]; options: CLIOptionToken[]; } {
    const words: string[] = [];
    const options: CLIOptionToken[] = [];
    const argsAfterBreak: string[] = [];

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];

        // Stop parsing options
        if (token === '--') {
            argsAfterBreak.push(...tokens.slice(i + 1));
            break;
        }

        // Long options
        if (token.startsWith('--')) {
            const [rawName, inlineValue] = token.slice(2).split('=');

            if (inlineValue !== undefined) {
                options.push({ name: rawName, value: inlineValue, raw: token });
                i++;
                continue;
            }

            const next = tokens[i + 1];

            if (next && !isOptionToken(next)) {
                options.push({ name: rawName, value: next, raw: token });
                i += 2;
            } else {
                // Explicitly leave the value undefined since it was not provided
                options.push({ name: rawName, raw: token });
                i++;
            }

            continue;
        }

        // Short options
        if (/^-[a-zA-Z]/.test(token)) {
            // -abc case
            const chars = token.slice(1).split('');
            let consumedNextAsValue = false;

            for (let j = 0; j < chars.length; j++) {
                const name = chars[j];
                const isLast = j === chars.length - 1;

                if (isLast) {
                    const next = tokens[i + 1];

                    if (next && !isOptionToken(next)) {
                        options.push({ name, value: next, raw: token, });
                        consumedNextAsValue = true;
                        break;
                    }
                }

                options.push({ name, value: true, raw: token, });
            }

            i += consumedNextAsValue ? 2 : 1;
            continue;
        }

        // regular word
        words.push(token);
        i++;
    }

    return { words, options, argsAfterBreak };
}