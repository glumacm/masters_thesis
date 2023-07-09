import * as Comlink from 'comlink';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, RETRY_DEFAULT_CONFIGURATION, RETRY_TABLES_CONFIGURATION } from '../../configuration';
import { RetryWorkerResponseStatus, ServerRetryEntityStatus } from '../../enums/retry.enum';
import { RetryManagementWorkerData } from '../../interfaces/retry-sync.interfaces';
import { AppDB } from '../../services/db';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import { DeferredPromise } from '../../utilities/deferred';
import { RetryEntryI, SyncingEntryI, SyncingObjectStatus } from '../retry/utilities';
import { RetryWorker } from './retry.worker';

export class RetryManagement {
    private debug_prefix = 'RetryManagement'

    private retryDB: AppDB | undefined;
    private syncingDB: AppDB | undefined;
    private evaluationInterval: any;
    private consoleOutput: CustomConsoleOutput;

    private isEvaluationRunning: boolean = false;

    public isReady: boolean = false;


    constructor() {
        this.consoleOutput = new CustomConsoleOutput('RetryManagement', CONSOLE_STYLE.sync_lib_retry_management);
        // this.finishInit();

    }

    public initiateEvaluationInterval(interval: number) {

        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
        }
        this.evaluationInterval = setInterval(
            this.evaluationIntervalCalback.bind(this),
            interval,
        );
    }

    async evaluationIntervalCalback() {
        clearInterval(this.evaluationInterval);
        if (this.isEvaluationRunning) {
            return;
        }

        this.isEvaluationRunning = true;
        try {
            this.consoleOutput.output(`Retry management interval is executing`);
            // first check if we have any entries in retry database
            const retriesMapper: any = {};
            const retriesMapperRefactored: any = {};
            const retryEvaluationPromise = new DeferredPromise();
            await new Promise<void>(async (resolve) => {
                try {
                    this.consoleOutput.output(`I get insecure`);
                    for await (let table of this.syncingDB!.tables) {
                        // @exaplanation -> if entry exists in syncingDB , then for sure one of two things is correct (either sync started, either retry is pending!)!
                        // Predhodnje sem imel samo preverjanje statusa ali je == `pending_retry`. Ker pa menim, da se lahko zatakne tudi pri statusu `in_sync` bom dodal tudi ta pogoj
                        // const itemsForRetry = await table.filter((syncingItem) => syncingItem.status == 'pending_retry').toArray();
                        const itemsForRetry = await table.filter((syncingItem: SyncingEntryI) => (syncingItem.status == SyncingObjectStatus.pending_retry || syncingItem.status == SyncingObjectStatus.in_sync)).toArray();
                        this.consoleOutput.output(`How many (table: ${table.name}) : `, itemsForRetry)
                        if (itemsForRetry.length > 0) {
                            retriesMapperRefactored[table.name] = itemsForRetry;
                            // Here we need to trigger thread for sending data to BE
                            // Here I prepose to handle DB manipulation in this thread and not in RetryWorker thread -> because otherwise we could get some ???conflicts within DB instances???.
                            {
                                const retryWorker = new Worker(new URL('./retry.worker', import.meta.url)); // we need this in seperate variable to be able to terminate it
                                const RetryWorkerClass = Comlink.wrap<typeof RetryWorker>(retryWorker);
                                const retryThread = await new RetryWorkerClass();
                                retryThread.finishDbSetup();
                                this.consoleOutput.closeGroup();
                                
                                // do logic for re-evaluating request status on BE
                                const retryResponse = await retryThread.startRefactoredRetryProcess(itemsForRetry, table.name);
                                this.consoleOutput.output(`Dont leave me tongue tied  :  `, retryResponse);
                                
                                // before terminating thread close DB
                                retryThread.closeDb();
                                retryWorker.terminate();

                            }
                        }
                    }
                    // for await (let table of this.retryDB!.tables) { // [].forEach(()=>{}) -> does not allow await inside -> it will bypass it and immediately switch to another iteration
                    //     retriesMapper[table.name] = RETRY_TABLES_CONFIGURATION[table.name] ? RETRY_TABLES_CONFIGURATION[table.name] : RETRY_DEFAULT_CONFIGURATION;
                    //     const foundRetryEntries = await table.filter((retryItem: RetryEntryI) => retryItem.retries < retriesMapper[table.name]).toArray();
                    //     this.consoleOutput.output(`no matter what they say`);
                    //     if (foundRetryEntries.length > 0) {
                    //         const retryWorker = new Worker(new URL('./retry.worker', import.meta.url)); // we need this in seperate variable to be able to terminate it
                    //         const RetryWorkerClass = Comlink.wrap<typeof RetryWorker>(retryWorker);
                    //         const retryThread = await new RetryWorkerClass();
                    //         this.consoleOutput.closeGroup();
                            
                    //         // do logic for re-evaluating request status on BE
                    //         const retryResponse = await retryThread.startRetryProcess(foundRetryEntries, table.name);
                    //         this.consoleOutput.output(`What is retryresponse  `, retryResponse);
                    //         if (retryResponse.status == RetryWorkerResponseStatus.SUCCESS) {
                    //             // if (retryResponse.data?.status == ServerRetryEntityStatus.canceled || retryResponse.data?.status == ServerRetryEntityStatus.finished || retryResponse.data?.status == ServerRetryEntityStatus.stopped) {

                    //             // }
                    //         } else {
                    //             // error scenario
                    //         }
                    //         this.consoleOutput.output(` - after retry worker response: - `, retryResponse);

                    //         // retryWorker.terminate();
                    //         retriesMapper[table.name] = foundRetryEntries;
                    //     }
                    //     this.consoleOutput.output(`We want the world and we want it ${table.name}`, foundRetryEntries.length);
                    
                    // }
                    this.consoleOutput.output(`After forloop ends`);
                } finally {
                    resolve();
                }
            });

        } catch (e) {
            this.consoleOutput.output(`Some error occured in evaluationIntervalCallback`, e);
        } finally {
            this.consoleOutput.output(`this is incorrect`);
            this.isEvaluationRunning = false; // Uncomment this after process is correctly implemented because without this interval will not proceed with promise logic
            // clearInterval(this.evaluationInterval);
        }

    }

    async addNewEntry(objectName: string, data: any) {
        // Add item to retry database in collection: <objectName>
        if (this.retryDB?.tables.find((table) => CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + objectName == table.name)) {
            await this.retryDB?.table(CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING + objectName).add(data);
            console_log_with_style(`${this.debug_prefix} - Added data to retryDB in collection: ${objectName}`, CONSOLE_STYLE.magenta_and_white, data, 3);
        }

    }

    public terminateThread() { }

    public closeReEvaluationInterval() {

    }

    public async finishInit() {
        this.retryDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await this.retryDB.finishSetup();
        await this.syncingDB.finishSetup();
        this.isReady = true;
    }


}

Comlink.expose(RetryManagement);