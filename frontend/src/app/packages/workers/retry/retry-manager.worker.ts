/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { liveQuery, Table } from "dexie";
import { firstValueFrom, of } from "rxjs";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../../configuration";
import { RetryManagerPostCommandEnum } from "../../enums/retry.enum";
import { SynchronizationSyncStatus } from "../../enums/sync-process.enum";
import { RetryManagementWorkerData, RetryManagerWorkerInputParameters, RetryManagerWorkerPostDataI, RetryPushNotificationStatusEnum } from "../../interfaces/retry-sync.interfaces";
import { SyncEntityWorkerResponse } from "../../interfaces/sync-process.interfaces";
import { CommunicationUIWorker } from "../../services/communication";
import { AppDB } from "../../services/db";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";
import { delay } from "../../utilities/worker-utilities";


console_log_with_style(`Code executed in retry-manager, before 'on message' listener logic/code.`, CONSOLE_STYLE.promise_success!, null, 3);
let retryManagerDatabase: AppDB;
let retryDatabase: AppDB;
let reEvaluationInterval: any | null = null;
(async function () {

    const databaseInstance = await getDatabase();
    liveQuery(
        () => databaseInstance.table(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME).where('status').equals(RetryPushNotificationStatusEnum.SENT).toArray()
    ).subscribe(
        (foundNewItems => {
            console_log_with_style(`RETRY-MANAGER live query subscription, with items: `, CONSOLE_STYLE.promise_success!, foundNewItems);
            databaseInstance.setStatusOnSyncItemsBasedOnStatusGeneric(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME, RetryPushNotificationStatusEnum.SENT.toString(), RetryPushNotificationStatusEnum.RECEIVED.toString(), 'status');
        })
    )

    await getRetryDatabase();
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
startReEvaluationInterval();

addEventListener('message', async ({ data }) => {
    const postData: RetryManagerWorkerPostDataI = data as RetryManagerWorkerPostDataI;
    switch (postData.command) {
        case RetryManagerPostCommandEnum.ADD_NEW_RETRY_ENTRY:
            await addNewRetryEntry(postData.data);
            break;
        case RetryManagerPostCommandEnum.CLOSE_REEVALUATION_INTERVAL:
            clearReEvaluationInterval();
            break;
        case RetryManagerPostCommandEnum.INITIALIZE_DB:
            break;
        case RetryManagerPostCommandEnum.TERMINATE_THREAD:
            break;
        case RetryManagerPostCommandEnum.PRINT_MESSAGE:
            console_log_with_style(`This is message from retry manager worker when receiving command:${postData.command}`, CONSOLE_STYLE.magenta_and_white, postData.data, 2);
            break;
        default:
            console_log_with_style(`Going to default mode in retry manager`, CONSOLE_STYLE.promise_error!, null, 2);
            break;
    }


});

async function startReEvaluationInterval() {
    if (!reEvaluationInterval) {
        reEvaluationInterval = setInterval(
            () => {
                if (retryManagerDatabase) {
                    const mappedSearch: {[key:string]: any} = {}
                    retryDatabase.tables.forEach(
                        async (table: Table) => {
                            if (await table.count() > 0) {
                                const foundItems = await table.where('status').equals('in-progress').toArray();
                                mappedSearch[table.name] = foundItems;
                            }
                        }
                    )

                    // iz podatkov, ki jih dobimo, je potrebno izvesti ponovno celo logiko.
                    // Glede na to, kako trenutno programiram, se je poterbno vprasati kak obomo izvedli MULTI thread entitysync.
                    console_log_with_style(`This data is found in reevaluation`, CONSOLE_STYLE.black_and_white!, mappedSearch, 3);
                }
                // check if data needs to be reevaluated
                // console_log_with_style('Re-evaluate, if retry should be executed', CONSOLE_STYLE.magenta_and_white, null, 3);
            }, 12500
        )
    }
}

function clearReEvaluationInterval() {
    reEvaluationInterval = null;
}



async function getDatabase(): Promise<AppDB> {
    if (!retryManagerDatabase) {
        retryManagerDatabase = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await retryManagerDatabase.finishSetup();
    }
    return firstValueFrom(of(retryManagerDatabase));
}

async function getRetryDatabase(): Promise<AppDB> {
    if (!retryDatabase) {
        retryDatabase = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await retryDatabase.finishSetup();
    }
    return firstValueFrom(of(retryDatabase));

}

async function addNewRetryEntry(data: any) {
    // const responseData = data as SyncEntityWorkerResponse;

    // switch (responseData.status) {
    //     case SynchronizationSyncStatus.ECONNABORTED:
    //         /**
    //          * HERE we go into 'retry' logic:
    //          * - first we need to wait until data on BE is finished -> that means that we will have to request info about transaction/request to BE
    //          * - maybe our network connection is still down and therefore we will have to retry later
    //          */
    //         console_log_with_style('ECONNABORTED status from ENTITIY-SYNC-WORKER', CONSOLE_STYLE.white_and_black!, responseData);
    //         break;
    //     case SynchronizationSyncStatus.PARTIAL:
    //         /**
    //          * Naredimo logiko za partial... sklepam, da bi moral dobiti vse 'neshranjene' podatke v `data` polju
    //          */
    //         {
    //             console_log_with_style('What is going on ', CONSOLE_STYLE.white_and_black!, responseData.data);

    //         }
    //         break;
    //     default:
    //         break;
    // }

    // console_log_with_style(`before checking TEMP database`, CONSOLE_STYLE.black_and_white!, '');
    console_log_with_style('add new retry entry in retry manager worker', CONSOLE_STYLE.promise_error!, data, 2);
    {

        const receivedData = data as RetryManagementWorkerData;

        // const database = receivedData.retryDbInstance; // database == sync_retry
        let database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await database.finishSetup();

        // First check if object_name exists in the retry process/DB if not, then this is first occurence;
        console_log_with_style(`THIS IS RETRY MANAGEMENT worker - show object name: ${receivedData.objectName}`, CONSOLE_STYLE.red_and_black!, receivedData, 2);
        const collectionExists = database.tables.find((table: Table) => table.name == CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + receivedData.objectName);

        // if (collectionExists) {
        //     // we are in repeat of retry
        //     console_log_with_style(`THIS IS RETRY MANAGEMENT worker - already created item`, CONSOLE_STYLE.red_and_black!, receivedData);
        //     await database.table(CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + receivedData.objectName).add(
        //         {
        //             requestUuid: receivedData.requestUuid,
        //             status: 'in-progress',
        //             retries: 0,
        //             createdDatetime: new Date(),
        //         }
        //     );
        //     // database.version(database.verno+1).stores(
        //     //     {
        //     //         TestMe: ''
        //     //     }
        //     // );
        // } else {
        //     // we are first time visiting
        //     // soo create object store/collection for this object

        //     console_log_with_style(`THIS IS RETRY MANAGEMENT worker - first time visiting`, CONSOLE_STYLE.red_and_black!, receivedData);
        //     // database = await AppDB.changeSchema(database, {[CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+'fourLeaftClover']:''}); // &requestUuid,status,retries
        //     database = await AppDB.changeSchema(database, { [CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + receivedData.objectName]: '&requestUuid,status,retries,createdDatetime' });
        // }

        if (!collectionExists) {
            database = await AppDB.changeSchema(database, { [CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + receivedData.objectName]: '&requestUuid,status,retries,createdDatetime' });
        }
        console_log_with_style('RetryManagerWorker, should add data to database', CONSOLE_STYLE.magenta_and_white, null, 2);
        await database.table(CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + receivedData.objectName).add(
            {
                requestUuid: receivedData.requestUuid,
                status: 'in-progress',
                retries: 0,
                createdDatetime: new Date(),
            }
        );
















        /**
         * Neglede na vse, pa je potrebno preveriti tudi ali je prislo vmes do 'TEMP' shranjevanja
         * 
         * Logika:
         * 1. Dobi tabelo za isto entiteto, kot smo jo poslali na sync workerju , za `sync_temp` bazo
         * 2. mapiraj key na record
         * 3. mapiraj recorde v ustrezno strukturo
         * 4. izvedi proces 'merganja' ?
         */

        // const sooBillClinton = await this.dbSyncTemp?.tables.find((table) => {
        //     console_log_with_style(`${this.DEBUG_CONSOLE_CLASS_PREFIX} This is tableName at filtering TEMP:   ${table.name} `, CONSOLE_STYLE.black_and_white!, '');
        //     return CONFIGURATION_CONSTANTS.SYNC_TEMP_DB_PREFIX_STRING + workerData.objectName == table.name
        // });
        // if (sooBillClinton) {
        //     const dbTempData = await this.dbSyncTemp?.table(CONFIGURATION_CONSTANTS.SYNC_TEMP_DB_PREFIX_STRING + workerData.objectName).toArray();
        //     console_log_with_style(` - temp data: `, CONSOLE_STYLE.black_and_white!, dbTempData);

        //     {
        //         /**
        //          * Temp podatki, morajo imeti enako strukturo kot imamo podatke v Sync bazi.
        //          * Razlika je le to, da ko se sprasujemo v kaksnem stanju so TEMP podatki , si moramo odgovoriti,
        //          * da podatki cakajo na to, da se bo poslalo na BE.
        //          * 
        //          * Problem:
        //          * - ne vemo, ali je vmes med temp shranejvanjem in trenutnim casom prislo do sprememb na BE.
        //          *  - zato moramo v tem scenariju, ponovno preveriti podatek iz BE. 
        //          *      + odkril sem se eno posebnost --> PARTIAL SUCCESS je v trenutni kodi mogoc!!! Ker lahko pride do primera,
        //          *      ko zelimo posyncati podatke, ki niso bili `mergani` z zadnjimi podatki na BE.
        //          */

        //     }
        // } else {
        //     console_log_with_style(`${this.DEBUG_CONSOLE_CLASS_PREFIX} - there is no BillClinton`, CONSOLE_STYLE.black_and_white!, '');
        // }


    }
}