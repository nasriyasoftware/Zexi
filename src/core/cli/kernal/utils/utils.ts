/**
 * Normalizes a CLI name (option or flag) into a canonical format.
 *
 * ### Normalization rules:
 * 1. Trims surrounding whitespace.
 * 2. Removes all leading dashes (`-`), e.g.:
 *    - `--port` → `port`
 *    - `---foo` → `foo`
 * 3. Converts the name to lowercase.
 * 4. Collapses consecutive dashes into a single dash:
 *    - `foo--bar` → `foo-bar`
 * 5. Ensures the name:
 *    - contains only `[a-z0-9-]`
 *    - starts with a letter `[a-z]`
 *    - does not end with a dash (`-`)
 *    - does not contain consecutive dashes after normalization
 *
 * ### Throws:
 * - `Error` if the input is not a non-empty string.
 * - `RangeError` if the normalized name is empty.
 * - `Error` if the name contains invalid characters.
 * - `Error` if the name does not start with a letter.
 * - `Error` if the name ends with a dash.
 *
 * ### Notes:
 * - This function guarantees a stable, predictable key for internal storage.
 * - TypeScript types cannot fully enforce these rules; runtime validation is required.
 *
 * @param input - The raw name (may include dashes, uppercase letters, etc.)
 * @returns The normalized name in canonical form.
 * @since 1.0.0
 */
export function normalizeName<T extends string>(input: unknown): T {
    if (!input || typeof input !== 'string') {
        throw new Error('Name must be a non-empty string');
    }

    let str = input.trim();

    // Remove ALL leading dashes (---foo → foo)
    str = str.replace(/^-+/, '');

    if (!str) {
        throw new RangeError('Name cannot be empty');
    }

    // Normalize case
    str = str.toLowerCase();

    // Validate allowed characters first
    if (!/^[a-z0-9-]+$/.test(str)) {
        throw new Error(
            `Invalid name "${input}". Only [a-z0-9-] are allowed`
        );
    }

    // Must start with a letter
    if (!/^[a-z]/.test(str)) {
        throw new Error(
            `Invalid name "${input}". Must start with a letter`
        );
    }

    // Normalize multiple dashes → single dash
    str = str.replace(/-+/g, '-');

    // Prevent trailing dash
    if (str.endsWith('-')) {
        throw new Error(
            `Invalid name "${input}". Cannot end with '-'`
        );
    }

    // Prevent consecutive dashes (after normalization app is redundant,
    // but keeps intent explicit if normalization is ever removed)
    if (str.includes('--')) {
        throw new Error(
            `Invalid name "${input}". Cannot contain consecutive dashes`
        );
    }

    return str as T;
}