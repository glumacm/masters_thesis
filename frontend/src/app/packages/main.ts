/**
 * Starting point for Synchronization library
 */

import { Observable, Subject, Subscription, filter } from "rxjs";
import { ALLOW_MERCURE_PUSH_SERVICE_SYNC, CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, DATABASE_TABLES_SCHEMA_MAPPER, DEFAULT_MERCURE_SYNC_POLICY } from "./configuration";
import { SynchronizationSyncStatus } from "./enums/sync-process.enum";
import { NetworkStatusEnum } from "./interfaces/network-status.interfaces";
import { SyncEntityWorkerResponse } from "./interfaces/sync-process.interfaces";
import { AppDB } from "./services/db";
import { NetworkStatus } from "./services/network-status";
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from "./utilities/console-style";
import * as Comlink from 'comlink';
import { RetryManagement } from "./workers/object-oriented/retry-management";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from "./interfaces/sync-storage.interfaces";
import { sync_entity_records_batch, ExampleClassForComlinkProxy } from "./services/network-calls";
import { SentryClient } from "./services/monitor";
// import { AutoMergeWrapper } from "./services/automerge-wrapper";
import { ConflictService } from "./services/conflict-service";
// import { getDataFromEncodedRecord } from "./utilities/automerge-utilities";
import { SyncLibraryNotification } from "./models/event/sync-library-notification.model";
import { plainToInstance } from "class-transformer";
import { SyncLibraryNotificationEnum } from "./enums/event/sync-library-notification-type.enum";
import { ObjectAlreadyConflictedError } from "./errors/object-already-conflicted.error";
import { cloneDeep } from "lodash";
import { ObjectStoredToTempError } from "./errors/object-stored-to-temp.error";
import { SyncEntryI } from "./workers/retry/utilities";
import { SyncLibAutoMerge } from "./services/automerge-service";
import { SyncEntityClean } from "./workers/object-oriented/sync-entity-clean.worker";
import { SyncConflictItem } from "./models/sync/sync-conflict-item.model";
import { SyncConflictSchema } from "./models/sync/sync-conflict-schema.model";
import { CustomAxiosMockedResponseEnum } from "./services/custom-axios";
import { AxiosResponse } from "axios";
import { EventSourcePolicyEnum } from "./enums/sync/event-source-policy-enum";
import { v4 as uuidv4 } from 'uuid';
import { SyncConfigurationI } from "./interfaces/sync-configuration.interfaces";

export class SynchronizationLibrary {

    public static existingInstance: SynchronizationLibrary | undefined;

    private networkStatusInstance: NetworkStatus;
    private networkStatus$: Observable<NetworkStatusEnum>;
    // Edini nacin da bom lahko imel dostop do iste instance baze je, da posredujem podatke od tukaj v workerje.
    // Ampak nisem se siguren ali bo to potrebno.
    private dbSyncTemp: AppDB | undefined;
    private dbSync: AppDB | undefined; // SYNC_DB should be from now on referenced as CURRENT DB
    private dbSyncing: AppDB | undefined;  // This DB is used when we start sync process for an object of an entity -> each object in the entity will be seperate thread
    private dbRetrySync: AppDB | undefined;
    private dbSyncConflict: AppDB | undefined;
    private dbRetryManagerSync: AppDB | undefined;

    // Agent ID
    public agentId: string;


    // external services
    private sentryClient: SentryClient;
    // private autoMergeWrapper: AutoMergeWrapper | undefined;
    private syncLibAutoMerge: SyncLibAutoMerge;
    private conflictService: ConflictService;

    // private dbStaticSyncing: SyncingDB | undefined;

    private readonly DEBUG_CONSOLE_CLASS_PREFIX = 'SynchronizationLibrary';

    public SyncEntityClass: Comlink.Remote<SyncEntityClean> | any;
    public retryManager: Worker | null = null;
    public entitySyncWorker: Worker | null = null;
    public retryMangementInstance: Comlink.Remote<RetryManagement> | undefined;
    public syncEntityInstance: Comlink.Remote<SyncEntityClean> | undefined;

