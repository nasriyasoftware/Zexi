export function noop() { }
export function isRecord<T = unknown>(value: unknown): value is Record<string, T> {
    return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value) &&
        !(value instanceof Set) &&
        !(value instanceof Map) &&
        !(value instanceof Date) &&
        !(value instanceof RegExp) &&
        Object.getPrototypeOf(value) === Object.prototype;
}

export function hasOwnProp<T extends Record<string, any>>(
    obj: T,
    prop: keyof T | (string & {})
): prop is keyof T {
    if (!isRecord(obj)) return false;
    return Object.prototype.hasOwnProperty.call(obj, prop);
}