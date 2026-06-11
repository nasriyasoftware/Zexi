export class ContextPointer {
    readonly #_words: string[];
    #_index = -1;

    constructor(words: string[]) {
        this.#_words = words;
    }

    hasNext(): boolean {
        return this.#_index + 1 < this.#_words.length;
    }

    next(): string | undefined {
        if (!this.hasNext()) { return }

        this.#_index++;
        return this.#_words[this.#_index];
    }

    peek(): string | undefined {
        return this.#_words[this.#_index + 1];
    }

    remaining(): string[] {
        return this.#_words.slice(this.#_index + 1);
    }

    get index(): number {
        return this.#_index;
    }
}

export default ContextPointer;