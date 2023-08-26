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
import { SyncLibAutoMerge } from '../../services/automerge-service';

export class RetryManagement {
    private debug_prefix = 'RetryManagement'

    private retryDB: AppDB | undefined;
    private syncingDB: AppDB | undefined;
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
        const tempTable: AppDB = await this.getTempDB();
        const convertedEntityName = ((pathToSimpleNameMapper(OBJECT_NAME_TO_PATH_MAPPER) as any)[responseData.entityName]);

        if (!syncTable.tableExists(convertedEntityName)) {
            await this.sendNewEventNotification(
                plainToInstance(SyncLibraryNotification, {
                    createdAt: new Date(),
                    type: SyncLibraryNotificationEnum.ENTITY_TABLE_DOES_NOT_EXIST,
                    message: 'Tabela ne obstaja za retry primer - zahteva se ne bi smela zgodit.',
                })
            );
            return;
        }
        
        /**
         * VELIK TODO 1:
         * Potrebno bo dodati kodo in upati, da bo delovalo brez tezkih problemov, ki bo omogocila, da
         * se podatkovna baza posodobi, ko dobi obvestilo, da je prislo do spremembe.
         */
        for (let item of responseData.listOfRequestsStatuses) {
            // OPOZORILO: Nujno moramo preveriti ali temp tabela obstaja preden preverimo za TEMP podatek
            const tempEntry: SyncChamberRecordStructure | null = tempTable.tableExists(convertedEntityName) ? await tempTable.table(convertedEntityName).get(item.uuid) : null;
            if (item.status === SyncRequestStatusEnum.FINISHED) {
                await syncTable.table(convertedEntityName)
                    .filter((obj: SyncChamberRecordStructure) => obj.localUUID === item.uuid)
                    .modify(
                        (obj: SyncChamberRecordStructure) => {
                            obj.objectStatus = ChamberSyncObjectStatus.synced;
                            obj.lastRequestUuid = null;
                            if (tempEntry) {
                                obj.changes = tempEntry.changes;
                                obj.lastModified = tempEntry.lastModified;
                                obj.record = tempEntry.record;
                            }
                        }
                    );
                if (tempEntry) {
                    await tempTable.table(convertedEntityName).delete(item.uuid);
                }
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
        // this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.finishSyncDBSetup();
        await this.finishTempDBSetup();

        await this.retryDB.finishSetup();
        await this.syncingDB.finishSetup();
        // await this.syncDB.finishSetup();
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
        // this.syncingDBChangeSubscription = this.syncingChangeSubscription(this.syncingDB);
    }


}

Comlink.expose(RetryManagement);