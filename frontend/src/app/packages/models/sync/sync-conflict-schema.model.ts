import { SyncConflictItemI } from "../../interfaces/sync/sync-conflict-item.interface";
import { SyncConflictShemaI } from "../../interfaces/sync/sync-conflict-schema.interface";
import { SyncConflictItem } from "./sync-conflict-item.model";

export class SyncConflictSchema implements SyncConflictShemaI {
    objectUuid: string | any;
    record: any;
    conflicts: SyncConflictItem[] | undefined;
}