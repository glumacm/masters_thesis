/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;
/********** NEEDS REFACTORING PATHS/VARIABLES */
import { SYNC_DB_PREFIX_STRING } from "../utilities/database-utility";
import { SyncPendingObjectWorkerParameters } from "../interfaces/workers";
/*********************************** */

import axios from "axios";
import Dexie, { PromiseExtended } from "dexie";

import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../configuration";
import { ResponseMessage, SynchronizationPostData, SynchronizationSyncedObject, SynchronizationSyncEntityRecord, SynchronizationSyncResponse } from "../interfaces/sync-process.interfaces";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from "../interfaces/sync-storage.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";
import { check_if_object_name_exists, findRejectedItems } from "../utilities/worker-utilities";
// import { AppDB } from "../../services/db"; // DEPRECATED PATH!!!!
import { v4 as uuidv4 } from 'uuid';
import { sync_entity_records_batch } from "../services/network-calls";
import { ResponseMessageType, SynchronizationSyncStatus } from "../enums/sync-process.enum";
import { getObjectNameToPathMapper } from "../services/configuration";
import { AppDB } from "../services/db";
import { RetryManagementWorkerData } from "../interfaces/retry-sync.interfaces";
// import * as monitor from './packages/services/monitor';

// import { WorkerCheckPendingSyncInput } from './app.worker.models'; // tukaj je definicija vhoda, ki ga pricakujem za "data" v "message" eventu
// import { DatabaseUtility, SYNC_DB_PREFIX_STRING } from "./app.utility";
// import { ChamberSyncObjectStatus, SyncChamberRecordStructure, SyncWorkerResponse, SyncWorkerResponseValue } from './packages/interfaces/sync-storage.interfaces';


// pripraviti celotno strukturo za pridobivanje podatkov iz baze ... ali pa importati zadeve, ki jih imam v sync service-u.


