// import { AppDB } from "src/app/services/db";
import { SynchronizationSyncedObject, SynchronizationSyncEntityRecord } from "../interfaces/sync-process.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "./console-style";
import { AppDB } from "../services/db";



export function check_if_object_name_exists(database: AppDB, object_name: string) {
    console_log_with_style('This is tables in dexie:', CONSOLE_STYLE.observable_error!, database.tables);
    return !!database.tables.find((table) => table.name === object_name); // !! => pretvorimo v bool
}

/**
 * 
 * @param sentRecords Items of type ChamberBLabla
 * @param successfullRecords Item of type ResponseBlabla
 */
export function findRejectedItems(sentRecords: SynchronizationSyncEntityRecord[], successfullRecords: SynchronizationSyncedObject[]): SynchronizationSyncEntityRecord[] {
    const failedRecords = sentRecords.filter(
        (sentRecord: SynchronizationSyncEntityRecord) => {
            // if sentRecord.localUUID is not in successfullrecords, then set this data to filtered array
            return !successfullRecords.find((successItem: SynchronizationSyncedObject) => sentRecord.localUUID == successItem.localUuid);
        }
    )
    return failedRecords;
}


export function delay(time: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, time));
}