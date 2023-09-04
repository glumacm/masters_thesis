import { plainToInstance } from "class-transformer";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_SCHEMA_MAPPER } from "../configuration";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from "../interfaces/sync-storage.interfaces";
import { AppDB } from "../services/db";
import { SyncLibraryNotification } from "../models/event/sync-library-notification.model";
import { SyncLibraryNotificationEnum } from "../enums/event/sync-library-notification-type.enum";
import { cloneDeep } from "lodash";
import { SyncLibAutoMerge } from "../services/automerge-service";
import { SyncEntryI } from "../workers/retry/utilities";
import { ConflictService } from "../services/conflict-service";
import { CustomConsoleOutput } from "./console-style";
import { Table } from "dexie";

export interface StoreNewObjectResult {
    resultData: SyncChamberRecordStructure | null | undefined,
    tempDB: AppDB,
    conflictDB: AppDB,
    syncDB: AppDB,
}
export async function storeNewObject(
    entityName: string,
    objectUuid: string,
    objectData: any,
    syncLibAutoMerge: SyncLibAutoMerge,
    conflictService: ConflictService,
    conflictDB: AppDB,
    syncDB: AppDB,
    tempDB: AppDB,
    consoleOutput: CustomConsoleOutput,
    synchronizationLibrary: any,
    sendNotificationProxy: ((event: any) => Promise<any>) | undefined = undefined,
    isAutomaticEvent: boolean = false,
): Promise<StoreNewObjectResult> {

    const retrievedConflictDB = conflictDB; //await this.getConflictDB();
    const retrievedSyncDB: AppDB = syncDB; // await this.getSyncDB();
    const existingConflictEntry = retrievedConflictDB.tableExists(entityName) ? (await retrievedConflictDB.table(entityName).get(objectUuid)) : undefined;
    if (!retrievedSyncDB.tableExists(entityName)) {
        // create table for entity
        syncDB = await (retrievedSyncDB).changeSchemaInstance(retrievedSyncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] }, retrievedSyncDB.verno / 10)
    }

    if (existingConflictEntry) {
        // IMAMO PODATEK ZE V CONFLICTU in v tem primeru ne pustimo nadaljnega shranjevanja
        const event = plainToInstance(SyncLibraryNotification, { createdAt: new Date(), type: SyncLibraryNotificationEnum.ALREADY_CONFLICTED, message: `Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.` });
        if (sendNotificationProxy) {
            sendNotificationProxy(event);
        } else {
            synchronizationLibrary.eventsSubject.next(event);
        }
        
        return {resultData: null, tempDB, conflictDB, syncDB} as StoreNewObjectResult;
    }

    // USE-CASE ZA TEMP
    const retrievedTempDB = tempDB; //await this.getTempDB();
    const existingTempEntry = retrievedTempDB.tableExists(entityName) ? (await retrievedTempDB.table(entityName).get(objectUuid)) : undefined;
    if (
        existingTempEntry
    ) {
        // const dataFromTemp = cloneSyncObjectWithEncoded(existingTempEntry as any) as SyncChamberRecordStructure; // TODO: Spremeniti tip ki ga damo v funkcijo in ki ga dobimo iz funkcije
        const dataFromTemp = cloneDeep(existingTempEntry) as SyncChamberRecordStructure;
        // Ta zadeva naredi nekaj kar zaenkrat ne razumem
        const dataToInsert = await syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromTemp);

        (await retrievedTempDB.table(entityName)).put(dataToInsert, objectUuid);
        const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible (overwritten temp data).' };
        const event = plainToInstance(SyncLibraryNotification, newEvent);
        if (sendNotificationProxy) {
            sendNotificationProxy(event);
        } else {
            synchronizationLibrary.eventsSubject.next(event);
        }
        return {resultData: dataToInsert, tempDB, conflictDB, syncDB} as StoreNewObjectResult;
    }

    // Kaksna je razlika med tem, da ugotoivm, da moram nastaviti TEMP preko syncing in pre-existing TEMP?
    const retrievedSyncDB1 = syncDB; // await this.getSyncDB();
    const existingEntry: SyncEntryI = retrievedSyncDB1.tableExists(entityName) ? await retrievedSyncDB1.table(entityName).get(objectUuid) : undefined; // TODO: Manjka logika, ki bo existingentryju dodala nove podatke , ker drugace se povozijo prejsnej spremembe

    if (
        existingEntry &&
        (
            // existingEntry.status === SyncingObjectStatus.in_sync ||
            // existingEntry.status === SyncingObjectStatus.pending_retry
            existingEntry.objectStatus === ChamberSyncObjectStatus.in_sync ||
            existingEntry.objectStatus === ChamberSyncObjectStatus.conflicted ||
            existingEntry.objectStatus === ChamberSyncObjectStatus.pending_retry  // this should cover use-case when we need to save data but cannot do it in SYNC_DB because of network or timeout error
        )
    ) {
        let useCaseMessage = `Data stored to TEMP because related object has status: ${existingEntry.objectStatus}`;
        let useCaseType = SyncLibraryNotificationEnum.SYNC_IN_PROGRESS;

        if (existingEntry.objectStatus === ChamberSyncObjectStatus.conflicted) {
            useCaseType = SyncLibraryNotificationEnum.CONFLICT;
        } else if (existingEntry.objectStatus === ChamberSyncObjectStatus.pending_retry) {
            useCaseType = SyncLibraryNotificationEnum.ITEM_IS_PENDING_RETRY;
        }
        const dataFromSync = cloneDeep(existingEntry) as SyncChamberRecordStructure;
        const dataToInsert = await syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromSync); // await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromSync);
        tempDB = await (tempDB).addEntryToTable(entityName, objectUuid, dataToInsert, (tempDB).verno / 10, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] });
        const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: `${useCaseMessage}: ${useCaseType}` };
        const event = plainToInstance(SyncLibraryNotification, newEvent);
        if (sendNotificationProxy) {
            sendNotificationProxy(event);
        } else {
            synchronizationLibrary.eventsSubject.next(event);
        }
        return {resultData: dataToInsert, tempDB, conflictDB, syncDB} as StoreNewObjectResult;
    }

    // Removed check and initialise entityName table and added to top of function

    // V tem trenutku imamo sigurno tabelo `entityName` v syncDB
    const preExisting: SyncEntryI | undefined = await (syncDB).table(entityName).get(objectUuid);

    let dataToReturn: SyncChamberRecordStructure = {} as SyncChamberRecordStructure;

    if (preExisting) {
        dataToReturn = await syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, preExisting);
    } else {
        dataToReturn = conflictService.prepareSyncRecordChamberStructure(
            objectUuid,
            objectData,
            [],
            undefined,
            (isAutomaticEvent ? ChamberSyncObjectStatus.synced : ChamberSyncObjectStatus.pending_sync), 
            objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] ? objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] : undefined,
        ) as SyncChamberRecordStructure;
    }
    (syncDB).table(entityName).put(dataToReturn, objectUuid);
    const event = plainToInstance(SyncLibraryNotification, { createdAt: new Date(), message: `Successfully saved item: ${objectUuid} to sync library`, type: SyncLibraryNotificationEnum.STORED_TO_SYNC } as SyncLibraryNotification);
    if (sendNotificationProxy) {
        sendNotificationProxy(event);
    } else {
        synchronizationLibrary.eventsSubject.next(event);
    }
    return {resultData: dataToReturn, tempDB, conflictDB, syncDB} as StoreNewObjectResult;
}

