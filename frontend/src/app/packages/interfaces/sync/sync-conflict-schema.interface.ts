import { SyncConflictItemI } from "./sync-conflict-item.interface";

export interface SyncConflictShemaI {
    objectUuid: string;
    record: any;
    conflicts: SyncConflictItemI[] | undefined;
}