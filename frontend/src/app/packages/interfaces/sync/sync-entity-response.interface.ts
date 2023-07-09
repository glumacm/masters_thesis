import { SyncEntityStatusEnum } from "../../enums/sync/sync-entity-status.enum";
import { MergeProcessResultI } from "./merge-process-result.interface";

export interface SyncEntityResponseI {
    status:  string;
    mergedData: MergeProcessResultI | undefined;
    error: any;

}
