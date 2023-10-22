/**
 * Starting point for Synchronization library
 */

import { Observable, Subject, Subscription, filter, tap } from "rxjs";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, DATABASE_TABLES_SCHEMA_MAPPER, DEFAULT_MERCURE_SYNC_POLICY } from "./configuration";
import { NetworkStatusEnum } from "./interfaces/network-status.interfaces";
import { AppDB } from "./services/db";
import { NetworkStatus } from "./services/network-status";
import { CONSOLE_STYLE, CustomConsoleOutput } from "./utilities/console-style";
import * as Comlink from 'comlink';
import { RetryManagement } from "./workers/object-oriented/retry-management";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from "./interfaces/sync-storage.interfaces";
import { sync_entity_records_batch, ExampleClassForComlinkProxy } from "./services/network-calls";
import { SentryClient } from "./services/monitor";
// import { AutoMergeWrapper } from "./services/automerge-wrapper";
import { ConflictService } from "./services/conflict-service";
import { SyncLibraryNotification } from "./models/event/sync-library-notification.model";
import { plainToInstance } from "class-transformer";
import { SyncLibraryNotificationEnum } from "./enums/event/sync-library-notification-type.enum";
import { cloneDeep } from "lodash";
import { SyncLibAutoMerge } from "./services/automerge-service";
import { SyncEntityClean } from "./workers/object-oriented/sync-entity-clean.worker";
import { SyncConflictItem } from "./models/sync/sync-conflict-item.model";
import { SyncConflictSchema } from "./models/sync/sync-conflict-schema.model";
import { CustomAxiosMockedResponseEnum } from "./services/custom-axios";
import { AxiosResponse } from "axios";
import { EventSourcePolicyEnum } from "./enums/sync/event-source-policy-enum";
import { v4 as uuidv4 } from 'uuid';
import { SyncConfigurationI } from "./interfaces/sync-configuration.interfaces";
import { StoreNewObjectResult, setInSyncObjectsToPendingSync, storeNewObject } from "./utilities/storage-utilities";
import { SynchronizationLibraryBase } from "./sync-lib-base";
import { DataSizeService } from "./services/data-size-service";

export class SynchronizationLibrary extends SynchronizationLibraryBase {

    public static existingInstance: SynchronizationLibrary | undefined;

    private networkStatusInstance: NetworkStatus;
    private networkStatus$: Observable<NetworkStatusEnum>;
    // Edini nacin da bom lahko imel dostop do iste instance baze je, da posredujem podatke od tukaj v workerje.
    // Ampak nisem se siguren ali bo to potrebno.
    private dbSyncTemp: AppDB | undefined;
    private dbSync: AppDB | undefined; // SYNC_DB should be from now on referenced as CURRENT DB
    private dbSyncConflict: AppDB | undefined;

    // Agent ID
    public agentId: string;


    // external services
    private sentryClient: SentryClient;
    // private autoMergeWrapper: AutoMergeWrapper | undefined;
    private syncLibAutoMerge: SyncLibAutoMerge;
    private conflictService: ConflictService;

    private readonly DEBUG_CONSOLE_CLASS_PREFIX = 'SynchronizationLibrary';

    public SyncEntityClass: Comlink.Remote<SyncEntityClean> | any;
    public retryManager: Worker | null = null;
    public entitySyncWorker: Worker | null = null;
    public retryMangementInstance: Comlink.Remote<RetryManagement> | undefined;
    public syncEntityInstance: Comlink.Remote<SyncEntityClean> | undefined;

    private syncDBChangeSubscription: Subscription | undefined;
    private conflictDBChangeSubscription: Subscription | undefined;
    private consoleOutput: CustomConsoleOutput;
    private mockRequests: boolean = false;
    private manualNetworkInit: boolean;

