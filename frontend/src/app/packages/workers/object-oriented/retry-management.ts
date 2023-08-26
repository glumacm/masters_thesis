import * as Comlink from 'comlink';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, OBJECT_NAME_TO_PATH_MAPPER} from '../../configuration';
import { RetryWorkerResponseStatus, ServerRetryEntityStatus } from '../../enums/retry.enum';
import { RetryManagementWorkerData } from '../../interfaces/retry-sync.interfaces';
import { AppDB } from '../../services/db';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import { DeferredPromise } from '../../utilities/deferred';
import { RetryEntryI, SyncingEntryI, SyncingObjectStatus } from '../retry/utilities';
import { RetryWorker } from './retry.worker';
import { Table } from 'dexie';
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../../interfaces/sync-storage.interfaces';
import { findPendingRetryEntries } from '../../utilities/storage-utilities';
import { requestStatusCheck } from '../../services/network-calls';
import { plainToInstance } from 'class-transformer';
import { SyncRequestStatusResponse } from '../../models/sync/sync-request-status-response.model';
import { SyncRequestStatusRequest } from '../../models/sync/sync-request-status-request.model';
import { SyncLibraryNotification } from '../../models/event/sync-library-notification.model';
import { SyncLibraryNotificationEnum } from '../../enums/event/sync-library-notification-type.enum';
import { pathToSimpleNameMapper } from '../../utilities/config-utilities';
import { SyncRequestStatusEnum } from '../../enums/sync/sync-request-status.enum';

export class RetryManagement {
    private debug_prefix = 'RetryManagement'

    private retryDB: AppDB | undefined;
    private syncingDB: AppDB | undefined;
    private syncDB: AppDB | undefined;
    private evaluationInterval: any;
    private consoleOutput: CustomConsoleOutput;
    private sendNewEventNotification: any;

    private isEvaluationRunning: boolean = false;

    public isReady: boolean = false;


    constructor(
        public externalDependencies: any | Comlink.ProxyOrClone<any>,
    ) {
        this.consoleOutput = new CustomConsoleOutput('RetryManagement', CONSOLE_STYLE.sync_lib_retry_management);
        this.consoleOutput.closeGroup()
        this.setDependencies(externalDependencies);
        // this.finishInit();

    }

    public async setDependencies(dependencies: any | Comlink.ProxyOrClone<any>) {
        /**
         * Pricakujemo, da bomo v sendNewEventNotification funkcijo poslali event tipa: SyncLibraryNotification
         */

        // Dependency-ji so Proxy funkcije, ki kazejo na podatek, ki ga dodajam v konstruktor
        // ce hocem dobiti pravi podatek ven, moram uporabiti `await` ker drugace se podatek ne pridobi
        this.sendNewEventNotification = dependencies.sendNewEventNotification;

    }

    public initiateEvaluationInterval(interval: number) {
        this.consoleOutput.output(`this is number: ${interval} `);
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
        this.isEvaluationRunning = false;

        // 1. poisci ustrezne podatke iz shrambe
        const tables: Table[] | undefined = this.syncDB?.tables;
        const mappedUuidsToEntities = await findPendingRetryEntries((await this.syncDB?.tables ?? []), (obj: SyncChamberRecordStructure) => obj.localUUID);
        for (let property of Object.keys(mappedUuidsToEntities)) {
            // 1.a ignore empty list entries
            // 1.b send each entity uuids to BE -> need to fix BE to allow receiving UUIDs instead of single UUId 
            if (mappedUuidsToEntities[property] && mappedUuidsToEntities[property].length > 0) {
                // We process only entities with any uuids
                const listOfUuids = mappedUuidsToEntities[property]
                // entity name must be mapped/converted from simple name to FULL BE PATH!
                await requestStatusCheck(
                    ((OBJECT_NAME_TO_PATH_MAPPER as any)[property] ?? property),
                    plainToInstance(
                        SyncRequestStatusRequest,
                        { createdAt: new Date(), listOfUuids, entityName: ((OBJECT_NAME_TO_PATH_MAPPER as any)[property] ?? property) }
                    )
                ).then(
                    this.processSuccessRetryResponse.bind(this),
                    this.processErrorRetryResponse.bind(this)
                );
            }

        }

    }

    async processSuccessRetryResponse(response: any) {
        const validResponse = response?.data;
        if (!validResponse) {
            await this.sendNewEventNotification(
                plainToInstance(SyncLibraryNotification, {
                    createdAt: new Date(),
                    type: SyncLibraryNotificationEnum.UNKNOWN_RETRY_ERROR,
                    message: 'Prislo je do napake, ki je nisem pricakoval (use-case: Retry)',
                })
            );
            return;
        }

        const responseData = plainToInstance(SyncRequestStatusResponse, response.data);

        const itemsExist = responseData?.listOfRequestsStatuses?.length > 0;
        const syncTable = await this.getSyncDB();
        for (let item of responseData.listOfRequestsStatuses) {
            const convertedEntityName = ((pathToSimpleNameMapper(OBJECT_NAME_TO_PATH_MAPPER) as any)[responseData.entityName]);
            const talkToMe = await syncTable.table(convertedEntityName).get(item.uuid);
            if (item.status === SyncRequestStatusEnum.FINISHED) {
                /**
                 * VELIK TODO:
                 * Potrebno je narediti tudi logiko, da preveri ali obstaja vmes tudi podatek v TEMP,
                 * v tem primeru je potrebno prvo narediti merge med TEMP in sync shrambo
                 * in na koncu sele popraviti vrednost objekta in status nastaviti na `pending_sync`
                 */
                await syncTable.table(convertedEntityName)
                    .filter((obj: SyncChamberRecordStructure) => obj.localUUID === item.uuid)
                    .modify(
                        (obj: SyncChamberRecordStructure) => {
                            obj.objectStatus = ChamberSyncObjectStatus.synced;
                            obj.lastRequestUuid = null;
                        }
                    );
                await this.sendNewEventNotification(
                    plainToInstance(SyncLibraryNotification, {
                        createdAt: new Date(),
                        type: SyncLibraryNotificationEnum.RESOLVED_RETRY_ITEM,
                        message: `Uspesno smo prepoznali zakljucen proces za objekt: ${item.uuid}`,
                    })
                );
            }
        }
        return;

    }

    async processErrorRetryResponse(error: any) {
        // TODO: Implementacija za error use-case
        this.consoleOutput.output(`#processErrorRetryResponse  : `, error)
    }

    async evaluationIntervalCalback_deprecated() {
        // this.consoleOutput.output(`We are in RETRY MANAGEMENT INTERVAL callback`);
        // return;
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
        this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.retryDB.finishSetup();
        await this.syncingDB.finishSetup();
        await this.syncDB.finishSetup();
        this.isReady = true;
    }

    async getSyncDB(): Promise<AppDB> {
        if (!this.syncDB?.isOpen()) {
            // open database
            await this.finishSyncDBSetup();
        }
        return this.syncDB!;
    }

    async finishSyncDBSetup() {
        this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.syncDB.finishSetup();
        // this.syncingDBChangeSubscription = this.syncingChangeSubscription(this.syncingDB);
    }


}

Comlink.expose(RetryManagement);