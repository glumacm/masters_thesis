import * as Comlink from 'comlink';
import { CONFIGURATION_CONSTANTS, OBJECT_NAME_TO_PATH_MAPPER } from '../../configuration';
import { AppDB } from '../../services/db';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import { Table } from 'dexie';
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../../interfaces/sync-storage.interfaces';
import { findPendingRetryEntries, findPendingRetryItemByRequestUuid } from '../../utilities/storage-utilities';
import { requestStatusCheck } from '../../services/network-calls';
import { plainToInstance } from 'class-transformer';
import { SyncRequestStatusResponse } from '../../models/sync/sync-request-status-response.model';
import { SyncRequestStatusRequest } from '../../models/sync/sync-request-status-request.model';
import { SyncLibraryNotification } from '../../models/event/sync-library-notification.model';
import { SyncLibraryNotificationEnum } from '../../enums/event/sync-library-notification-type.enum';
import { pathToSimpleNameMapper } from '../../utilities/config-utilities';
import { SyncRequestStatusEnum } from '../../enums/sync/sync-request-status.enum';
import { SyncLibAutoMerge } from '../../services/automerge-service';
import { StopwatchService } from '../../services/stopwatch-service';

export class RetryManagement {
    private debug_prefix = 'RetryManagement'

    private syncDB: AppDB | undefined;
    private tempDB: AppDB | undefined;
    private evaluationInterval: any;
    private consoleOutput: CustomConsoleOutput;
    private sendNewEventNotification: any;
    private syncLibAutoMerge: SyncLibAutoMerge;

    private isEvaluationRunning: boolean = false;

    public isReady: boolean = false;


    constructor(
        public externalDependencies: any | Comlink.ProxyOrClone<any>,
    ) {
        this.consoleOutput = new CustomConsoleOutput('RetryManagement', CONSOLE_STYLE.sync_lib_retry_management);
        this.consoleOutput.closeGroup()
        this.syncLibAutoMerge = new SyncLibAutoMerge();
        this.setDependencies(externalDependencies);
        // this.finishInit();

    }

    public async setDependencies(dependencies: any | Comlink.ProxyOrClone<any>) {
        /**
         * We expect that in `sendNewEventNotification function we send event of type: SyncLibraryNotification
         */

        // Dependencies are proxy function that reference the data that we set via constructor
        // If we want to get the dependency, we need to add `await` otherwise logic is bypassed
        this.sendNewEventNotification = dependencies.sendNewEventNotification;

    }

    public initiateEvaluationInterval(interval: number) {
        // this.consoleOutput.output(`this is number: ${interval} `);
        if (this.evaluationInterval) {
            clearInterval(this.evaluationInterval);
        }
        this.evaluationInterval = setInterval(
            this.evaluationIntervalCalback.bind(this),
            interval,
        );
    }

    async evaluationIntervalCalback() {
        clearInterval(this.evaluationInterval); // TODO: Remove this in the end since this will cause interval to execute only once
        // Because I am concerned that the interval would start before previous would finish. ChatGPT said that this could not happen, but that should not be used as a guarantee.
        // TODO: If some weird execution happens withing retry interval, maybe we should use `isEvaluationRunning`.
        if (this.isEvaluationRunning) {
            return;
        }
        const stopwatch = new StopwatchService(true);


        this.isEvaluationRunning = true;
        this.isEvaluationRunning = false;

        // 1. poisci ustrezne podatke iz shrambe
        const tables: Table[] | undefined = this.syncDB?.tables;
        stopwatch.createIntermediateTime();
        const mappedUuidsToEntities = await findPendingRetryEntries((await this.syncDB?.tables ?? []), (obj: SyncChamberRecordStructure) => obj.lastRequestUuid);
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
        stopwatch.stop();
        this.consoleOutput.output(`This is estimated time of retry proces: `, stopwatch.showTime());

    }