    constructor(
        startFinishSetupInConstructor: boolean = false,
        mockRequests: boolean = false,
        eventSourcePolicy: EventSourcePolicyEnum = DEFAULT_MERCURE_SYNC_POLICY,
        existingAgentId: string | undefined = undefined,
        manualNetworkInit: boolean = false,
    ) {
        super();
        this.consoleOutput = new CustomConsoleOutput('SynchronizationLibraryMAIN', CONSOLE_STYLE.sync_lib_retry_management);
        this.consoleOutput.closeGroup();
        this.consoleOutput.output(`SynchronizationLibrary constructor called`);

        this.agentId = existingAgentId ? existingAgentId : uuidv4();
        this.manualNetworkInit = manualNetworkInit;
        this.networkStatusInstance = NetworkStatus.getInstance(manualNetworkInit);
        if (!manualNetworkInit && NetworkStatus.getStatus()) {
            window.dispatchEvent(new Event('online'));
        }
        this.consoleOutput.output(this.agentId);

        SynchronizationLibrary.initialiseEventEmitter();

        this.networkStatus$ = this.networkStatusInstance.getNetworkChange();

        this.sentryClient = new SentryClient();
        this.syncLibAutoMerge = new SyncLibAutoMerge();
        this.conflictService = new ConflictService();

        this.entitySyncWorker = new Worker(new URL('./workers/object-oriented/sync-entity-clean.worker', import.meta.url));
        this.SyncEntityClass = Comlink.wrap<typeof SyncEntityClean>(this.entitySyncWorker);
        this.mockRequests = mockRequests;

        // Preveri ali bi po novem bilo potrebno ta klic zakomentirati, ker se lahko drugje klice.
        if (!SynchronizationLibrary.existingInstance) {
            if (startFinishSetupInConstructor)
                this.finishSetup();
            SynchronizationLibrary.existingInstance = this;
        }
        else {
            this.syncDBChangeSubscription = SynchronizationLibrary.existingInstance.syncDBChangeSubscription;
            this.conflictDBChangeSubscription = SynchronizationLibrary.existingInstance.conflictDBChangeSubscription;

            this.networkStatusInstance = SynchronizationLibrary.existingInstance.networkStatusInstance;
            this.networkStatus$ = SynchronizationLibrary.existingInstance.networkStatus$;
            // Edini nacin da bom lahko imel dostop do iste instance baze je, da posredujem podatke od tukaj v workerje.
            // Ampak nisem se siguren ali bo to potrebno.
            this.dbSyncTemp = SynchronizationLibrary.existingInstance.dbSyncTemp;
            this.dbSync = SynchronizationLibrary.existingInstance.dbSync;
            this.dbSyncConflict = SynchronizationLibrary.existingInstance.dbSyncConflict;

            // external services
            this.sentryClient = SynchronizationLibrary.existingInstance.sentryClient;
            // this.autoMergeWrapper = SynchronizationLibrary.existingInstance.autoMergeWrapper;

            this.SyncEntityClass = SynchronizationLibrary.existingInstance.SyncEntityClass;
            this.retryManager = SynchronizationLibrary.existingInstance.retryManager;
            this.entitySyncWorker = SynchronizationLibrary.existingInstance.entitySyncWorker;
            // this.retryMangementInstance = SynchronizationLibrary.existingInstance.retryMangementInstance;
            this.syncEntityInstance = SynchronizationLibrary.existingInstance.syncEntityInstance;

        }

    }

    public static initialiseEventEmitter(): void {
        if (!SynchronizationLibrary.eventsSubject) {
            SynchronizationLibrary.eventsSubject = new Subject<SyncLibraryNotification>();
        }
    }

    public async finishSetup() {

        /**************  DATABASE ************/
        this.dbSyncTemp = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        this.dbSync = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        this.dbSyncConflict = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);

        const dbTempExists = await AppDB.exists(this.dbSyncTemp.name);
        const dbSyncExists = await AppDB.exists(this.dbSync.name);
        const dbSyncConflictExists = await AppDB.exists(this.dbSyncConflict.name);

