import * as Comlink from 'comlink';
import { Collection, Table } from 'dexie';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_SCHEMA_MAPPER, OBJECT_NAME_TO_PATH_MAPPER } from '../../configuration';
import { HttpErrorResponseEnum, SynchronizationSyncStatus } from '../../enums/sync-process.enum';
import { ResponseMessage, SynchronizationSyncEntityDecodedRecord } from '../../interfaces/sync-process.interfaces';
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from '../../interfaces/sync-storage.interfaces';
import { getObjectNameToPathMapper } from '../../services/configuration';
import { AppDB } from '../../services/db';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import * as classTransformer from 'class-transformer';





import { delay } from '../../utilities/worker-utilities';
import { filter, Subscription } from 'rxjs';
import { createSyncingEntry, SyncEntryI, SyncingEntryI, SyncingObjectStatus } from '../retry/utilities';
import { prepareSyncEntryStructure } from '../../utilities/sync-entity-utilities';
import { AxiosResponse } from 'axios';
import { SyncEntityResponseI } from '../../interfaces/sync/sync-entity-response.interface';
import { SyncEntityResponse } from '../../models/sync/sync-entity-response.model';
import { SyncEntityStatusEnum } from '../../enums/sync/sync-entity-status.enum';
import { SyncConflictItemI } from '../../interfaces/sync/sync-conflict-item.interface';
import { SyncConflictItem } from '../../models/sync/sync-conflict-item.model';
import { SyncConflictSchema } from '../../models/sync/sync-conflict-schema.model';
import { SyncLibraryNotification } from '../../models/event/sync-library-notification.model';
import { SyncLibraryNotificationEnum } from '../../enums/event/sync-library-notification-type.enum';
import { cloneDeep } from 'lodash';
import { SyncLibAutoMerge } from '../../services/automerge-service';
import { ConflictService } from '../../services/conflict-service';
import { SyncBatchSingleEntityResponse } from '../../models/sync/sync-batch-single-entity-response.model';
import { SyncBatchSingleEntityStatusEnum } from '../../enums/sync/sync-batch-single-entity-status.enum';
import { CustomAxios, CustomAxiosMockedResponseEnum, MockedResponse } from '../../services/custom-axios';
import { SyncConfigurationI } from '../../interfaces/sync-configuration.interfaces';
import { EventSourceService } from '../../services/event-source-service';
import { DoctrineEventActionEnum } from '../../enums/sync/doctrine-event-action.enum';
import { ObjectAlreadyConflictedError } from '../../errors/object-already-conflicted.error';
import { ObjectStoredToTempError } from '../../errors/object-stored-to-temp.error';
import { v4 as uuidv4 } from 'uuid'
import { NetworkStatusEnum } from '../../interfaces/network-status.interfaces';
import { Operation } from 'fast-json-patch';

// type ResponseTest<T> = Promise<AxiosResponse<|SyncEntityResponse2I<T>>>;
export class SyncEntityClean {
    private syncDB: AppDB | undefined;
    private syncingDB: AppDB | undefined;
    private retryDB: AppDB | undefined;
    private tempDB: AppDB | undefined;
    private syncConflictDB: AppDB | undefined;
    private consoleOutput: CustomConsoleOutput;
    private syncDBChangeSubscription: Subscription | undefined;
    private syncingDBChangeSubscription: Subscription | undefined;
    private tempDBChangeSubscription: Subscription | undefined;
    private syncConflictDBChangeSubscription: Subscription | undefined;
    private syncLibAutoMerge: SyncLibAutoMerge;
    private conflictService: ConflictService;
    private customAxios: CustomAxios;
    private automaticSyncInterval: any;
    private syncInProgress: boolean = false;

    // external services

    private notifyMainAboutDBChange: any; // funkicja za obvescanje MAIN.ts,da je prislo do posodobitve baze (dbName, version === db.version /10)
    private sentryCaptureMessage: any;
    private sendNewEventNotification: any; // sendNewEventNotification -> funkcija, ki posreduje nek SyncLibraryNotification event v Subject, na katerega se lahko developerji `narocijo`.
    private eventSourceService: EventSourceService | undefined;

    /**
     * Vse funkcije ki jih bom rabil kot dependencije
     */
    public dependencies: any | Comlink.ProxyOrClone<any>;
    public configuration: SyncConfigurationI;

    public networkStatus: NetworkStatusEnum = NetworkStatusEnum.OFFLINE;

    /**
     * 
     * @param externalDependencies Vse funkcije, ki ji zelim uporabiti znotraj workerja
     */
    constructor(
        public externalDependencies: any | Comlink.ProxyOrClone<any>,
        public mockedAxios: boolean = false,
        public mockedAxiosResponse: MockedResponse,
        public agentId: string = uuidv4(),
    ) {
        this.consoleOutput = new CustomConsoleOutput('SyncEntityWorker constructor', CONSOLE_STYLE.sync_entity_worker);
        // this.consoleOutput.output(`this is agent id: `, agentId);
        this.configuration = { agentId: agentId } as SyncConfigurationI;
        this.conflictService = new ConflictService();
        this.syncLibAutoMerge = new SyncLibAutoMerge();
        this.customAxios = new CustomAxios(mockedAxios, mockedAxiosResponse);
        this.setDependencies(externalDependencies);

        if (CONFIGURATION_CONSTANTS.ALLOW_MERCURE_PUSH_SERVICE_SYNC) {
            this.eventSourceService = new EventSourceService(
                CONFIGURATION_CONSTANTS.EVENT_SOURCE_URL,
                // [
                //   'https://example.com/books/{id}',
                //   'https://example.com/books/{id}',
                // ],
                [
                    CONFIGURATION_CONSTANTS.EVENT_SOURCE_SYNC_TOPIC,
                ],
            );

            if (this.networkStatus === NetworkStatusEnum.ONLINE) {
                this.consoleOutput.output(`Initial open source`);
                this.eventSourceService.openEventSource();
            }


        }


        this.eventSourceService?.eventSourceStream.pipe(filter((event) => EventSourceService.eventAllowedBasedOnConfiguration(event, this.configuration.agentId))).subscribe(
            {
                next: async (value) => {
                    this.consoleOutput.output(`PleaseWalkAway`, value);
                    if (!!CONFIGURATION_CONSTANTS.SHORT_ENTITIY_NAME_TO_OBJECT_NAME[value.entityName]) {
                        if (value.action === DoctrineEventActionEnum.NEW) {
                            this.storeNewObject(
                                CONFIGURATION_CONSTANTS.SHORT_ENTITIY_NAME_TO_OBJECT_NAME[value.entityName],
                                ((value.objectData as any)?.[CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER] ? (value.objectData as any)[CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER] : uuidv4()),
                                value.objectData,
                                true
                            );
                        } else if (value.action === DoctrineEventActionEnum.DELETE) {
                            if (
                                (value.objectData as any)[CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER] &&
                                CONFIGURATION_CONSTANTS.DEFAULT_DELETE_ON_MERCURE_EVENT || CONFIGURATION_CONSTANTS.DELETE_ON_MERCURE_EVENT_CONFIG[value.entityName]
                            ) {
                                await (await this.getSyncDB()).table(CONFIGURATION_CONSTANTS.SHORT_ENTITIY_NAME_TO_OBJECT_NAME[value.entityName]).delete((value.objectData as any)[CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER]);
                            }
                            // 
                        } else if (value.action === DoctrineEventActionEnum.UPDATE) {
                            this.consoleOutput.output(`What about us`);
                            await this.updateEntityOnEventSourceEvent(value.objectData, CONFIGURATION_CONSTANTS.SHORT_ENTITIY_NAME_TO_OBJECT_NAME[value.entityName]);

                        }
                    } else {
                        this.sendNewEventNotification(
                            {
                                type: SyncLibraryNotificationEnum.ENTITY_DOES_NOT_EXIST,
                                message: `Entity: ${value.entityName} in not configured in mapper: SHORT_ENTITY_NAME_TO_OBJECT_NAME`,
                            } as SyncLibraryNotification
                        )
                    }
                }
            }
        );
    }


