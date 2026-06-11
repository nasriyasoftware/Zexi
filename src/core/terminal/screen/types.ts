export type TerminalCellOptions =
    | {
        value: string;
        final?: boolean;
        template?: string;
    }
    | {
        value: Record<string, any>;
        template: string;
        final?: boolean;
    };

export interface SnapshotEntryData {
    /** The value of the cell */
    value: string;
    /** The number of lines the cell spans */
    height: number;
}

export type SnapshotEntry = SnapshotEntryData & { startsAt: number; }

export type TerminalRendererFunc = (index: number, updatedEntry: SnapshotEntry) => void;