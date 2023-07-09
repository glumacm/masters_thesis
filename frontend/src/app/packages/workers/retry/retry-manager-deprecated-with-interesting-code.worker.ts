/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { liveQuery, Table } from "dexie";
import { firstValueFrom, of } from "rxjs";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../../configuration";
import { RetryManagementWorkerData, RetryManagerWorkerInputParameters, RetryPushNotificationStatusEnum } from "../../interfaces/retry-sync.interfaces";
import { CommunicationUIWorker } from "../../services/communication";
import { AppDB } from "../../services/db";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";
import { delay } from "../../utilities/worker-utilities";


let retryManagerDatabase: AppDB;
console_log_with_style(`Code executed in retry-manager, before 'on message' listener logic/code.`, CONSOLE_STYLE.promise_success!, null, 2);
(async function() {
    
    const databaseInstance = await getDatabase();
    liveQuery(
        () => databaseInstance.table(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME).where('status').equals(RetryPushNotificationStatusEnum.SENT).toArray()
    ).subscribe(
        (foundNewItems => {
            console_log_with_style(`RETRY-MANAGER live query subscription, with items: `, CONSOLE_STYLE.promise_success!, foundNewItems);
            databaseInstance.setStatusOnSyncItemsBasedOnStatusGeneric(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME, RetryPushNotificationStatusEnum.SENT.toString(), RetryPushNotificationStatusEnum.RECEIVED.toString(), 'status');
        })
    )
})();


/**
 * Workers do not execute only code in 'message' listener. Code outside that listener is already executed when we `inititate` the worker with:
 * const worker = new Worker(new URL('./workers/entity-sync.worker', import.meta.url));
 * So actually we can use worker as take and give mechanism. When something needs to be told to worker, we can simply tell it with `postMessage` command to worker.
 * That being said, it feels like the most important thing here is to create seperated logic in the `message` listener for different scenarios.
 */

/**
 * 
 * THIS DESCRIPTION IS FROM ANOTHER WEB WORKER: ----------------------------------------------------------------------------------------------------
 * This workers is a seperate thread that will 'manage' state of the retry process.
 * We want to be able to:
 * - send as much retries as configured in constants/configuration
 * - be able to block/or restart new tries of sync-entity processes if the same object_name hasn't received correct retry answer.
 *  --> so probably it would make sense to prepare another database on FE to store data about object names that were not correctly concluded.
 * 
 * - to be decided the rest.
 * -------------------------------------------------------------------------------------------------------------------------------------------------
 * 
 */



addEventListener('message', async ({ data }) => {
    
    // const receivedData = data as RetryManagementWorkerData;

    // LET's first check what to include in `data`


    //

    // const database = receivedData.retryDbInstance; // database == sync_retry
    // let database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    // await database.finishSetup();
    console_log_with_style('we are in retry manager', CONSOLE_STYLE.magenta_and_white);
    

    let numberOfExecutions = 0;
    const baseDelay = 1750
    const secondsUntilBreak = 15 // 20s 
    const baseMiliseconds = 1000
    // let's create undefinite loop
    while(numberOfExecutions < (secondsUntilBreak * baseMiliseconds) / baseDelay) {
        // Just to be safe, I will close this loop after some seconds
        await delay(baseDelay); // 5 iterations per second ~ hipotetically
        console_log_with_style(`PRINT from indefinite loop in `, CONSOLE_STYLE.magenta_and_white);
        numberOfExecutions++;
    }

    console_log_with_style(`We will close thread for retry manager - automatically`, CONSOLE_STYLE.magenta_and_white);

    // await delay(2000);  // Let's wait for 2 seconds



    postMessage('DONE');
});


async function getDatabase(): Promise<AppDB> {
    if (!retryManagerDatabase) {
        retryManagerDatabase = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await retryManagerDatabase.finishSetup();
    }
    return firstValueFrom(of(retryManagerDatabase));
}