export async function findPendingRetryEntries(tables: Table[], transformFunction: (obj: SyncChamberRecordStructure) => any): Promise<any> {
    try {
        const mapEntityToFoundItems = {} as any;
        for (let i = 0; i < (tables.length) ; i++) {
            const table: Table = tables[i];
            const pending_retry: any[] | undefined = (await table.filter((obj: SyncChamberRecordStructure) => obj.objectStatus === ChamberSyncObjectStatus.pending_retry).toArray()).map(transformFunction) ?? [];
            
            let existingArray: undefined | any[] = mapEntityToFoundItems[table.name];
            if (!existingArray) {
                existingArray = [];
            }
            existingArray.push(...pending_retry);
            mapEntityToFoundItems[table.name] = existingArray;
        }
        return mapEntityToFoundItems;
    } catch (exception) {
        return {} as any;
    }
}

export async function findPendingRetryItemByRequestUuid(syncDB: AppDB, requestUuid: string, entityName: string): Promise<SyncChamberRecordStructure | undefined> {
    const foundItems = await syncDB.table(entityName).filter((obj: SyncChamberRecordStructure) => obj.objectStatus === ChamberSyncObjectStatus.pending_retry && obj.lastRequestUuid === requestUuid);
    return await foundItems.first();
}

export async function setInSyncObjectsToPendingSync(syncDB: AppDB): Promise<AppDB> {
    for (let i = 0; i < syncDB.tables.length; i++) {
        const table: Table = syncDB.tables[i];
        await table.filter((obj: SyncChamberRecordStructure) => obj.objectStatus === ChamberSyncObjectStatus.in_sync).modify((obj: SyncChamberRecordStructure) => {obj.objectStatus = ChamberSyncObjectStatus.pending_retry});
    }
    return syncDB;
}