    public static eventsSubject: Subject<SyncLibraryNotification>;

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
        this.consoleOutput = new CustomConsoleOutput('SynchronizationLibraryMAIN', CONSOLE_STYLE.sync_lib_retry_management);
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
            this.dbSyncing = SynchronizationLibrary.existingInstance.dbSyncing;
            this.dbRetrySync = SynchronizationLibrary.existingInstance.dbRetrySync;
            this.dbSyncConflict = SynchronizationLibrary.existingInstance.dbSyncConflict;
            this.dbRetryManagerSync = SynchronizationLibrary.existingInstance.dbRetryManagerSync;

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
        // this.dbSyncing = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME); // currently testing new option
        this.dbSyncing = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
        this.dbRetrySync = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME);
        this.dbSyncConflict = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
        this.dbRetryManagerSync = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME);

        const dbRetryExists = await AppDB.exists(this.dbRetrySync.name);
        const dbTempExists = await AppDB.exists(this.dbSyncTemp.name);
        const dbRetryManagerExists = await AppDB.exists(this.dbRetryManagerSync.name);
        const dbSyncingExists = await AppDB.exists(this.dbSyncing.name);
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

        if (!dbRetryExists) {
            this.dbRetrySync = (await AppDB.changeSchema(this.dbRetrySync!, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME]));
            this.dbRetrySync.close();
        }

        if (!dbRetryManagerExists) {
            this.dbRetryManagerSync = (await AppDB.changeSchema(this.dbRetryManagerSync!, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME]));
            this.dbRetryManagerSync.close();
        }

        if (!dbTempExists) {
            this.dbSyncTemp = (await AppDB.changeSchema(this.dbSyncTemp!, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME]));
            this.dbSyncTemp.close();
        }

        if (!dbSyncingExists) {
            this.dbSyncing = (await AppDB.changeSchema(this.dbSyncing!, { ['example_table']: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] }));
            this.dbSyncing.close();
        }

        await this.dbRetrySync.open();
        await this.dbSync.open();
        await this.dbSyncing.open();
        await this.dbSyncTemp.open();
        await this.dbSyncConflict.open();
        await this.dbRetryManagerSync.open();

        // Now let's open thread for retry manager
        // convert both to Comlink style!!

        // const RetryManagementClass = Comlink.wrap<typeof RetryManagement>(new Worker(new URL('./workers/object-oriented/retry-management', import.meta.url)));
        // this.retryMangementInstance = await new RetryManagementClass();
        // await this.retryMangementInstance.finishInit()
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
            SynchronizationLibrary.eventsSubject.pipe(filter(event => event.type === SyncLibraryNotificationEnum.DATABASE_CHANGE)).subscribe(
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

    public getNetworkStatus(): Observable<NetworkStatusEnum> {
        return this.networkStatus$;
    }

    public setMockedResponse(type: CustomAxiosMockedResponseEnum, data: AxiosResponse<any, any>) {
        this.syncEntityInstance?.setMockedResponse(type, data);
    }

    /**
     * Funkcija, ki poskrbi da se izvede SINGLE object sync.
     * @param entityName 
     * @param objectUuid 
     * @param data 
     * @param delay_to_wait 
     * @param useSyncLibAutoMerge 
     */
    public async startSyncEntityObject(entityName: string, objectUuid: string, data: any = {}, delay_to_wait: number = 0, useSyncLibAutoMerge: boolean = true) {
        // const insecure = new CustomConsoleOutput('Iam', CONSOLE_STYLE.black_and_white!);
        // insecure.output(`Tables in syncingDB: `, this.dbSyncing!.tables?.map((table) => table.name));
        // this.syncEntityInstance?.startObjectEntitySyncProcess(entityName, objectUuid); // starts background processing
        this.syncEntityInstance?.startObjectEntitySyncProcessRefactored(entityName, data, objectUuid, delay_to_wait); // starts background processing
        // insecure.closeGroup();
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

    //@Probably DEPRECATED
    public async startSyncEntity(objectName: string) {  // THIS WILL BE BULK VERSION OF SYNC
        // # check if we can start sync entity - check syncingDB if data for this TABLE + objectID is processing
        const isTableAndObjectAlreadySyncing = (objectUuid: string, tableName: string) => {  // NAME OF FUNCTION: findObjectInTable
            const existingData = this.dbSyncing?.table(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME + objectName).where('status').equals('in_sync').toArray();

        }

        // const data = await this.syncEntityInstance?.startSyncProcess(objectName);
        const data = {}


        const responseData = data as SyncEntityWorkerResponse;

        switch (responseData.status) {
            case SynchronizationSyncStatus.COMPLETE:
                /**
                 * BE successfully saved data
                 * 
                 * 1. all sent data must be changed to 'SYNCHED' status in sync DB
                 * 1.1 Check if BE sends object ID's
                 */

                // check if we can update at once same field to data that match some array in DB query
                // current temp structure is disaster, lets prepare final idea
                const tempIdea = {} // This is duplicate of syncDB entry
                // this.dbSync?.table(CONFIGURATION_CONSTANTS.SYNC_DB_PREFIX_STRING + objectName).where('')?.anyOf  responseData.data.finishedSuccessfully.map((processedItem: SynchronizationSyncedObject) => processedItem.localUuid)).

                break;
            case SynchronizationSyncStatus.ECONNABORTED:
                /**
                 * HERE we go into 'retry' logic:
                 * - first we need to wait until data on BE is finished -> that means that we will have to request info about transaction/request to BE
                 * - maybe our network connection is still down and therefore we will have to retry later
                 */
                break;
            case SynchronizationSyncStatus.PARTIAL: // ???? Naredimo logiko za partial... sklepam, da bi moral dobiti vse 'neshranjene' podatke v `data` polju ????
                break;
            default:
                break;
        }

        // console_log_with_style(`${this.DEBUG_CONSOLE_CLASS_PREFIX} - before checking TEMP database`, CONSOLE_STYLE.sync_lib_main, '', 4);

        {
            /**
             * Neglede na vse, pa je potrebno preveriti tudi ali je prislo vmes do 'TEMP' shranjevanja
             * 
             * Logika:
             * 1. Dobi tabelo za isto entiteto, kot smo jo poslali na sync workerju , za `sync_temp` bazo
             * 2. mapiraj key na record
             * 3. mapiraj recorde v ustrezno strukturo
             * 4. izvedi proces 'merganja' ?
             */

            const sooBillClinton = await this.dbSyncTemp?.tables.find((table) => {
                return CONFIGURATION_CONSTANTS.SYNC_TEMP_DB_PREFIX_STRING + objectName == table.name
            });
            if (sooBillClinton) {
                const dbTempData = await this.dbSyncTemp?.table(CONFIGURATION_CONSTANTS.SYNC_TEMP_DB_PREFIX_STRING + objectName).toArray();
                {
                    /**
                     * Temp podatki, morajo imeti enako strukturo kot imamo podatke v Sync bazi.
                     * Razlika je le to, da ko se sprasujemo v kaksnem stanju so TEMP podatki , si moramo odgovoriti,
                     * da podatki cakajo na to, da se bo poslalo na BE.
                     * 
                     * Problem:
                     * - ne vemo, ali je vmes med temp shranejvanjem in trenutnim casom prislo do sprememb na BE.
                     *  - zato moramo v tem scenariju, ponovno preveriti podatek iz BE. 
                     *      + odkril sem se eno posebnost --> PARTIAL SUCCESS je v trenutni kodi mogoc!!! Ker lahko pride do primera,
                     *      ko zelimo posyncati podatke, ki niso bili `mergani` z zadnjimi podatki na BE.
                     */

                }
            } else {
                console_log_with_style(`${this.DEBUG_CONSOLE_CLASS_PREFIX} - there is no USE`, CONSOLE_STYLE.sync_lib_main, '', 4);
            }


        }


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
    async storeNewObject(entityName: string, objectUuid: string, objectData: any): Promise<SyncChamberRecordStructure> {
        /**
         * Kratek opis:
         * Funkcija mora na podlagi podanega objekta in UUID-ja, popraviti objekt v bazi glede na UUID.
         * 
         * Dolg opis:
         * 1. Ce tabela, ki jo navedemo v `entityName` ne obstaja v `sync` tabeli, jo na novo definiramo.
         * 2. Dodaj spremembe novega objekta v obstojeci objekt (ce ta obstaja v bazi).
         * 3. Iz zdruzenega objekta, pridobi zadnje spremembe in jih dodaj v CHANGES
         */

        //USE-CASE za CONFLICT
        const retrievedConflictDB = await this.getConflictDB();
        const existingConflictEntry = retrievedConflictDB.tableExists(entityName) ? (await retrievedConflictDB.table(entityName).get(objectUuid)) : undefined;

        if (existingConflictEntry) {
            // IMAMO PODATEK ZE V CONFLICTU in v tem primeru ne pustimo nadaljnega shranjevanja
            // SyncLibraryNotification
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, { createdAt: new Date(), type: SyncLibraryNotificationEnum.ALREADY_CONFLICTED, message: `Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.` }));
            throw new ObjectAlreadyConflictedError(`Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.`);
        }

        // USE-CASE ZA TEMP
        const retrievedTempDB = await this.getTempDB();
        // Kako ves da entityName ze obstaja v TEMP? 
        const existingTempEntry = retrievedTempDB.tableExists(entityName) ? (await retrievedTempDB.table(entityName).get(objectUuid)) : undefined;
        if (
            existingTempEntry
        ) {
            // const dataFromTemp = cloneSyncObjectWithEncoded(existingTempEntry as any) as SyncChamberRecordStructure; // TODO: Spremeniti tip ki ga damo v funkcijo in ki ga dobimo iz funkcije
            const dataFromTemp = cloneDeep(existingTempEntry) as SyncChamberRecordStructure;
            // Ta zadeva naredi nekaj kar zaenkrat ne razumem
            const dataToInsert = await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromTemp);

            (await retrievedTempDB.table(entityName)).put(dataToInsert, objectUuid);
            const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible (overwritten temp data).' };
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, newEvent));
            throw new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible (overwritten temp data).`);
        }

        // Kaksna je razlika med tem, da ugotoivm, da moram nastaviti TEMP preko syncing in pre-existing TEMP?
        const retrievedSyncDB1 = await this.getSyncDB();
        const existingEntry: SyncEntryI = retrievedSyncDB1.tableExists(entityName) ? await retrievedSyncDB1.table(entityName).get(objectUuid) : undefined; // TODO: Manjka logika, ki bo existingentryju dodala nove podatke , ker drugace se povozijo prejsnej spremembe

        if (
            existingEntry &&
            (
                // existingEntry.status === SyncingObjectStatus.in_sync ||
                // existingEntry.status === SyncingObjectStatus.pending_retry
                existingEntry.objectStatus === ChamberSyncObjectStatus.in_sync ||
                existingEntry.objectStatus === ChamberSyncObjectStatus.conflicted
            )
        ) {
            const dataFromSync = cloneDeep(existingEntry) as SyncChamberRecordStructure;
            const dataToInsert = await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromSync);
            //Priden to je pravilna uporaba
            this.dbSyncTemp = await (await this.getTempDB()).addEntryToTable(entityName, objectUuid, dataToInsert, (await this.getTempDB()).verno / 10, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] });
            const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' };
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, newEvent));
            throw new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`);
        }

        const retrievedSyncDB: AppDB = await this.getSyncDB()
        if (!retrievedSyncDB.tableExists(entityName)) {
            // create table for entity
            this.dbSync = await (retrievedSyncDB).changeSchemaInstance(retrievedSyncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] }, retrievedSyncDB.verno / 10)
        }

        // V tem trenutku imamo sigurno tabelo `entityName` v syncDB
        const preExisting: SyncEntryI | undefined = await (await this.getSyncDB()).table(entityName).get(objectUuid);

        let dataToReturn: SyncChamberRecordStructure = {} as SyncChamberRecordStructure;

        if (preExisting) {
            dataToReturn = await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, preExisting);
        } else {
            dataToReturn = this.conflictService.prepareSyncRecordChamberStructure(
                objectUuid,
                objectData,
                [],
                undefined,
                ChamberSyncObjectStatus.pending_sync, objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] ? objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] : undefined,
            ) as SyncChamberRecordStructure;
        }
        (await this.getSyncDB()).table(entityName).put(dataToReturn, objectUuid);
        return dataToReturn;
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
    ): Promise<boolean> {
        const syncDB = await this.getSyncDB();
        if (!syncDB.tableExists(entityName)) {
            return false;
        }
        const numberOfModifiedItems = await syncDB.table(entityName).where({ 'localUUID': objectUuid }).modify(
            (obj: SyncChamberRecordStructure) => obj.objectStatus = newStatus);
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
            SynchronizationLibrary.eventsSubject.next(event);
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
                SynchronizationLibrary.eventsSubject.next(event);
                return false;
            }
            patchedData = this.syncLibAutoMerge.applyConflictPatch(conflict, beData, syncLocalData, useRemote);

            conflictChamber.record = patchedData;
            conflictChamber.conflicts = (await this.getConflicts(objectUuid, entityName))?.filter((conflict => conflict.conflictId != conflictId));

            if (conflictChamber?.conflicts && conflictChamber.conflicts?.length > 0) {
                return await this.setConflictChamber(objectUuid, entityName, conflictChamber);
            }

            const conflictChamberRemoved = await this.removeConflictChamber(objectUuid, entityName);
            const syncUpdated = await this.setSyncChamberAsSynced(objectUuid, entityName); // TODO: Zelo verjetno, da bi moral razmisliti o "rollbacku", ker ce ta logika pade, bi bilo potrebno revertati conflict...
            if (conflictChamberRemoved) {

                SynchronizationLibrary.eventsSubject.next(
                    {
                        type: SyncLibraryNotificationEnum.CONFLICT_RESOLVED,
                        message: `Conflicts for object: ${objectUuid} in entity: ${entityName} was resolved!`
                    } as SyncLibraryNotification
                );
            }
            return conflictChamberRemoved;

        }
        return true;
    }

    public resolveConflictByProperty(objectUuid: string, entityName: string, conflictId: string, useLocal: boolean = false, useRemote: boolean = true): boolean {
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

    async setupSyncingDB(): Promise<AppDB> {
        this.dbSyncing = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
        await this.dbSyncing.open();
        return this.dbSyncing;
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

    async getSyncingDB(): Promise<AppDB> {
        // if (!this.dbSyncing) {
        if (!this.dbSyncing?.isOpen()) {
            this.dbSyncing = await this.setupSyncingDB();
        }
        return this.dbSyncing;
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