import { DatabaseUtility } from "./database-utility";
// import { AppDB } from "src/app/services/db";
import { SynchronizationSyncedObject, SynchronizationSyncEntityRecord } from "../interfaces/sync-process.interfaces";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure, SyncWorkerResponse, SyncWorkerResponseValue } from "../interfaces/sync-storage.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "./console-style";
import { AppDB } from "../services/db";



export function check_if_object_name_exists(database: AppDB, object_name: string) {
    console_log_with_style('This is tables in dexie:', CONSOLE_STYLE.observable_error!, database.tables);
    return !!database.tables.find((table) => table.name === object_name); // !! => pretvorimo v bool
}

function findObjectNamesInDatabase(initialisedDatabase: IDBDatabase, syncDBPrefix: string): string[] {
    // OBSTAJA TUDI DRUGI NACIN KAKO preveriti recorde iz object store-a --> ima nekaj v vezi s `cursorji`.
    const objectNamesToCheck = [];
    if (initialisedDatabase?.objectStoreNames?.length && initialisedDatabase.objectStoreNames.length > 0) {
        for (let i = 0; i < initialisedDatabase.objectStoreNames.length; i++) {
            const item = initialisedDatabase.objectStoreNames[i];
            if (item.startsWith(syncDBPrefix)) {
                objectNamesToCheck.push(item);
            }
        }
    }

    return objectNamesToCheck;
}

async function findObjectsPendingSync(objectNamesToCheck: string[], launchDatabase: DatabaseUtility): Promise<SyncWorkerResponse> {
    // 1. We need to check all chambers
    // 2. We should get map of object names and array of objects that are pending sync
    // PRoblem: How are we gonna send multiple objects to "save" - BE must be pre-programmed to allow objects as lists...


    const mapObjectNameToPendingItems = {} as SyncWorkerResponse;

    // Ce imamo seznam imena objektov lahko zacnemo pridobivati vsakega zase:
    if (objectNamesToCheck.length > 0) {
        for (let i = 0; i < objectNamesToCheck.length; i++) {
            const objectName = objectNamesToCheck[i];
            // const objectStore = await launchDatabase.returnObjectStoreIfExists(objectName, 'readonly').toPromise();


            // getAllKeyValueEntriesFromObjectStore
            const allEntries = await launchDatabase.getAllKeyValueEntriesFromObjectStore(objectName).then();
            // await launchDatabase.transactionAsObservable(objectStore!.transaction).toPromise();

            if (allEntries.length > 0) {
                const pendingObjects = allEntries.filter((item) => item.chamberRecord.objectStatus == ChamberSyncObjectStatus.pending_sync);
                if (pendingObjects.length > 0) {
                    mapObjectNameToPendingItems[objectName] = pendingObjects as SyncWorkerResponseValue[];
                }
            }

            // old logic before 13.11.2022
            // const allEntries = await launchDatabase.getAllEntriesFromObjectStore(objectStore).then();
            // await launchDatabase.transactionAsObservable(objectStore!.transaction).toPromise();
            // if (allEntries.length > 0) {
            //   const pendingObjects = allEntries.filter((item) => item.objectStatus == ChamberSyncObjectStatus.pending_sync)
            //   if (pendingObjects.length > 0) {
            //     mapObjectNameToPendingItems[objectName] = pendingObjects as SyncChamberRecordStructure[];
            //   }
            // }
        }
    }

    return mapObjectNameToPendingItems;

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