/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { Table } from "dexie";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../../configuration";
import { RetryManagementWorkerData } from "../../interfaces/retry-sync.interfaces";
import { AppDB } from "../../services/db";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";

/**
 * This workers is a seperate thread that will 'manage' state of the retry process.
 * We want to be able to:
 * - send as much retries as configured in constants/configuration
 * - be able to block/or restart new tries of sync-entity processes if the same object_name hasn't received correct retry answer.
 *  --> so probably it would make sense to prepare another database on FE to store data about object names that were not correctly concluded.
 * 
 * - to be decided the rest.
 */


addEventListener('message', async ({ data }) => {
    const receivedData = data as RetryManagementWorkerData;

    // const database = receivedData.retryDbInstance; // database == sync_retry
    let database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    await database.finishSetup();

    // First check if object_name exists in the retry process/DB if not, then this is first occurence;
    console_log_with_style(`THIS IS RETRY MANAGEMENT worker - show object name: ${receivedData.objectName}`, CONSOLE_STYLE.red_and_black!, receivedData);
    const collectionExists = database.tables.find((table: Table) => table.name == CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+receivedData.objectName);

    if (collectionExists) {
        // we are in repeat of retry
        console_log_with_style(`THIS IS RETRY MANAGEMENT worker - already created item`, CONSOLE_STYLE.red_and_black!, receivedData);
        await database.table(CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+receivedData.objectName).add(
            {
                requestUuid: receivedData.requestUuid,
                status: 'in-progress',
                retries: 0,
                createdDatetime: new Date(),
            }
        );
        // database.version(database.verno+1).stores(
        //     {
        //         TestMe: ''
        //     }
        // );
    } else {
        // we are first time visiting
        // soo create object store/collection for this object
        
        console_log_with_style(`THIS IS RETRY MANAGEMENT worker - first time visiting`, CONSOLE_STYLE.red_and_black!, receivedData);
        // database = await AppDB.changeSchema(database, {[CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+'fourLeaftClover']:''}); // &requestUuid,status,retries
        database = await AppDB.changeSchema(database, {[CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+receivedData.objectName]:'&requestUuid,status,retries,createdDatetime'});
    }





    postMessage('DONE');
});