    async processSuccessRetryResponse(response: any) {
        const validResponse = response?.data;
        if (!validResponse) {
            await this.sendNewEventNotification(
                plainToInstance(SyncLibraryNotification, {
                    createdAt: new Date(),
                    type: SyncLibraryNotificationEnum.UNKNOWN_RETRY_ERROR,
                    message: 'Error occurred that was not anticipated (use-case: Retry)',
                })
            );
            return;
        }

        const responseData = plainToInstance(SyncRequestStatusResponse, response.data);

        const syncTable = await this.getSyncDB();
        const tempTable: AppDB = await this.getTempDB();
        const convertedEntityName = ((pathToSimpleNameMapper(OBJECT_NAME_TO_PATH_MAPPER) as any)[responseData.entityName]);

        if (!syncTable.tableExists(convertedEntityName)) {
            await this.sendNewEventNotification(
                plainToInstance(SyncLibraryNotification, {
                    createdAt: new Date(),
                    type: SyncLibraryNotificationEnum.ENTITY_TABLE_DOES_NOT_EXIST,
                    message: 'Schema does not exist for retry example - request should not have happened.',
                })
            );
            return;
        }

        /**
         * Big todo:
         * Add code that will receive notification when DB(chamber) is updated - hopefully no interferences will happen
         */
        for (let item of responseData.listOfRequestsStatuses) {
            const itemFromSync = await findPendingRetryItemByRequestUuid(syncTable, item.uuid, convertedEntityName)!;
            if (!itemFromSync) {
                await this.sendNewEventNotification(  // tako bomo vsaj zaznali napako v izpisu (ce smo naroceni na obvestila)
                    {
                        createdAt: new Date(),
                        type: SyncLibraryNotificationEnum.UNKNOWN_RETRY_ERROR,
                        message: `Cannot get sync item with lastRequestUuid: ${item.uuid} in entity: ${convertedEntityName}.`
                    } as SyncLibraryNotification
                );
                continue;
            }
            // WARING: We MUST first check if temporary table/schema exists for temporary data
            const tempEntry: SyncChamberRecordStructure | null = tempTable.tableExists(convertedEntityName) ? await tempTable.table(convertedEntityName).get(itemFromSync.localUUID) : null;

            if (item.status === SyncRequestStatusEnum.IN_PROGRESS) {
                await syncTable.table(convertedEntityName)
                    .filter((obj: SyncChamberRecordStructure) => obj.localUUID === itemFromSync.localUUID)
                    .modify(
                        (obj: SyncChamberRecordStructure) => { obj.retries = obj.retries ? obj.retries + 1 : 1 }
                    );
                await this.sendNewEventNotification(
                    plainToInstance(SyncLibraryNotification, {
                        createdAt: new Date(),
                        type: SyncLibraryNotificationEnum.SYNC_ITEM_STILL_IN_PROGRESS,
                        message: `Sync object z uuid: ${itemFromSync.localUUID} se vedno ni zakljucen na zalednem sistemu`,
                    })
                );
            } else {
                let status = ChamberSyncObjectStatus.pending_sync;

                const parametersForSyncedStatus = item.status === SyncRequestStatusEnum.FINISHED || item.status === SyncRequestStatusEnum.SUCCESS;
                if (parametersForSyncedStatus) {
                    status = ChamberSyncObjectStatus.synced;
                }

                await syncTable.table(convertedEntityName)
                    .filter((obj: SyncChamberRecordStructure) => obj.localUUID === itemFromSync.localUUID)
                    .modify(
                        (obj: SyncChamberRecordStructure) => this.unlockSyncEntryFromRetry(obj, tempEntry, status)
                    );
                if (tempEntry) {
                    await tempTable.table(convertedEntityName).delete(itemFromSync.localUUID);
                }
                await this.sendNewEventNotification(
                    plainToInstance(SyncLibraryNotification, {
                        createdAt: new Date(),
                        type: SyncLibraryNotificationEnum.RESOLVED_RETRY_ITEM,
                        message: `Process finished successfully for object: ${itemFromSync.localUUID}`,
                    })
                );
            }
        }
        return;

    }

    unlockSyncEntryFromRetry(syncItem: SyncChamberRecordStructure, tempEntry: SyncChamberRecordStructure | null | undefined, status: ChamberSyncObjectStatus) {
        syncItem.objectStatus = status;
        syncItem.lastRequestUuid = null;
        /**
         * // Because this are examples when we resolved retry ker to so primeri, ko smo se resili retryja 
         * 
         * IDEA for later: Maybe we could leave the values for specific statuses and based on values later check which statuses cause re-initialization of the same sync
         */
        syncItem.retries = 0;
        if (tempEntry) {
            syncItem.changes = tempEntry.changes;
            syncItem.lastModified = tempEntry.lastModified;
            syncItem.record = tempEntry.record;
            syncItem.objectStatus = ChamberSyncObjectStatus.pending_sync; // should immediatelly be recognised as pending_sync
        }
    }

    async processErrorRetryResponse(error: any) {
        /**
         * Currently leaving only notification because I do not thing that in case we get error on BE that this would be harmful on FE.
         * That's why we have notification so that we can recognize problem while using the package
         */
        await this.sendNewEventNotification(
            plainToInstance(
                SyncLibraryNotification,
                {
                    createdAt: new Date(),
                    error: JSON.stringify(error),
                    type: SyncLibraryNotificationEnum.UNKNOWN_RETRY_ERROR,
                    message: 'During rety process we recognised an error'
                }
            )
        );
    }

    public terminateThread() { }

    public closeReEvaluationInterval() {

    }

    public async finishInit() {
        await this.finishSyncDBSetup();
        await this.finishTempDBSetup();

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
    }

    async getTempDB(): Promise<AppDB> {
        if (!this.tempDB?.isOpen()) {
            // open database
            await this.finishTempDBSetup();
        }
        return this.tempDB!;
    }

    async finishTempDBSetup() {
        this.tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
        await this.tempDB.finishSetup();
    }


}

Comlink.expose(RetryManagement);