        if (!dbSyncExists) {
            this.dbSync = (await AppDB.changeSchema(this.dbSync!, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]));
            this.dbSync.close();
        }

        if (!dbSyncConflictExists) {
            this.dbSyncConflict = (await AppDB.changeSchema(this.dbSyncConflict, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME]));
            this.dbSyncConflict.close();
        }

        if (!dbTempExists) {
            this.dbSyncTemp = (await AppDB.changeSchema(this.dbSyncTemp!, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME]));
            this.dbSyncTemp.close();
        }

        await this.dbSync.open();
        await this.dbSyncTemp.open();
        await this.dbSyncConflict.open();

        // ponastavitev podatkov in_sync objektov na pending_retry
        await setInSyncObjectsToPendingSync(await this.getSyncDB());

        // Now let's open thread for retry manager
        // convert both to Comlink style!!

        const RetryManagementClass = Comlink.wrap<typeof RetryManagement>(new Worker(new URL('./workers/object-oriented/retry-management', import.meta.url)));
        this.retryMangementInstance = await new RetryManagementClass(
            Comlink.proxy({
                sendNewEventNotification: this.sendNewEventNotification,
            }),
        );
        await this.retryMangementInstance.finishInit()
        const miliseconds = 1000;
        const timeInSeconds = 25;
        const timeInMinutes = 0
        const sum = (miliseconds * 60 * timeInMinutes) + (miliseconds * timeInSeconds);
        if (CONFIGURATION_CONSTANTS.ALLOW_RETRY_PROCESS) {
            await this.retryMangementInstance.initiateEvaluationInterval(1120);
        }
        // await this.retryMangementInstance.initiateEvaluationInterval(600);

        // this.retryMangementInstance.addNewEntry('object_name128', {requestUuid:'haha3', status: 'in-progress', retries: 100, createdDatetime: new Date() });

        /**
         * Below code was refactored so that we could potentially have appropriate unit-tests. But this failed so much that I cannot express 
         * the level of fail that this eventually caused.
         */
        try {
            console.log('Before initialisation of syncEntityInstance88');
            const syncConfiguration: SyncConfigurationI = {
                agentId: this.agentId
            }

            this.syncEntityInstance = await new this.SyncEntityClass(
                Comlink.proxy({
                    dependency1: new ExampleClassForComlinkProxy(),
                    sync_entity_records_batch: sync_entity_records_batch,
                    sentryCaptureMessage: this.sentryClient.captureMessage,
                    // autoMergeWrapperGetDataFromEncodedRecord: getDataFromEncodedRecord,
                    sendNewEventNotification: this.sendNewEventNotification,
                    notifyMainAboutDBChange: this.notifyMainAboutDBChange,
                    configuration: syncConfiguration,
                    currentNetworkStatus: navigator.onLine,

                }),
                this.mockRequests,
                undefined,
                this.agentId,
            );

            this.networkStatus$.subscribe(
                {
                    next: (networkChangeStatus) => {
                        this.consoleOutput.output(`NETWORK STATUS`, networkChangeStatus);
                        this.syncEntityInstance?.changeNetworkStatus(networkChangeStatus);
                    }
                }
            );

            await this.syncEntityInstance!.initDatabases();
            SynchronizationLibrary.eventsSubject.pipe(
                tap((event: SyncLibraryNotification) => {
                    this.consoleOutput.output(`LIBRARY EVENT   : `, event);
                }),
                filter(event => event.type === SyncLibraryNotificationEnum.DATABASE_CHANGE)).subscribe(
                    {
                        next: async (value) => {
                            // await this.notifyMainAboutDBChange(value.data.dbName, value.data.version);
                            await this.notifyMainAboutDBChange(value.data.dbName, 0);
                        }
                    }
                );
        } catch (exception) {
            this.consoleOutput.output(`Error in finishSetup()  `, exception);
            throw new Error('Some error occured')
        }
    }

    public setMockedResponse(type: CustomAxiosMockedResponseEnum, data: AxiosResponse<any, any>) {
        this.syncEntityInstance?.setMockedResponse(type, data);
    }

    public async startBatchSync(delay_to_wait: number = 0, useSyncLibAutoMerge: boolean = true): Promise<void> {
        /**
         * Jaz bi rekel, da ta funkcija mora samo ZACETI proces.. v threadu je potrebno potem pripraviti glavne dele logiko:
         * - pridobiti vse podatke iz vsake entitete, kjer imamo status == pending_sync
         * - zloziti vse ustrezne objekte k pripadajoci entiteti
         * - za vsako entito posebej izvesti klic na BE
         * - POTEM nadaljujemo z ostalo TODO logiko, ko implementiram zgornjo zadevo (prvi todo bo sigurno posiljanje podatkov iz FE na BE)
         * 
         * 
         * IDEJA: kaj pa ce bi po tem, ko poiscem vsak podatek iz baze (pending_sync), to poslal v funkcijo `startObjectEntitySyncProcessRefactored`.
         * To bi rekel, da je prva implementacija, ki bo "POZRESNA", saj ne bom posiljal batcha, ampak bom samo imel batch podatke pripravljene.
         * To bom samo implementiral in ne bom testiral, ker bom potem ko enkrat dobim MAP med entitetami in pripadajocimi podatki, lahko to enostavno preklopil
         * med POZERESNIM batchom in PRAVIM batchom (za entiteto).
         * 
         */
        // TO MORA BITI SAMO ZA SIMULACIJO !!! V nasprotnem primeru je potrebno to imeti brez awaita!!!! 
        // Ker drugace bi pomenilo, da bo thread blokiral glavni thread!!!!!!!
        // ODSTRANI IN DODAJ DRUGO FUNKCIJO, KI BO SAMO ZA SIMULACIJO!!!
        await this.syncEntityInstance?.startBatchSync(); // TODO: Na koncuj se mora vreci ven AWAIT!!!!
        return;

    }

    /**
     * Predpostavljam, da bi to funkcijo uporabil s pomocjo Proxy-ja, da bi lahko v `thread-u` poslal specificen event
     * @param event: SyncLibraryNotification
     */
    public sendNewEventNotification(event: SyncLibraryNotification): void {
        SynchronizationLibrary.eventsSubject.next(event);
    }

    /**
     * 
     * @param dbName 
     * @param version db.version / 10
     */
    public async notifyMainAboutDBChange(dbName: string, version: number): Promise<void> {
        switch (dbName) {
            case 'conflict':
                this.dbSyncConflict?.close();
                this.dbSyncConflict = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
                await this.dbSyncConflict.finishSetup();
                break;
        }
    }


    /**
     * @example
     * storeNewObject('example_table', docUuid, {<objectWithLatestChanges>});
     * @remarks
     * Razmisljam, da bi namesto automerge.toJS(theDoc2) poslal kar theDoc2. Razmisliti je potrebno le o tem, ali bo to vplivalo na iskanje razlik.
     * Ideja: Samo v bazi bodo podatki dokumenta shranjeni kot Uint8Array. Ampak vsakic ko bi poiskal podatek bi ze pred vrnitvijo pretvoril dokument v user-friendly obliko.
     * @param entityName 
     * @param objectUuid 
     * @param objectData Object data (NOT automerge.doc) !!!
     * @returns 
     */
    async storeNewObject(entityName: string, objectUuid: string, objectData: any): Promise<SyncChamberRecordStructure | null | undefined> {
        let syncDB = await this.getSyncDB();
        let tempDB = await this.getTempDB();
        let conflictDB = await this.getConflictDB();

        const storedObjectResult: StoreNewObjectResult = await storeNewObject(
            entityName,
            objectUuid,
            objectData,
            this.syncLibAutoMerge,
            this.conflictService,
            conflictDB,
            syncDB,
            tempDB,
            this.consoleOutput,
            SynchronizationLibrary,
        );
        this.dbSync = storedObjectResult.syncDB;
        this.dbSyncTemp = storedObjectResult.tempDB;
        this.dbSyncConflict = storedObjectResult.conflictDB;

        /**
         * Kratek opis:
         * Funkcija mora na podlagi podanega objekta in UUID-ja, popraviti objekt v bazi glede na UUID.
         * 
         * Dolg opis:
         * 1. Ce tabela, ki jo navedemo v `entityName` ne obstaja v `sync` tabeli, jo na novo definiramo.
         * 2. Dodaj spremembe novega objekta v obstojeci objekt (ce ta obstaja v bazi).
         * 3. Iz zdruzenega objekta, pridobi zadnje spremembe in jih dodaj v CHANGES
         */

        return storedObjectResult.resultData;
    }

    public async calculateSyncObjectSizeCounts(calculationBytesDivider: number = DataSizeService.BYTES_DIVIDER): Promise<{totalObjectsSizeCount: number, totalSyncObjectsSizeCount: number, totalSyncSuccessObjectsSizeCount: number, totalRetryObjectsSizeCount: number}> {
        const syncThreadCounts = await this.syncEntityInstance!.syncObjectSizeCounts(calculationBytesDivider);
        return {
            totalObjectsSizeCount: syncThreadCounts.syncObjectsCount + syncThreadCounts.syncSuccessObjectsCount, // TODO: + dodati bo potrebno retry count
            totalSyncObjectsSizeCount: syncThreadCounts.syncObjectsCount,
            totalSyncSuccessObjectsSizeCount: syncThreadCounts.syncSuccessObjectsCount,
            totalRetryObjectsSizeCount: 0,
        }
    }
    
    public async resetSyncObjectSizeCount(addCalculatedToCurrentCount: boolean = true): Promise<void> {
        await this.syncEntityInstance!.resetSyncObjectSizeCount(addCalculatedToCurrentCount);
        return;
    }

    public async getSyncTimes(): Promise<any[]> {
        return await this.syncEntityInstance!.getSyncTimes();
    }

    /**
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     *                             Funkcije za konflikte
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     */

    public async getConflicts(objectUuid: string, entityName: string): Promise<any[] | undefined> {
        const conflictDB = (await this.getConflictDB());
        if (conflictDB.tableExists(entityName)) {
            return (await conflictDB.table(entityName).get(objectUuid))?.conflicts;
        }
        return undefined;
    }

    public getConflict(conflicts: SyncConflictItem[], conflictId: string): SyncConflictItem | undefined {
        return conflicts?.find((conflictItem: SyncConflictItem) => conflictItem.conflictId == conflictId);
    }

    public async setSyncChamberAsSynced(
        objectUuid: string,
        entityName: string,
        newStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.synced,
        lastModified: null | Date = null,
    ): Promise<boolean> {
        const syncDB = await this.getSyncDB();
        if (!syncDB.tableExists(entityName)) {
            return false;
        }
        const numberOfModifiedItems = await syncDB.table(entityName).where({ 'localUUID': objectUuid }).modify(
            (obj: SyncChamberRecordStructure) => {
                obj.objectStatus = newStatus;
                if(lastModified) {
                    obj.lastModified = lastModified;
                }
                if(obj.record && lastModified) {
                    obj.record.lastModified = lastModified
                }
            });
        if (!numberOfModifiedItems || numberOfModifiedItems == 0) {
            return false;
        }
        return true;
    }

    public async removeConflictChamber(objectUuid: string, entityName: string): Promise<boolean> {
        let conflictDB = await this.getConflictDB();
        if (!conflictDB.tableExists(entityName)) {
            return true; // Ce nimamo tabele, potem hipoteticno je tudi conflict "odstranjen" sam od sebe... Malo filozofski pristop.
        }

        await conflictDB.table(entityName).delete(objectUuid);
        return true;
    }

    public async setConflictChamber(objectUuid: string, entityName: string, conflictChamber: SyncConflictSchema): Promise<boolean> {
        let conflictDB = await this.getConflictDB();
        if (!conflictDB.tableExists(entityName)) {
            // conflictDB = await conflictDB.changeSchemaInstance(conflictDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME] }, conflictDB.verno / 10);
            this.dbSyncConflict = await conflictDB.changeSchemaInstance(conflictDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME] }, conflictDB.verno / 10);
            conflictDB = this.dbSyncConflict;
        }
        conflictDB.table(entityName).put(conflictChamber, objectUuid);
        return true;
    }

    public async setConflict(objectUuid: string, entityName: string, conflicts: SyncConflictItem[] | undefined): Promise<boolean> {
        // predpostavljam, da conflict ze obstaja
        if (!(await this.hasConflicts(objectUuid, entityName)) || !conflicts || conflicts.length == 0) {
            return false;
        }

        const conflictDB = await this.getConflictDB();
        const conflictRecord = (await (conflictDB).table(entityName).get(objectUuid));
        conflictRecord.conflicts = conflicts;
        conflictDB.table(entityName).put(conflictRecord, objectUuid);
        return true;

    }

    public async getConflictChamber(objectUuid: string, entityName: string): Promise<SyncConflictSchema | undefined> {
        const conflictDB = await this.getConflictDB();
        if (!conflictDB.tableExists(entityName)) {
            return undefined;

        }
        return (await conflictDB.table(entityName).get(objectUuid)) as SyncConflictSchema ?? undefined;
    }

    public async resolveConflict(objectUuid: string, entityName: string, conflictId: string, useRemote: boolean = true): Promise<boolean> {
        let conflictChamber = await this.getConflictChamber(objectUuid, entityName);
        if (!conflictChamber || !conflictChamber?.conflicts || conflictChamber?.conflicts.length == 0) {
            const event = {
                type: SyncLibraryNotificationEnum.CONFLICTS_DO_NOT_EXIST,
                createdAt: new Date(),
                message: `Could not find conflicts table in #resolveConflict function for uuid: ${objectUuid} and entityName: ${entityName}`,
            } as SyncLibraryNotification
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, event));
            return false;
        }
        if (await this.hasConflicts(objectUuid, entityName)) {

            const syncLocalData = (await (await this.getSyncDB()).table(entityName).get(objectUuid)).record;
            const beData = (await (await this.getConflictDB()).table(entityName).get(objectUuid)).record;
            let patchedData = cloneDeep(beData);
            /**
                 * Razlaga conflict strukture:
                 * sync_conflict:
                 *  {
                 *      conflicts: [],
                 *      record: {} // Ta record je dejansko BE record + FE popravki, ki niso bili zaznani kot konflikti
                 *  }
                 */
            const conflict = this.getConflict(conflictChamber.conflicts, conflictId);
            if (!conflict) {
                const event = {
                    type: SyncLibraryNotificationEnum.CANNOT_FIND_CONFLICT,
                    createdAt: new Date(),
                    message: `Could not find conflict in #resolveConflict function for uuid: ${objectUuid} and entityName: ${entityName} and conflictId: ${conflictId}`,
                } as SyncLibraryNotification
                SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, event));
                return false;
            }
            patchedData = this.syncLibAutoMerge.applyConflictPatch(conflict, beData, syncLocalData, useRemote);

            conflictChamber.record = patchedData;
            conflictChamber.conflicts = (await this.getConflicts(objectUuid, entityName))?.filter((conflict => conflict.conflictId != conflictId));

            if (conflictChamber?.conflicts && conflictChamber.conflicts?.length > 0) {
                return await this.setConflictChamber(objectUuid, entityName, conflictChamber);
            }


            const conflictChamberRemoved = await this.removeConflictChamber(objectUuid, entityName);
            // const syncUpdated = await this.setSyncChamberAsSynced(objectUuid, entityName); // TODO: Zelo verjetno, da bi moral razmisliti o "rollbacku", ker ce ta logika pade, bi bilo potrebno revertati conflict...
            const syncUpdated = await this.setSyncChamberAsSynced(objectUuid, entityName, ChamberSyncObjectStatus.pending_sync, conflictChamber.record[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD]); // TODO: Zelo verjetno, da bi moral razmisliti o "rollbacku", ker ce ta logika pade, bi bilo potrebno revertati conflict...
            if (conflictChamberRemoved) {

                SynchronizationLibrary.eventsSubject.next(
                    plainToInstance(
                        SyncLibraryNotification,
                        {
                            type: SyncLibraryNotificationEnum.CONFLICT_RESOLVED,
                            message: `Conflicts for object: ${objectUuid} in entity: ${entityName} was resolved!`
                        } as SyncLibraryNotification
                    )
                );
            }
            return conflictChamberRemoved;

        }
        return true;
    }

    public async hasConflicts(objectUuid: string, entityName: string): Promise<boolean> {
        const foundConflict = await this.getConflicts(objectUuid, entityName); // TO mora vrniti seznam, ker konflikte shranimo kot seznam
        return !!foundConflict && foundConflict?.length > 0;
    }

    /**
    * ********************************************************************************
    * ********************************************************************************
    * ********************************************************************************
    * ********************************************************************************
    *                             Funkcije samo za baze
    * ********************************************************************************
    * ********************************************************************************
    * ********************************************************************************
    * ********************************************************************************
    */


    async setupSyncDB(): Promise<AppDB> {
        this.dbSync = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.dbSync.open();
        this.syncChangeSubscription(this.dbSync);
        return this.dbSync;
    }

    async setupTempDB(): Promise<AppDB> {
        this.dbSyncTemp = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
        await this.dbSyncTemp.open();
        return this.dbSyncTemp;
    }

    async setupConflictDB(): Promise<AppDB> {
        this.dbSyncConflict = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
        await this.dbSyncConflict.open();
        this.conflictChangeSubscription(this.dbSyncConflict);
        return this.dbSyncConflict;
    }


    async getSyncDB(): Promise<AppDB> {
        // if (!this.dbSync) {
        if (!this.dbSync?.isOpen()) {
            this.dbSync = await this.setupSyncDB();
        }
        return this.dbSync;
    }

    async getTempDB(): Promise<AppDB> {
        // if (!this.dbSyncTemp) {
        if (!this.dbSyncTemp?.isOpen()) {
            this.dbSyncTemp = await this.setupTempDB();
        }
        return this.dbSyncTemp;
    }

    async getConflictDB(): Promise<AppDB> {
        if (!this.dbSyncConflict?.isOpen()) { // TO JE BILA ZELO POMEMBNA SPREMEMBA, da je v pravem vrstnem redu dobilo bazo (v unit/integration testih)
            this.dbSyncConflict = await this.setupConflictDB();
        }
        return this.dbSyncConflict;
    }

    syncChangeSubscription(newDB: AppDB): Subscription {
        this.syncDBChangeSubscription?.unsubscribe();

        this.syncDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.dbSync = newDB;
                    this.syncChangeSubscription(newDB!);
                }
            }
        )
        return this.syncDBChangeSubscription;
    }

    conflictChangeSubscription(newDB: AppDB): Subscription {
        this.conflictDBChangeSubscription?.unsubscribe();

        this.conflictDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.dbSyncConflict = newDB;
                    this.conflictChangeSubscription(newDB!);
                }
            }
        )
        return this.conflictDBChangeSubscription;
    }

    async changeAgentId(newAgentId: string): Promise<void> {
        this.agentId = newAgentId;
        await this.syncEntityInstance?.changeAgentId(newAgentId);
        return;
    }


}