    // async updateEntityOnEventSourceEvent(dataFromEventSource: any, objectIdentifier: any, entityName: string) {
    async updateEntityOnEventSourceEvent(dataFromEventSource: any, entityName: string) {
        let syncDB = await this.getSyncDB();
        if (!syncDB.tables.find(table => table.name == entityName)) {
            // Dodajmo novo shemo
            this.syncDB = await syncDB.changeSchemaInstance(syncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });
            syncDB = this.syncDB;
        }
        const objectIdentifier: any = dataFromEventSource[CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER];
        let syncEntry: SyncEntryI = await syncDB.table(entityName).get(objectIdentifier);

        if (!syncEntry) {
            // INSERT MODE needed
            // await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromSync);
            syncEntry = this.conflictService.prepareSyncRecordChamberStructure(
                objectIdentifier,
                dataFromEventSource,
                [],
                undefined,
                ChamberSyncObjectStatus.synced, dataFromEventSource[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] ? dataFromEventSource[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] : undefined,
            ) as SyncEntryI;
            await syncDB.table(entityName).put(syncEntry, objectIdentifier);
            // syncDB = this.syncDB;
            return;
        }
        if (!syncEntry.record || syncEntry.objectStatus != ChamberSyncObjectStatus.synced) {
            return;
        }

