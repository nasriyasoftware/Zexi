import type { OptionAbbrev, OptionName } from "../../types/types";

export type DataTypeMap = {
    string: string;
    number: number;
    boolean: boolean;
    date: Date;
};

export type OptionDataType = keyof DataTypeMap;
export type CLIOptionParams<K extends OptionDataType> = {
    /**
     * The name of the option
     * @example
     * --name
     */
    name: string;

    /**
     * The abbreviation of the option
     * @example
     * -n
     */
    abbrev?: string;

    /**
     * The description of the option
     * @example
     * "This option enable ... or do ..."
     */
    description?: string;

    /**
     * The expected data type of the option.
     * The parser will validate the data type of the option if provided, and
     * in some cases like the `date` type, the parser will convert the data into
     * a `Date` object.
     * 
     * **NOTE**: By default, the parser will read the value as is (`string`).
     */
    dataType?: K;

    /**
     * Whether or not the option is required.
     * @default false
     */
    required?: boolean;

    /**
     * The default value of the option.
     * @default undefined
     */
    defaultValue?: DataTypeMap[K];
};

export type CLIOptionConfigType<K extends OptionDataType> = {
    /**
     * The name of the option
     * @example
     * --name
     */
    name: OptionName;

    /**
     * The abbreviation of the option
     * @example
     * -n
     */
    abbrev: OptionAbbrev | undefined;

    /**
     * The description of the option
     * @example
     * "This option enable ... or do ..."
     */
    description: string | undefined;

    /**
     * The expected data type of the option.
     * The parser will validate the data type of the option if provided, and
     * in some cases like the `date` type, the parser will convert the data into
     * a `Date` object.
     * 
     * **NOTE**: By default, the parser will read the value as is (`string`).
     */
    dataType: K;

    /**
     * Whether or not the option is required.
     * @default false
     */
    required: boolean;

    /**
     * The default value of the option.
     * @default undefined
     */
    defaultValue: DataTypeMap[K] | undefined;
};