addEventListener('message', async ({ data }) => {

    const passedData: SyncPendingObjectWorkerParameters = data;
    const objectName = passedData.objectName;

    if (!objectName) {
        return;
    }



    console_log_with_style('DATA IN WEB WORKER -> sync entity', CONSOLE_STYLE.black_and_white!, passedData);



    /**
     * Proces sinhronizacije:
     * 
     * 1. poisci vse objekte, ki so za sync
     *  a. moramo tudi preveriti vse objekte, ki jih zelimo imeti shranjene v bazi?
     *  b. pomojem je dovolj, da se sprehodimo po tabelah.
     */

    const databaseInstance = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
    const databaseRetryInstance = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    await databaseInstance.finishSetup();
    await databaseRetryInstance.finishSetup();

    const currentTables = databaseInstance.tables;
    // const objectExistsInDatabase = check_if_object_name_exists(databaseInstance, SYNC_DB_PREFIX_STRING + objectName);

    // const map_records_to_tables = {}



    // Ce bomo poslali objectName='', se bo worker zakljucil preden pride do tega dela.
    const tablesForSync = findTablesForSync(currentTables, SYNC_DB_PREFIX_STRING + objectName);

    // Poisci tabele in pripadajoce recorde, ki so pripravljeni za sync.
    // v trenutnem primeru, bo to delovalo le za eno tabelo, saj je trenutna ideja, da v objectName podamo ime entite in posledicno dobimo le podatke ene tabele.
    const mapRecordsToTables = await tablesForSync.reduce(
        async (accumulatorPromise: Promise<{ [key: string]: SynchronizationSyncEntityRecord[] }>, currentItem: Dexie.Table) => {
            const accumulator = await accumulatorPromise;
            const arrayOfRecordsToSync: any[] = await queryDataBasedOnObjectStatus(currentItem); // TODO: AFTER, revert status back to default!!!

            // Now convert each record to SynchronizationSyncEntityRecord -> so that we can send data to BE
            const syncRecordsStructure: SynchronizationSyncEntityRecord[] = arrayOfRecordsToSync.map(
                (recordItem: SyncChamberRecordStructure) => {
                    // recordItem.record['id'] = 1;
                    return {
                        localUUID: recordItem.localUUID,
                        record: { 'name': 'youknow112578', 'description': 'testdescriptionBiti89Now', 'id': '77' }, // recordItem.record,
                        lastModified: new Date(),
                    } as SynchronizationSyncEntityRecord
                }
            );

            // accumulator[currentItem.name] = await queryDataBasedOnObjectStatus(currentItem); // TODO: AFTER, revert status back to default!!!
            accumulator[currentItem.name] = syncRecordsStructure;
            return accumulator
        },
        Promise.resolve({} as { [key: string]: SynchronizationSyncEntityRecord[] }),
    );

    // IF DATA EXISTS then process otherwise end worker logic
    if ((!mapRecordsToTables[SYNC_DB_PREFIX_STRING + objectName]) || mapRecordsToTables[SYNC_DB_PREFIX_STRING + objectName]?.length == 0) {
        // @explanation: if no data found for entity, we finish our work;
        console_log_with_style(`NOW this condition should be ok: ${SYNC_DB_PREFIX_STRING+objectName}`, CONSOLE_STYLE.promise_success!, mapRecordsToTables, 2);
        return;
    }

    // console_log_with_style('CONTINue WITH real example worker logic - to send data to BE', CONSOLE_STYLE.promise_success!, uuidv4());
    console_log_with_style('CONTINue WITH real example worker logic - to send data to BE', CONSOLE_STYLE.promise_success!, mapRecordsToTables,1);

    // TODO
    /**
     * Problem o katerem je potrebno zares razmisliti:
     * - Kako bom resil problem socasnosti. v primeru da nekdo dostopi v isti [ms] do istega podatka v bazi, kot ga mi tukaj
     * popravljamo/nastavljamo?
     */

    // Preden zacnemo proces, moramo prvo nastaviti vse najdene objekte v sstanje 'in_sync'
    const itemsUpdated = await databaseInstance.setStatusOnSyncItemsBasedOnStatus(SYNC_DB_PREFIX_STRING + objectName, ChamberSyncObjectStatus.pending_sync, ChamberSyncObjectStatus.in_sync);

    if (!itemsUpdated) {
        console_log_with_style('ITEMS UPDATE FAILED', CONSOLE_STYLE.red_and_black!, ''); // TODO-LOG --> dodati ta zapis v LOG
        return;
    }

    // SEND data to BE
    const dataBE = {} as SynchronizationPostData;
    console_log_with_style('ive been doing a good job, making them think', CONSOLE_STYLE.white_and_black!, {});
    console_log_with_style('To so podatki o CONFIGURACIJI:  ', CONSOLE_STYLE.white_and_black!, getObjectNameToPathMapper('')[objectName]);
    // dataBE.class_name = 'App\\Entity\\TheWorst';
    dataBE.class_name = getObjectNameToPathMapper('')[objectName];
    console_log_with_style('WHAT ABOUT NOW: ', CONSOLE_STYLE.black_and_white!, dataBE.class_name);
    dataBE.last_db_modified = new Date();
    dataBE.object_data = {};
    const urlPath = `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}`;
    const entityRecords = mapRecordsToTables[SYNC_DB_PREFIX_STRING + objectName]
    // 'App\\Entity\\TheTest'

    {
        /**
         * Pripravimo strukturo, ki jo bomo poslali kot rezultat workerja v main thread...
         * Ceprav, bi mogoce bila dobra ideja, da bi prvo sprozil en worker, ki bi deloval kot backghround process manager in nato iz njega sprozil se ostale web workerje... ampak o TEM KASNEJE.
         */
    }
    const responseData = {
        code: 200,
        status: SynchronizationSyncStatus.COMPLETE,
        data: {}
    };

    const requestUuid = uuidv4();

    // @TODO: This call to BE should not be executed if there is no NETWORK!!!!!!!!!!
    await sync_entity_records_batch(getObjectNameToPathMapper('')[objectName], entityRecords, requestUuid).then(
        (success) => {
            const response_data: ResponseMessage | undefined = success.data;
            console_log_with_style('WHERE IS THIS _ SUCCESS', CONSOLE_STYLE.observable_error!, success);
            /**
             * TODO: On success we need to mark data in CLIENT indexedDB(dexie) that data is synced
             * To pomeni, da bom moral iz BE dobiti odgovor o vseh recording/objektih, ki so bili posodobljeni/sinhronizirani.
             *  DONE -> narejeno tako, da posljem na BE seznam objektov ki vsebuje tudi localUUID in nato posljem nazaj seznam objektov (localUuid in lastModified), s katerim uredim zadnje zahteve.
             * 
             * Potrebno bo imeti predpripravljen seznam vsega kar smo poslali, da bom kasneje primerjal, kaj
             * je bilo popravljeno in kaj ne - v primeru, da se kaj ne bo posinchalo.
             *  -> ta seznam sem pripravil, mmanjka samo logika kako odreagirati, ko ne bom uspesen sync (delni ali popolni fail).
             * 
             */

            console_log_with_style('SOME PEOPLE LIVE JUST OT PLAy the game', CONSOLE_STYLE.promise_success!, response_data?.type);


            if (response_data?.type == ResponseMessageType.SUCCESS) {

                // start doing some specific work
                const sync_data: SynchronizationSyncResponse = response_data.data;
                console_log_with_style('WHAT IS SYNC STATUS:  ', CONSOLE_STYLE.promise_success!, sync_data.syncStatus);
                if (sync_data.syncStatus === SynchronizationSyncStatus.FAILED_ALL) {
                    // START PROCESS RELATED TO synchronization failed
                    console_log_with_style('SYNCHRONIZATION FAILED', CONSOLE_STYLE.red_and_black!, {});
                    responseData.status = SynchronizationSyncStatus.FAILED_ALL;

                } else {

                    { // first update all successful data;
                        // TODO: Add this logic to some function in `worker-utilities.ts`
                        sync_data.finishedSuccessfully?.forEach(
                            async (recordItem: SynchronizationSyncedObject, index: number) => {
                                /**
                                 * TODO: Potrebno bo razmisliti, ali bom moral shranjevati v BULK mode-u, ki ga omogoca DEXIE.js!!!
                                 */
                                console_log_with_style('BE item, that needs to be updated on FE: ', CONSOLE_STYLE.white_and_black!, recordItem);
                                // find record that was successfully updated/inserted in BE in browser DB based on localUuid
                                // PREPOSTAVKA: Podatek mora obstajati, drugace localUuid ne bi mogel biti poslan na BE.
                                const recordItemInBrowserDB = await databaseInstance.getItemByLocalUuid(SYNC_DB_PREFIX_STRING + objectName, recordItem.localUuid);
                                // TODO: Premisliti, ali bomo lastModified podatek imeli vedno shranjenega v tem polju ali bomo to nekako dinamicno dobili iz neke konfiguracije?
                                recordItemInBrowserDB.record.lastModified = sync_data.finishedSuccessfully.find((record: SynchronizationSyncedObject) => record.localUuid == recordItem.localUuid)?.lastModified;
                                recordItemInBrowserDB.objectStatus = ChamberSyncObjectStatus.synced;
                                // Find key of record from browser DB which is linked to localUuid that is currently processed - because we need item key if we want to update data in browser DB
                                const itemKey = await databaseInstance.getKeyByLocalUuid(SYNC_DB_PREFIX_STRING + objectName, recordItem.localUuid);
                                const updateSuccess = databaseInstance.updateItemFromTable(SYNC_DB_PREFIX_STRING + objectName, itemKey, recordItemInBrowserDB); // return true|false, depending on success of update function
                                console_log_with_style(`WAS UPDATE FOR DATA ${recordItem.localUuid}, successfull: ${updateSuccess}`, CONSOLE_STYLE.white_and_black!, updateSuccess);
                            }
                        )
                    }

                    { // // then filter array of sent data so that we have only rejected/failed objects so that we start another process
                        const rejectedItems = findRejectedItems(entityRecords, sync_data.finishedSuccessfully);
                        responseData.status = rejectedItems.length > 0 ? SynchronizationSyncStatus.PARTIAL : SynchronizationSyncStatus.COMPLETE;

                    }


                }
            } else {
                // start some process for handling error
                responseData.code = 500;
                responseData.status = SynchronizationSyncStatus.FAILED_ALL;
                console_log_with_style(`WORKER-firstRealExample encountered an error with status error: ${response_data?.code}`, CONSOLE_STYLE.promise_error!, response_data?.message);
            }

        },
        async (error) => {
            /***
             * If there is an error (like timeout) then we receive:
             * { code="ECONNABORTED", ...}
             */
            const itemsUpdated = await databaseInstance.setStatusOnSyncItemsBasedOnStatus(SYNC_DB_PREFIX_STRING + objectName, ChamberSyncObjectStatus.in_sync, ChamberSyncObjectStatus.pending_sync);
            console_log_with_style('ITEMS SHOULD BE NOW REVERTED BACK TO PENDING SYNC', CONSOLE_STYLE.promise_success!, itemsUpdated);
            console_log_with_style('SYNC PROCESS2323232 API CALL _ ERROR', CONSOLE_STYLE.observable_error!, error);
            console_log_with_style('WHERE IS THIS _ ERROR', CONSOLE_STYLE.red_and_black!, error);
            if (error.code === SynchronizationSyncStatus.ECONNABORTED || error.code === SynchronizationSyncStatus.ERR_NETWORK) {
                responseData.code = 500;
                responseData.status = SynchronizationSyncStatus.ECONNABORTED;

                /**
                 * Start retry process
                 * - get data from constatnt - how many times can you do this
                 *      -> but first, i would create new worker that will manage retry process
                 *      because it will be easier to manage, execute and etc. stuff related to retry.
                 * - after retry management is programmed, do not forget to prepare logic that will
                 * check if retry process for object_name is in progress- or pending future executions! Maybe there will be some
                 * logic/process flow to consider in that state.
                 */

                const retryManagement = new Worker(new URL('./retry/retry-sync-manager.worker', import.meta.url));
                retryManagement.onmessage = (ev: MessageEvent) => {
                    console_log_with_style('IF YOU CHOOSE MEEEE - entity sync worker - received data from retry management', CONSOLE_STYLE.red_and_black!, ev);
                }
                const dataForRetryManagement = {} as RetryManagementWorkerData;
                dataForRetryManagement.objectName = objectName;
                dataForRetryManagement.requestUuid = requestUuid;
                // dataForRetryManagement.retryDbInstance = databaseRetryInstance // CANNOT pass database instance to worker from input data....
                
                retryManagement.postMessage(dataForRetryManagement);


            } else {
                responseData.code = 500;
                responseData.status = SynchronizationSyncStatus.FAILED_ALL;
            }
            /**
             * TODO: If error received from BE, we need to take care of some use cases:
             * - if last_modified not ok
             * - if some required fileds are missing
             * - if generic error
             */
        }
    );

    // Ko koncamo s sinhronizacijo, je potrebno ponovno preveriti, ali je vmes prislo do spremembe, zato, da ponovno posljemo podatke, ki so shranjeni v <SyncTEMP>

    {
        // TODO-LOGIC
    }


    console_log_with_style('Kako je lepo biti glup, kazu budale', CONSOLE_STYLE.try_cattch_error!, mapRecordsToTables);
    console_log_with_style('you ve got a friend in me', CONSOLE_STYLE.observable_error!, mapRecordsToTables[SYNC_DB_PREFIX_STRING + objectName]);


    // const data_from_table = await testData(go_back_we_cant[0]);
    // console_log_with_style('data from table', CONSOLE_STYLE.databaseUtilityLogic!, data_from_table)



    postMessage(responseData);




    // postMessage('CEKAM SAMO POZIV TVOJ: response from FIRST REAL EXAMPLE WORKER');
});

function findTablesForSync(tables: Dexie.Table[], tablePrefix: string): Dexie.Table[] {
    return tables.filter(
        (table: Dexie.Table) => table.name.startsWith(tablePrefix)
    );
}

/**
 * 
 * @param table 
 * @param objectStatus 
 * @returns Array of records in IndexedDB.<table> where `objectStatus` === ChamberSyncObjectStatus.pending_sync
 */
function queryDataBasedOnObjectStatus(table: Dexie.Table, objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync): PromiseExtended<any> {
    // table.)
    return table.filter((obj) => obj.objectStatus == objectStatus).toArray();
}