        const recordKeys = Object.keys(syncEntry.record);
        const eventSourceKeys = Object.keys(dataFromEventSource);
        for (let objectKey of eventSourceKeys) {
            if (!dataFromEventSource.hasOwnProperty(objectKey)) {
                // if (!Object.hasOwn(dataFromEventSource, objectKey)) {
                delete dataFromEventSource[objectKey]
            }
        }
        const dataToReturn = await this.syncLibAutoMerge.applyNewChangesToExistingSyncObject(objectIdentifier, dataFromEventSource, syncEntry, ChamberSyncObjectStatus.synced);
        syncDB.table(entityName).put(dataToReturn, objectIdentifier);
        return;

    }



    /** ADDED ONLY AS TEMPORARY FIX, since this is main function that is part of main.ts (would be possible to switch it to SERVICE which would all dependencies via construcor dependecy injection)
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
    async storeNewObject(entityName: string, objectUuid: string, objectData: any, newRecordBeEvent: boolean = false): Promise<SyncChamberRecordStructure> {
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
        const retrievedConflictDB = await this.getSyncConflictDB();
        const existingConflictEntry = retrievedConflictDB.tableExists(entityName) ? (await retrievedConflictDB.table(entityName).get(objectUuid)) : undefined;

        if (existingConflictEntry) {
            // IMAMO PODATEK ZE V CONFLICTU in v tem primeru ne pustimo nadaljnega shranjevanja
            // SyncLibraryNotification
            this.sendNewEventNotification(classTransformer.plainToInstance(SyncLibraryNotification, { createdAt: new Date(), type: SyncLibraryNotificationEnum.ALREADY_CONFLICTED, message: `Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.` }));
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
            this.sendNewEventNotification(classTransformer.plainToInstance(SyncLibraryNotification, newEvent));
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
            this.syncDB = await (await this.getTempDB()).addEntryToTable(entityName, objectUuid, dataToInsert, (await this.getTempDB()).verno / 10, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] });
            const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' };
            this.sendNewEventNotification(classTransformer.plainToInstance(SyncLibraryNotification, newEvent));
            throw new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`);
        }

        const retrievedSyncDB: AppDB = await this.getSyncDB()
        if (!retrievedSyncDB.tableExists(entityName)) {
            // create table for entity
            this.syncDB = await (retrievedSyncDB).changeSchemaInstance(retrievedSyncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] }, retrievedSyncDB.verno / 10)
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
                newRecordBeEvent ? ChamberSyncObjectStatus.synced : ChamberSyncObjectStatus.pending_sync, objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] ? objectData[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] : undefined,
            ) as SyncChamberRecordStructure;
        }
        (await this.getSyncDB()).table(entityName).put(dataToReturn, objectUuid);
        return dataToReturn;
    }




    public setMockedResponse(mockedResponseType: CustomAxiosMockedResponseEnum, mockedResponseData: AxiosResponse) {
        this.customAxios.mockedResponse = { mockedResponseType, mockedResponseData } as MockedResponse;
    }

    public async setDependencies(dependencies: any | Comlink.ProxyOrClone<any>) {
        this.dependencies = dependencies;

        this.sentryCaptureMessage = dependencies.sentryCaptureMessage;
        /**
         * Pricakujemo, da bomo v sendNewEventNotification funkcijo poslali event tipa: SyncLibraryNotification
         */

        // Dependency-ji so Proxy funkcije, ki kazejo na podatek, ki ga dodajam v konstruktor
        // ce hocem dobiti pravi podatek ven, moram uporabiti `await` ker drugace se podatek ne pridobi
        this.sendNewEventNotification = dependencies.sendNewEventNotification;
        this.notifyMainAboutDBChange = dependencies.notifyMainAboutDBChange;
        // this.configuration = dependencies.configuration;
    }


    public async sync_entity_record(
        entityName: string,
        record: any,  // Podatek kot ga imamo v FE `sync` bazi 
        requestUuid: string,
    ): Promise<any> {
        // return axios.post(
        return this.customAxios.post(
            encodeURI(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}/${entityName}/${requestUuid}`),
            record.record,
        ).then(
            (success) => {
                return success.data;
            },
            (error) => {
                return error;
            }
        );
    }

    public async batch_single_entity_sync(entityName: string, data: any, requestUuid?: string): Promise<any> {
        const entityNameFromConfiguration = (OBJECT_NAME_TO_PATH_MAPPER as any)[entityName];
        this.consoleOutput.output(`again: `, this.configuration.agentId);
        // return axios.post(
        return this.customAxios.post(
            encodeURI(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.BATCH_SINGLE_ENTITY_SYNC_PATH_NAME}/${entityNameFromConfiguration}`),
            {
                agentId: this.configuration.agentId, // Pricakujem da bo vedno ta vrednost prisotna!!!
                requestUuid: requestUuid,
                data
            },
            // {
            //     timeout: 20
            // }
        );
    }

    async initDatabases() {

        this.retryDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME);
        await this.retryDB.finishSetup();

        await this.finishSyncDBSetup(); // this creates instance for db and sets listener for never versions of the database
        await this.finishSyncingDBSetup(); // this creates instance for db and sets listener for never versions of the database
        await this.finishTempDBSetup();
        await this.finishSyncConflictDBSetup();
        await this.startBatchSyncOnInterval();
        return;
    }

    async startBatchSyncOnInterval(): Promise<void> {
        if (this.automaticSyncInterval) {
            clearInterval(this.automaticSyncInterval);
        }
        if (CONFIGURATION_CONSTANTS.ALLOW_INTERVAL_SYNC) {
            this.automaticSyncInterval = setInterval(async () => {
                if (this.syncInProgress) {
                    this.consoleOutput.output(`Cannot start sync - sync already in progress`);
                    return;
                }
                await this.startBatchSync();

            }, CONFIGURATION_CONSTANTS.AUTOMATIC_SYNC_INTERVAL);
        }
        return;
        
    }

    async startBatchSync(useSyncLibAutoMerge: boolean = true): Promise<void> {
        this.consoleOutput.output(`Starting BATCH SYNC`);
        let initialTimer = 200;
        const timerSteper = 100;
        this.syncInProgress = true;
        const timeoutFunction = (event: any, timer: number) => {
            // This is used because otherwise event is sent before the actual sync call is finished....!!!-
            setTimeout(async ()=>{
                await this.sendNewEventNotification(event);
            }, timer);
        };
        try {
            
            if (this.networkStatus === NetworkStatusEnum.OFFLINE) {
                // await this.sendNewEventNotification({type: SyncLibraryNotificationEnum.NETWORK_UNAVAILABLE, message: 'Nimamo omrezja'} as SyncLibraryNotification);
                timeoutFunction({type: SyncLibraryNotificationEnum.NETWORK_UNAVAILABLE, message: 'Nimamo omrezja'} as SyncLibraryNotification, timerSteper);
                return;
            }
            // 1. Sprehodim se cez vsako tabelo v SYNC bazi in poiscemo podatke, ki imajo status == pending_sync
            const syncDB = await this.getSyncDB();
            const mapper = {} as any;
            const mapEntityToUuids = {} as any;
            const mapEntityToRequestUuid = {} as any;
            for (let syncTable of syncDB.tables){
                mapEntityToRequestUuid[syncTable.name] = uuidv4()
                // za vsako tabelo poiscemo podatke
                const tablePendingObjects = await syncTable.filter((obj: SyncChamberRecordStructure) => obj.objectStatus == ChamberSyncObjectStatus.pending_sync).toArray();

                if (tablePendingObjects && tablePendingObjects.length > 0) {
                    mapper[syncTable.name] = tablePendingObjects;
                    mapEntityToUuids[syncTable.name] = tablePendingObjects.map((item: SyncChamberRecordStructure) => item.localUUID);
                }
            
                // for (let i = 0; i <= syncDB.tables.length; i++) { //WTF??? zakaj dve iste foor zanke???
                //     // za vsako tabelo poiscemo podatke
                //     const tablePendingObjects = await syncTable.filter((obj: SyncChamberRecordStructure) => obj.objectStatus == ChamberSyncObjectStatus.pending_sync).toArray();

                //     if (tablePendingObjects && tablePendingObjects.length > 0) {
                //         mapper[syncTable.name] = tablePendingObjects;
                //         mapEntityToUuids[syncTable.name] = tablePendingObjects.map((item: SyncChamberRecordStructure) => item.localUUID);
                //     }
                // }
                }

            for (let property of Object.keys(mapper)) {
                // Poslji na zahtevo na BE!!
                if (mapper[property] && mapper[property].length > 0) { // Property === table name
                    const uuids = mapEntityToUuids[property];
                    if (!uuids || uuids.length == 0) {
                        continue;
                    }
                    /**
                     * Tukaj bi bilo smiselno razmisliti o tem kako resiti bolj "pametno".
                     * Mogoce za magistrsko je ok, ampak za nadaljni razvoj, bi bilo smiselno imeti nek stack/queue
                     * 
                     * Za nasledji korak, bi jaz pripravil enak postopek kot pri SINGLE syncu -> imamo success logiko in error logiko
                     * 
                     * Predlagam, da za response iz BE uporabim Tabelo istega classa kot imamo za SINGLE sync!
                     */

                    // 
                    /**
                     * TODO: Zdi se mi, da manjka logika, da se podatki nastavijo v syncing + brisanje iz syncing po koncu! + logika, ki preveri ali je podatek v syncing??? (naceloma bi moral ze iz sync.objectStatus dobiti pravo zadevo)
                     * 
                     * Velika dilema: Zakaj bi rabil syncingDB, ce pa naceloma imam v sync db ustrezno stanje + lahko dodam se manjkajoci podatek za `retries` in to je to...?
                     * Logika:
                     *      -   na podlagi `uuids` + sync tabele ustvarimo syncingDB entryje
                     */
                    try {
                        const itemsToSync = await syncDB.table(property)
                            .filter(
                                (obj: SyncChamberRecordStructure) => obj.localUUID.includes(uuids)
                            );
                        const itemsToSyncAsArray = await itemsToSync.toArray();

                        // Ustvarimo syncing podatke
                        let syncingDBreference = await this.getSyncingDB();
                        if (!(await this.doesTableExistInDB(syncingDBreference, property))) {
                            this.syncingDB = await syncingDBreference.changeSchemaInstance(syncingDBreference, { [property]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] });
                            syncingDBreference = this.syncingDB;
                        }

                        // Ustvarimo Syncing entryje
                        for (let syncItem of itemsToSyncAsArray) {
                            const syncingEntry: SyncingEntryI = createSyncingEntry(syncItem.localUUID, syncItem.localUUID, 0, SyncingObjectStatus.in_sync, new Date(), syncItem);
                            await syncingDBreference.table(property).put(syncingEntry, syncItem.localUUID);
                        }
                        // itemsToSyncAsArray.forEach(async (syncItem: SyncChamberRecordStructure) => {
                        //     const syncingEntry: SyncingEntryI = createSyncingEntry(syncItem.localUUID, syncItem.localUUID, 0, SyncingObjectStatus.in_sync, new Date(), syncItem);
                        //     await syncingDBreference.table(property).put(syncingEntry, syncItem.localUUID);
                        // });

                        // Nastavimo sync entryje na in_sync
                        await itemsToSync.modify((obj: SyncChamberRecordStructure) => obj.objectStatus = ChamberSyncObjectStatus.in_sync);

                        const beResult = await this.batch_single_entity_sync(property, mapper[property].map((data: SyncChamberRecordStructure) => {
                            const newData = data.record;
                            newData['uuid'] = data.localUUID;
                            newData['lastModified'] = data.lastModified;
                            return newData;
                        }), mapEntityToRequestUuid[property]).then(
                            (success) => this.processBatchSingleEntitySuccessLogic(property, classTransformer.plainToInstance(SyncBatchSingleEntityResponse, success.data), uuids),
                            (error) => this.processBatchSingleEntityErrorLogic(property, error, uuids),
                        );
                    } catch (exception) {
                        // TODO: po vsej verjetnosti ce pride ddo kaksne napake ki je nise mpredpostavil
                        // this.sendNewEventNotification(
                        //     {
                        //         type: SyncLibraryNotificationEnum.UNKNOWN_ERROR,
                        //         message: 'Ocitno je prislo do neke napake, ki je nisem predvidel',
                        //         error: exception,
                        //     } as SyncLibraryNotification
                        // );
                        timeoutFunction({
                            type: SyncLibraryNotificationEnum.UNKNOWN_ERROR,
                            message: 'Ocitno je prislo do neke napake, ki je nisem predvidel',
                            error: exception,
                        } as SyncLibraryNotification, initialTimer);
                        initialTimer+=timerSteper;
                        this.consoleOutput.output(`startBatchSync: napaka ki je nisem prepostavil: `, exception);
                    }
                }

            }
            // await this.sendNewEventNotification(
            //     {
            //         type: SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED,
            //         message: 'Batch sync je zakljucen',
            //         error: null,
            //     } as SyncLibraryNotification
            // );
        }
        finally {
            this.syncInProgress = false;
        }
        timeoutFunction({
            type: SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED,
            message: 'Batch sync je zakljucen',
            error: null,
        } as SyncLibraryNotification, initialTimer);
        return;
    }

    async processBatchSingleEntityErrorLogic(entityName: string, error: any, uuidsToSync: any[], errorType = SyncBatchSingleEntityStatusEnum.FATAL_ERROR): Promise<void> {
        this.consoleOutput.output(`#processBatchSingleEntityErrorLogic process`, error); //TODO: Odstraniti ta log, ko bo potrjeno, da logika dela
        for (let uuid of uuidsToSync) {
            await this.singleSyncProcessError(error, entityName, uuid, uuid);
        }

        await this.sendNewEventNotification(
            {
              type: SyncLibraryNotificationEnum.CONCURRENCY_PROBLEM,
              message: 'Poskusimo ponovno pognati',
            } as SyncLibraryNotification
        );
        return;

    }

    /**
     * Predlagam bi da BE vrne objekt, ki bo podal status COMPLETE SUCCESS, PARTIAL, ERROR. Nato bom to zadevo ustrezno resil znotraj funkcije.
     * e.g. {syncResponses: SyncEntityResponse[], status: <someEnum>}
     * @param entityName 
     * @param data 
     */
    async processBatchSingleEntitySuccessLogic(entityName: string, data: SyncBatchSingleEntityResponse | undefined, uuidsToSync: any[]): Promise<void> {
        if (!data) {
            await this.sendNewEventNotification(
                {
                    type: SyncLibraryNotificationEnum.BATCH_SINGLE_ENTITY_FAILED,
                    message: `Could not sync batch for entity: ${entityName}`,
                } as SyncLibraryNotification
            );
            // throw new Error(`Error: ${SyncLibraryNotificationEnum.BATCH_SINGLE_ENTITY_FAILED}`)
            return;
        }
        switch (data.status) {
            case SyncBatchSingleEntityStatusEnum.COMPLETE_SUCCESS:
            case SyncBatchSingleEntityStatusEnum.PARTIAL_SUCESS:
                //TODO: zaenkrat bom oboje procesiral pod isto logiko. Kasneje je potrebno to preoblikovati za vsako posebej
                for (let syncRecord of data.syncRecords) {
                    /**
                     * Tukaj bi predlagal, da se:
                     * - na BE doda kodo, ki bo vrnila tudi UUID
                     * - da preko UUID-ja vzamem podatek iz FE
                     * - na koncu poklicem `singleSyncProcessSuccess(...), ki bo ze pokrival vse kar potrebujem
                     */

                    // Poznamo napako, ki pove, da UUID manjka, v takem primeru bo tak response "ghost" response - ki ne bo imel nobenega handlerja, ker ne moremo poslati nekaj kar nima UUID-ja.
                    if (syncRecord.status == SyncEntityStatusEnum.MISSING_UUID_DATA || !syncRecord.recordUuid) {
                        continue; // ignoriramo tako napako zaenkrat
                    }
                    await this.singleSyncProcessSuccess(syncRecord, entityName, syncRecord.recordUuid, await (await this.getSyncDB()).table(entityName).get(syncRecord.recordUuid));
                }
                break;
            
            case SyncBatchSingleEntityStatusEnum.CONCURRENCY_PROBLEM:
                await this.processBatchSingleEntityErrorLogic(entityName, {}, uuidsToSync);
                break;
            case SyncBatchSingleEntityStatusEnum.FATAL_ERROR:
            default:
                /**
                 * Ker to spada v sekcijo totalne napake, bi rekel, da to v idealnem scenariju pomeni resetirati vse na stanje pred syncom.
                 * Ker zaenkrat FATAL_ERROR pomeni, da entiteta ne obstaja na BE -> ce pa bi naknadno dodali, bi se kasneje lahko popravilo, zato
                 * souporabimo obstojeco logiko, ki ze to naredi.
                 * 
                 * AMPAK potrebujemo posikati dodatne podatke:
                 *      -   record uuid
                 */
                for (let uuid of uuidsToSync) {
                    await this.syncStatusWithErrorsLogicCustomAutoMerge(
                        uuid,
                        entityName,
                        SyncLibraryNotificationEnum.UNKNOWN_ERROR,
                    );
                }

                // throw new Error(`#processBatchSingleEntitySuccessLogic->FATAL_ERROR not yet implemneted logic`);
                // To bi moralo zajeti logiko za:
                // - SyncBatchSingleEntityStatusEnum.FATAL_ERROR
                // - vse neprepoznane napake
                // @TODO: Potrebno dopolniti logiko za ERROR process!!!
                break;
        }
    }


    async startObjectEntitySyncProcessRefactored(entityName: string, data: any, objectUuid: string, delay_to_wait: number = 0, useSyncLibAutoMerge: boolean = true) {
        if (!(await this.doesTableExistInSyncDB(entityName))) {
            const syncDB = await this.getSyncDB();
            this.syncDB = await syncDB?.changeSchemaInstance(syncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });
        }
        // Naslednji dve vrstici sta NESMISELNI!!!! Mi pred klicem `startObjectEntitySyncProcessRefactored` ze shranimo podatek v SYNC, ali TEMP !!!!!!!!
        let entryFromSyncDB = await this.doestEntryExistInSyncDBTable(entityName, objectUuid);
        if (!entryFromSyncDB) {
            // dodajmo objekt v tabelo in takoj posljemo na B
            (await this.getSyncDB())?.table(entityName).put(prepareSyncEntryStructure(objectUuid, data, null, undefined, ChamberSyncObjectStatus.pending_sync, new Date()), objectUuid);
        } else if (!(entryFromSyncDB.objectStatus == ChamberSyncObjectStatus.synced || entryFromSyncDB.objectStatus == ChamberSyncObjectStatus.pending_sync)) {
            /**
             * Torej ta del bi se hipoteticno izvedel, ce bi mi hoteli pognati SYNC za nek objekt, ki je v statusu IN_SYNC, ali CONFLICTED
             * Ker pa bomo imeli eno drugo logiko, ki bo avtomatsko poiskali vse ustrezne entryje, se ta logika naceloma ne bi smela zgoditi!!!
             */
            throw new Error('I think this logic is already covered in AutoMergeWrapper.storeNewObject -- CONSIDER WHAT TO DO WITH THIS BLOCK OF LOGIC, because AutoMergeWrapper is not used ANYMORE!!!!');
        }

        //@warning Logiko ki prepreci sinhronizacijo ob shranjevanju ce imamo TEMP ali CONFLICT primer je urejen v `storeNewObject` funkciji. 
        // TODO: V main.ts bo potrebno narediti eno splosno funkcijo, ki bo namenjena za INSERt/UPDATE in ki bo posledicno naredila isto kot sedaj delam npr v `home-sync-clean` komponenti.

        const syncingDBreference = await this.getSyncingDB();
        if (!(await this.doesTableExistInDB(syncingDBreference, entityName))) {
            this.syncingDB = await syncingDBreference.changeSchemaInstance(syncingDBreference, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] })
        }

        /**
         * Trenutno se mi zdi kot, da mi manjka logika, da preveri ali v SYNCING_REFACTORED
         * ze obstaja ta record. Bi pa rekel, da je mogoce to bolj logika za "avtomatiko", ki
         * bo poiskala ustrezne objete za SYNC
         */

        await (await this.getSyncDB())!.table(entityName).where({ 'localUUID': objectUuid }).modify(
            (objectItem) => {
                // objectItem.status = ChamberSyncObjectStatus.in_sync;
                objectItem.objectStatus = ChamberSyncObjectStatus.in_sync;
            }
        );

        // Create object that we will send to BE -> it just so happens that structure is the same as entry in the SYNCING DB!
        const syncingDuplicate = createSyncingEntry(objectUuid, objectUuid, 0, SyncingObjectStatus.in_sync, new Date(), entryFromSyncDB);
        const syncingEntry = await (await this.getSyncingDB())?.table(entityName).put(syncingDuplicate, objectUuid);
        // throw new Error(`Just prevent further action so that I can test retry data`);

        const entityRecords = [syncingDuplicate].map((syncingItem: SyncingEntryI) => {
            return {
                localUUID: syncingItem.objectUuid,
                lastModified: syncingItem.data?.lastModified,
                // record: useSyncLibAutoMerge ? syncingItem.data?.record : convertUint8ArrayToObject(syncingItem.data?.record), //@warning `syncingItem.data.record` je tipa Uint8Array!!!
                record: syncingItem.data?.record,
            } as SyncChamberRecordStructure
            // } as SynchronizationSyncEntityDecodedRecord
        });

        const requestUuid = objectUuid; // uuidv4();


        // @ALERT: This call to BE should not be executed if there is no NETWORK!!!!!!!!!!
        let batchResponse = {};
        try {
            if (!isNaN(delay_to_wait) && delay_to_wait > 0) {
                await delay(delay_to_wait);
            }
            batchResponse = await this.sync_entity_record(getObjectNameToPathMapper('')[entityName], entityRecords[0], requestUuid).then(
                async (success) => await this.singleSyncProcessSuccess.apply(this, [success, entityName, requestUuid, entityRecords[0]]),
                async (error) => await this.singleSyncProcessError.apply(this, [error, entityName, objectUuid, requestUuid]),
            );
        }
        catch (exception) {
            this.consoleOutput.output(`This is errror in sync-entity worker ${JSON.stringify(exception)}`);
            batchResponse = {};
        }

        return batchResponse; // Ta await je pomojem nonsense!

    }



    /*********************CALLBACKS FOR SINGLE SYNC PROCESS*******************/
    /**
     * @description Ta funkcija je namenjena za uspesno zakljucen POST request v primeru `sync_entity_record` funkcije.
     * Ta funkcija deluje samo za enojen sync. Za batch primer, bo potrebno pripraviti nek drugi callback
     * @param success To je odgovor, ki bo tipa `SyncEntityResponse`
     * @param collectionName 
     * @param syncEntityRecord To je podatek, ki ga imamo ze preden posljemo zahtevo na BE!!!! 
     * (Je SyncChamberRecordStructure brez `objectStatus` vrednosti!!!). Ker je vazno le da imam CHANGES in RECORD podatek noter, vse ostalo se tako ali tako
     * na novo generira.
     */
    async singleSyncProcessSuccess(success: SyncEntityResponseI, collectionName: string, objectUuid: string, syncEntityRecord: SyncChamberRecordStructure) {
        // async singleSyncProcessSuccess(success: SyncEntityResponseI, collectionName: string, objectUuid: string, syncEntityRecord: SynchronizationSyncEntityDecodedRecord) {
        // if succeess cOMPLETE -> remove duplicatred entry from syncingDB and set entry in syncDB to SYNCED

        // const syncEntityResponseInstance = new SyncEntityResponse((success));
        const syncEntityResponseInstance = classTransformer.plainToInstance(SyncEntityResponse, success);

        this.consoleOutput.output(`Response received:`, success); // Posebej uporabno za debagiranje mockanih requestov.
        switch (syncEntityResponseInstance.status) {
            case SyncEntityStatusEnum.SUCCESS:
                //@description Scenarij, ko je vse ok
                // await this.syncStatusSuccessLogicCustomAutoMerge(objectUuid, syncEntityResponseInstance?.mergedData?.mergedDbObject, syncEntityRecord, collectionName);
                await this.syncStatusSuccessLogicCustomAutoMerge(objectUuid, syncEntityResponseInstance?.mergedData?.mergedDbObject, syncEntityRecord, collectionName, syncEntityResponseInstance.lastModified ?? new Date());
                // await this.syncStatusSuccessLogic(objectUuid, syncEntityResponseInstance?.mergedData?.mergedDbObject, syncEntityRecord, collectionName);
                const successEvent: SyncLibraryNotification = classTransformer.plainToClass(SyncLibraryNotification, { type: SyncLibraryNotificationEnum.BATCH_SINGLE_SYNC_SUCCESS, createdAt: new Date(), message: `Uspesno zakljucen sync ${objectUuid}`});
                await this.sendNewEventNotification(successEvent);
                break;
            case SyncEntityStatusEnum.CONFLICT:
                await this.syncStatusConflictLogic(objectUuid, collectionName, syncEntityResponseInstance.mergedData?.mergedDbObject, syncEntityResponseInstance.mergedData?.conflicts ? syncEntityResponseInstance.mergedData?.conflicts : []); // Ampak ce pride do tukaj, ne bi smelo biti dvoma da imamo vsaj prazen Array
                break;
            case SyncEntityStatusEnum.SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH: // Ta status se zaenkat nikoli ne poslje iz BE - ZATOREJ ga ne rabimo implementirati!
            case SyncEntityStatusEnum.ENTITY_DOES_NOT_EXIST:
            case SyncEntityStatusEnum.MISSING_REQUIRED_FIELDS:
            case SyncEntityStatusEnum.REPOSITORY_NOT_FOUND:
            case SyncEntityStatusEnum.UNKNOWN_ERROR:
            default:
                //@description V primeru, da dobimo nek status, ki ga nisem predpostavil
                //@description zaenkrat bom vse napake zdruzil pod to logiko
                await this.syncStatusWithErrorsLogicCustomAutoMerge(
                    objectUuid,
                    collectionName,
                    (syncEntityResponseInstance.status as unknown) as SyncLibraryNotificationEnum,
                );
                break;
        }
        return;
    }

    async syncStatusConflictLogic(objectUuid: string, collectionName: string, mergedData: any, conflicts: SyncConflictItemI[]): Promise<void> {
        // 1. preverimo ali tabela ze obstaja, ce ne jo je potrebno narediti
        const conflictEvent: SyncLibraryNotification = classTransformer.plainToClass(SyncLibraryNotification, { type: SyncLibraryNotificationEnum.CONFLICT, createdAt: new Date(), data: { 'something': 'nananaa' } });
        try {
            // Try-catch sem pustil noter samo zato, ker imamo opravka z workerjem in lahko pride do nejavljenih napak!
            await this.sendNewEventNotification(conflictEvent);
        } catch (exception) {
            this.consoleOutput.output(`Error while trying to send sendNewNotification via proxy inside syncStatusConflictLogic from sync-worker to main`, exception);
        }

        const syncConflictDB = await this.getSyncConflictDB();
        if (!syncConflictDB.tables.find(table => table.name == collectionName)) {
            // Dodajmo novo shemo
            this.syncConflictDB = await syncConflictDB.changeSchemaInstance(syncConflictDB, { [collectionName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME] });
        }

        // 2. pretvorimo conflict podatke v instanco
        const convertedConflicts: SyncConflictItem[] = classTransformer.plainToInstance(SyncConflictItem, conflicts);

        // 3. dodajmo vse podatke v conflict bazo
        const conflictSchemaObject: SyncConflictSchema = classTransformer.plainToClass(SyncConflictSchema, { objectUuid, record: mergedData, conflicts: convertedConflicts });

        const syncConfDB = await (await this.getSyncConflictDB()).table(collectionName).put(conflictSchemaObject, objectUuid);
        const syncEntryStatusConflicted = await (await this.getSyncDB()).table(collectionName).where({ 'localUUID': objectUuid }).modify(
            (obj: SyncChamberRecordStructure) => {
                obj.objectStatus = ChamberSyncObjectStatus.conflicted
            }
        ); // V tem primeru mora v sync bazi obstajati <collectionName> tabela, ker drugace ne bi uspeli izvesti sync procesa.
    }

    async syncStatusWithErrorsLogicCustomAutoMerge(objectUuid: string, collectionName: string, status: SyncLibraryNotificationEnum): Promise<any> {
        await this.sendNewEventNotification(
            {
                type: status,
                message: `Cannot synchronise object: ${objectUuid} for entity: ${collectionName}` // Predlagam, da za te primere poenostavimo podatke v isto stanje, da se ponovno poskusi posyncati. Vendar paziti je potrebno, da ce bi imeli ogromno takih primerov, bi lahko zasicilo hitrost knjiznice...
            } as SyncLibraryNotification
        );
        /**
         * Potrebno je ponastaviti podatke:
         *  -   izbrisimo podatek iz syncing
         *  -   preverimo ali imamo TEMP, ce ja, shranimo to kar je v TEMP v SYNC in nastavimo na pending_sync
         */
        const syncingDB = await this.getSyncingDB();
        if (await this.doesTableExistInDB(syncingDB, collectionName)) {
            await (await this.getSyncingDB()).table(collectionName).delete(objectUuid);
        }

        // const tempDB = await this.getSyncConflictDB(); // To je pomojem napaka in mora biti dejansko getTempDB()
        const tempDB = await this.getTempDB();
        let syncEntry: SyncChamberRecordStructure = await (await this.getSyncDB()).table(collectionName).get(objectUuid);
        syncEntry.objectStatus = ChamberSyncObjectStatus.pending_sync;
        const tempEntry: SyncChamberRecordStructure = await this.doesEntryExistInDB(tempDB, collectionName, objectUuid);
        if (tempEntry) {
            tempEntry.objectStatus = ChamberSyncObjectStatus.pending_sync;
            syncEntry = tempEntry;
            await (await this.getTempDB()).table(collectionName).delete(objectUuid);
        }

        await (await this.getSyncDB()).table(collectionName).put(syncEntry, objectUuid);
    }

    /**
     * 
     * @param objectUuid 
     * @param mergedData Podatek, ki ga BE vrne kot merged data
     * @param syncEntityChamberData FE Sync objekt, ki ga posljemo na BE. Tukaj ga imamo zato da lahko zdruzimo BE in FE objekt (Je SyncChamberRecordStructure 
     * brez `objectStatus` vrednosti!!!). Ker je vazno le da imam CHANGES in RECORD podatek noter, vse ostalo se tako ali tako na novo generira.
     * @param collectionName 
     */
    // async syncStatusSuccessLogicCustomAutoMerge(objectUuid: string, mergedData: any, syncEntityChamberData: SyncChamberRecordStructure, collectionName: string) {
    async syncStatusSuccessLogicCustomAutoMerge(objectUuid: string, mergedData: any, syncEntityChamberData: SyncChamberRecordStructure, collectionName: string, beLastModified: Date) {
        // async syncStatusSuccessLogicCustomAutoMerge(objectUuid: string, mergedData: any, syncEntityChamberData: SynchronizationSyncEntityDecodedRecord, collectionName: string) {
        // mergedData -> je podatek iz BE, ki je naceloma zdruzen ustrezno glede na poslane podatke. Torej mora biti to novi `sync` podatek.
        const newSyncChamberRecordData = cloneDeep(mergedData);

        // Logika, ki poskrbi, da se zdruzi TEMP podatke z novimi podatki
        const retrievedTempDB = await this.getTempDB();
        const tempEntry: SyncChamberRecordStructure = retrievedTempDB.tableExists(collectionName) ? await retrievedTempDB.table(collectionName).get(objectUuid) : undefined;

        if (tempEntry) { // Mislim, da tukaj imam se nekaj pomanjkljivosti -> predvsem to, da ne APLICIRAM sprememb med TEMP in MERGED DATA!!!!
            /**
             * Potrebno bo narediti sledece:
             * - narediti "merge" med prejetim podatkom in TEMP podatkom
             * - ?ce mogoce? poiskati "changes" in jih dodati v CHANGES tabelo -> to mislim da naredi ze `applyNewChangesToExistingSyncObject`
             * - shraniti novi podatek v SYNC in sele nato nastaviti SYNC podatek v `pending_sync` ali `synced`
             */

            /**
             * Tukaj bo potrebno kasneje predvideti kako in kaj. Ker trenutno se bo TEMP smatral kot MERGED podatek - ker naceloma v temp damo 
             * nekaj kar uporabnik predpostavlja, da bo normalno shranjeno, kar pomeni, da uporabniku predstavlja to LATEST podatek.
             * Lahko pa naredim dodatek, ki bi bil uporaben:
             * - izracunam `changes` med BE in TEMP
             * - dodam changes in nadaljujem s TEMP kot source of truth.
             */


            /**
             * To je HUDO NAROBE!!!
             * Kako trenutno deluje:
             * - poisce razlike med TEMP in BE podatki
             *  + TEMP podatki so dejansko najbolj zadnji podatki, ki jih je uporabnik zelel aplicirati
             *  + Ubistvu je to v osnovi dokaj pravilno, ce predpostavimo, da bomo na koncu uporabili to kar imamo v TEMP.
             *  + IMPROVEMENT: Lahko bi naredil tako, da ko imamo TEMP in BE, bi preveril razlike in poiskal KONFLIKT (ampak to potem privede do vprasanja, zakaj ne preverjam konflikta ob sharnjevanju)
             */
            const comparedChanges = this.syncLibAutoMerge.compareTwoObjects(tempEntry.record, mergedData).filter(
                this.syncLibAutoMerge.filterSyncRelatedOperations
            );
            const changesBetweenMergedAndTemp = { changes: comparedChanges, changesDatetime: new Date() } as SyncChamberRecordChangesStructure;
            // tempEntry.changes = newChanges;
            const conflictService = new ConflictService();
            let dataToInsert: SyncChamberRecordStructure = conflictService.prepareSyncRecordChamberStructure(
                objectUuid,
                tempEntry.record,
                // newChanges, // previous example of setting `changes` table
                changesBetweenMergedAndTemp.changes,
                tempEntry,
                ChamberSyncObjectStatus.pending_sync
            ) as SyncChamberRecordStructure;

            await (await this.getSyncDB()).table(collectionName).put(dataToInsert, objectUuid); // Popravimo obstojeci podatek
            await (retrievedTempDB.table(collectionName)).where({ 'localUUID': objectUuid }).delete(); // Odstranimo podatek iz TEMP    
        }
        else {

            /**
             * TODO: calculate diff between latest BE object and current SYNC entry
             * V tem scenariju pomeni, da nismo od zadnjega shranjevanja (pred sinhronizacijo)
             * nic spremenili. Kar pomeni, da kar dobimo iz BE, je tudi koncni podatek, ki ga 
             * moramo imeti shranjenega v shrambi. Razlika je samo to, da imamo mogoce CHANGES drugacen
             * in to moramo izracunati in dodati v CHANGES.
             */
            const comparedChanges = this.syncLibAutoMerge.compareTwoObjects(syncEntityChamberData.record, mergedData).filter(
                this.syncLibAutoMerge.filterSyncRelatedOperations
            );
            const changesBetweenFeAndBe = { changes: comparedChanges, changesDatetime: new Date() } as SyncChamberRecordChangesStructure;
            // tempEntry.changes = newChanges;

            let dataToInsert: SyncChamberRecordStructure = this.conflictService.prepareSyncRecordChamberStructure(
                objectUuid,
                // syncEntityChamberData.record,
                mergedData, // Moramo nastaviti podatek iz BE
                // newChanges, // previous example of setting `changes` table
                changesBetweenFeAndBe.changes,
                syncEntityChamberData,
                ChamberSyncObjectStatus.synced
            ) as SyncChamberRecordStructure;

            dataToInsert.lastModified = beLastModified;


            // await (await this.getSyncDB()!).table(collectionName).where({ 'localUUID': objectUuid }).modify(
            //     (objectItem: SyncEntryI) => {
            //         // objectItem.status = ChamberSyncObjectStatus.synced; // Po novem imamo `objectStatus` in ne 'status' polje
            //         objectItem.record = newSyncChamberRecordData
            //         objectItem.objectStatus = ChamberSyncObjectStatus.synced;
            //     }
            // );
            await (await this.getSyncDB()).table(collectionName).put(dataToInsert, objectUuid);

            // Ce uporabimo zgornjo kodo, je potem nesmiselno delati MODIFY, ce lahko od enkrat naredimo PUT, ki bo na novo shranil celoten objekt pod nek UUID
            // await (await this.getSyncDB()!).table(collectionName).where({ 'localUUID': objectUuid }).modify(
            //     (objectItem: SyncEntryI) => {
            //         // objectItem.status = ChamberSyncObjectStatus.synced; // Po novem imamo `objectStatus` in ne 'status' polje
            //         objectItem.record = newSyncChamberRecordData
            //         objectItem.objectStatus = ChamberSyncObjectStatus.synced;
            //     }
            // );
        }
        await (await this.getSyncingDB()).table(collectionName).where({ 'objectUuid': objectUuid }).delete();
    }

    async doesTableExistInSyncDB(syncTableName: string): Promise<boolean> {
        const syncEntityTableExists = (await this.getSyncDB())?.tables.find((table: Table) => table.name == syncTableName);  // ALI OBSTAJA sync entry za omenjen uuid (OD KJE TEBI UUID?)
        if (!syncEntityTableExists) {
            return false;
        }
        return true;
    }

    /**
     * 
     * @param db 
     * @param collectionName 
     * @param objectUuid 
     * @returns Vrne undefined ali objekt iz <collectionName> tabele znotraj <db> baze.
     */
    async doesEntryExistInDB(db: AppDB, collectionName: string, objectUuid: string): Promise<any> {
        if (!this.doesTableExistInDB(db, collectionName)) {
            return undefined;
        }

        const foundEntry = await db.table(collectionName).get(objectUuid);

        if (!foundEntry) {
            return undefined;
        }

        return foundEntry;

    }

    async doesTableExistInDB(database: AppDB, tableName: string): Promise<boolean> {
        const tableExists = database.tables.find((table: Table) => table.name == tableName);
        if (!tableExists) {
            return false;
        }
        return true;
    }

    async doestEntryExistInSyncDBTable(syncTableName: string, objectUuid: string): Promise<any> {
        if (!(await this.doesTableExistInSyncDB(syncTableName))) {
            // return false;
            return undefined;
        }
        const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid });
        if (await findSyncItems.count() == 0) {
            this.consoleOutput.output(`But this is sometging else`);
            // return false;
            return undefined;
        }

        const findSyncItem = await findSyncItems.first();

        if (!findSyncItem) {
            // return false;
            return undefined;
        }
        // return true;
        return findSyncItem;
    }


    async singleSyncProcessError(error: any, entityName: string, objectUuid: string, requestUuid: string): Promise<any> {
        // predpostavka -> Ce ERR_NETWORK -> zadeva ni bila poslana na BE -> v tem primeru, pobrisemo entry iz SyncingDB, da se bo kasneje se enkrat avtomatsko preneslo
        // predpostavka -> Ce ECONNABORTED -> med izvajanjeme je prislo do timeouta -> potreben retry da vidimo ali se je uspesno izvedlo ali ne.
        this.consoleOutput.output(`Napaka pri prenosu singleSyncProcessError`, error);
        // await delay(10000);

        // SPODNJI SCENARIJ, je malce dvoumen... Ce bomo imeli ze obstojec retry proces. Ima smisel, da ga pustimo in ga ne brisemo... NE- obstojec retry ne more obstajati, ker do tukaj ne uspelo priti.
        if (error.code === HttpErrorResponseEnum.ERR_NETWORK) {
            // remove entry from syncing
            // USE-CASE(ERR_NETWORK), ko nimamo dostopa do serverja DELUJE (in perfect scenario)
            // USE-CASE(ERR_BAD_RESPONSE), ko server vrne error -> torej da se izvede neka logika, ampak ker nismo ujeli te napake na BE, da response vrne kot error DELUJE (in perfect scenario)
            // throw new Error('Check what we need to do when ERR_NETWORK is given!');
            // return;

            //TODO: Odstrani delay-je
            // await delay(3000);
            this.syncingDB!.table(entityName).where({ 'objectUuid': objectUuid }).delete(); // Vedno je lahko le en entry za isti UUID, zato ne rabimo dodatnega filtriranja
            // Potrebno je vrniti SYNC podatek v 'pending_sync' stanje.
            // await delay(5000);
            await (await this.getSyncDB()).table(entityName).where({ 'localUUID': objectUuid }).modify((obj: SyncChamberRecordStructure) => { obj.objectStatus = ChamberSyncObjectStatus.pending_sync });

        } else if (error.code === SynchronizationSyncStatus.ECONNABORTED) {
            // start retry process -> in this case retry process == repeat check if request was executed after configured time
            const valueFromSyncingDB = await this.syncingDB?.table(entityName).where({ 'objectUuid': objectUuid }).filter((item: SyncingEntryI) => item.retries < 10)?.modify((item: SyncingEntryI) => item.status = SyncingObjectStatus.pending_retry);  // THIS SHOULD EXIST - since we do not proceed to send to BE without creating data in syncingDB
        } else if (error.code === HttpErrorResponseEnum.ERR_BAD_RESPONSE) {
            this.consoleOutput.output(`ERR_BAD_RESPONSE - TODO , missing implementation`);
            throw new Error('SYNC-entity-worker -> ERR_BAD_RESPONSE TODO implementation');
        }
    }
    /*************************************************************************/


    async finishSyncDBSetup() {
        this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.syncDB.finishSetup();
        this.syncDBChangeSubscription = this.syncChangeSubscription(this.syncDB);
        return this.syncDB;
    }

    async finishSyncingDBSetup() {
        this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
        await this.syncingDB.finishSetup();
        this.syncingDBChangeSubscription = this.syncingChangeSubscription(this.syncingDB);
    }

    async finishTempDBSetup() {
        this.tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
        await this.tempDB.finishSetup();
        this.tempDBChangeSubscription = this.tempChangeSubscription(this.tempDB);
    }

    async finishSyncConflictDBSetup() {
        this.syncConflictDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
        await this.syncConflictDB.finishSetup();
        this.syncConflictDBChangeSubscription = this.syncConflictChangeSubscription(this.syncConflictDB);
    }

    async setSyncDBAfterSchemaChange(entityName: string) {
        await this.syncDB?.changeSchemaInstance(this.syncDB!, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });
    }

    tempChangeSubscription(newDB: AppDB): Subscription {
        this.tempDBChangeSubscription?.unsubscribe();

        this.tempDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.syncingDB = newDB;
                    this.tempChangeSubscription(newDB!);
                }
            }
        )
        return this.tempDBChangeSubscription;
    }

    syncConflictChangeSubscription(newDB: AppDB): Subscription {
        this.syncConflictDBChangeSubscription?.unsubscribe();

        this.syncConflictDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: async (newDB) => {
                    this.syncConflictDB = newDB;
                    this.syncConflictChangeSubscription(newDB!);
                    // await this.notifyMainAboutDBChange('conflict', newDB.verno / 10); // verzija po novem ni vec potrebna!
                    await this.sendNewEventNotification({
                        type: SyncLibraryNotificationEnum.DATABASE_CHANGE,
                        message: 'Spreminjam database (conflict)',
                        data: { dbName: 'conflict', version: newDB.verno / 10 },
                        error: null,
                    } as SyncLibraryNotification)
                }
            }
        )
        return this.syncConflictDBChangeSubscription;
    }

    syncingChangeSubscription(newDB: AppDB): Subscription {
        this.syncingDBChangeSubscription?.unsubscribe();

        this.syncingDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.syncingDB = newDB;
                    this.syncingChangeSubscription(newDB!);
                }
            }
        )
        return this.syncingDBChangeSubscription;
    }

    syncChangeSubscription(newDB: AppDB): Subscription {
        this.syncDBChangeSubscription?.unsubscribe();

        this.syncDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.syncDB = newDB;
                    this.syncChangeSubscription(newDB!);
                }
            }
        )
        return this.syncDBChangeSubscription;
    }


    async getSyncDB(): Promise<AppDB> {
        if (!this.syncDB?.isOpen()) {
            // open database
            await this.finishSyncDBSetup();
        }
        // To bo sigurno ok, ker finishSyncDBSetup poskrbi, da se sigurno ustvari nova instanca
        return this.syncDB!;
    }

    async getSyncingDB(): Promise<AppDB> {
        if (!this.syncingDB?.isOpen()) {
            // open database
            await this.finishSyncingDBSetup();
        }
        return this.syncingDB!;
    }

    async getTempDB(): Promise<AppDB> {
        if (!this.tempDB?.isOpen()) {
            // open database
            await this.finishTempDBSetup();
        }
        return this.tempDB!;
    }

    async getSyncConflictDB(): Promise<AppDB> {
        if (!this.syncConflictDB?.isOpen()) {
            // open database
            await this.finishSyncConflictDBSetup();
        }
        return this.syncConflictDB!;
    }

    public async changeNetworkStatus(newStatus: NetworkStatusEnum) {
        this.networkStatus = newStatus;
        if (newStatus === NetworkStatusEnum.OFFLINE) {
            // close source
            this.consoleOutput.output(`We close event source`);
            this.eventSourceService?.closeEventSource();
        } else {
            this.consoleOutput.output(`We open event source`);
            this.eventSourceService?.openEventSource();
        }
    }

    public async changeAgentId(newAgentId: string): Promise<void> {
        this.agentId = newAgentId;
        return;
    }
}

Comlink.expose(SyncEntityClean);