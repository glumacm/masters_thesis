import * as Comlink from 'comlink';
import { v4 as uuidv4 } from 'uuid'
import Dexie, { Collection, PromiseExtended, Table } from 'dexie';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, DATABASE_TABLES_SCHEMA_MAPPER } from '../../configuration';
import { HttpErrorResponseEnum, ResponseMessageType, SynchronizationSyncStatus } from '../../enums/sync-process.enum';
import { RetryManagementWorkerData } from '../../interfaces/retry-sync.interfaces';
import { ResponseMessage, SynchronizationPostData, SynchronizationSyncedObject, SynchronizationSyncEntityDecodedRecord, SynchronizationSyncEntityPostData, SynchronizationSyncEntityRecord, SynchronizationSyncResponse } from '../../interfaces/sync-process.interfaces';
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from '../../interfaces/sync-storage.interfaces';
import { getObjectNameToPathMapper } from '../../services/configuration';
import { AppDB } from '../../services/db';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import * as classTransformer from 'class-transformer';
import * as Automerge from '@automerge/automerge';





import { delay, findRejectedItems } from '../../utilities/worker-utilities';
import { first, firstValueFrom, Observer, of, Subscription } from 'rxjs';
import { createRetryEntry, createSyncingEntry, SyncEntryI, SyncingEntryI, SyncingObjectStatus } from '../retry/utilities';
import { prepareSyncEntryStructure } from '../../utilities/sync-entity-utilities';
import axios, { AxiosResponse } from 'axios';
import { SyncEntityResponseI } from '../../interfaces/sync/sync-entity-response.interface';
import { SyncEntityResponse } from '../../models/sync/sync-entity-response.model';
import { SyncEntityStatusEnum } from '../../enums/sync/sync-entity-status.enum';
import { applyNewChangesToExistingSyncObject, cloneSyncObjectWithEncoded, convertAutomergeDocToObject, convertAutomergeDocToUint8Array, convertObjectToAutomergeDoc, convertUint8ArrayToObject, getChangesBetweenObjectAndExistingDoc, mergeTwoAutoMergeDocs } from '../../utilities/automerge-utilities';
import { SyncConflictItemI } from '../../interfaces/sync/sync-conflict-item.interface';
import { SyncConflictItem } from '../../models/sync/sync-conflict-item.model';
import { SyncConflictSchema } from '../../models/sync/sync-conflict-schema.model';
import { SyncLibraryNotification } from '../../models/event/sync-library-notification.model';
import { SyncLibraryNotificationEnum } from '../../enums/event/sync-library-notification-type.enum';
import { cloneDeep } from 'lodash';
import { SyncLibAutoMerge } from '../../services/automerge-service';
import { ConflictService } from '../../services/conflict-service';

// type ResponseTest<T> = Promise<AxiosResponse<|SyncEntityResponse2I<T>>>;
export class SyncEntity {
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

    // external services

    private sentryCaptureMessage: any;
    private autoMergeWrapperGetDataFromEncodedRecord: Comlink.ProxyOrClone<any>;
    private sendNewEventNotification: any; // sendNewEventNotification -> funkcija, ki posreduje nek SyncLibraryNotification event v Subject, na katerega se lahko developerji `narocijo`.

    /**
     * Vse funkcije ki jih bom rabil kot dependencije
     */
    public dependencies: any | Comlink.ProxyOrClone<any>;

    /**
     * 
     * @param externalDependencies Vse funkcije, ki ji zelim uporabiti znotraj workerja
     */
    constructor(
        public externalDependencies: any | Comlink.ProxyOrClone<any>,
    ) {
        this.consoleOutput = new CustomConsoleOutput('SyncEntityWorker', CONSOLE_STYLE.sync_entity_worker);
        this.consoleOutput.output(`Bo zmeraj vesel`);
        this.syncLibAutoMerge = new SyncLibAutoMerge();
        this.setDependencies(externalDependencies);
    }

    public async callDependency1(dependencyName: string, fnName: string, args: any[] | undefined) {
        if (this.dependencies[dependencyName]) {
            return this.dependencies[dependencyName][fnName].apply(args);
        }
        return null;
    }


    /**
     * WARNING: if there are some problems when sending data , maybe it is because of `THIS` object, which is probably not binded correctly to proxied function sync_entity_records_batch.
     * @param path 
     * @param entityRecords 
     * @param requestUuid 
     * @returns 
     */
    public async sync_entity_records_batch4(path: string, entityRecords: any, requestUuid: string, succCal: any, errCal: any) { //getObjectNameToPathMapper('')[entityName], entityRecords, requestUuid)
        if (this.dependencies?.['sync_entity_records_batch']) {
            console.log('Ja to pa dela');
            return this.dependencies.sync_entity_records_batch.apply(this, [path, entityRecords, requestUuid, succCal, errCal]);
        }
        return Error('Function does not exist');
    }



    public setDependencies(dependencies: any | Comlink.ProxyOrClone<any>) {
        this.dependencies = dependencies;

        this.sentryCaptureMessage = dependencies.sentryCaptureMessage;

        this.autoMergeWrapperGetDataFromEncodedRecord = dependencies.autoMergeWrapperGetDataFromEncodedRecord;

        /**
         * Pricakujemo, da bomo v sendNewEventNotification funkcijo poslali event tipa: SyncLibraryNotification
         */
        this.sendNewEventNotification = dependencies.sendNewEventNotification;




        //         autoMergeConvertDecodedRecord: 
        // autoMergeConvertDocToObject: th
    }


    public async sync_entity_record(
        entityName: string,
        // record: SynchronizationSyncEntityDecodedRecord,  // Podatek kot ga imamo v FE `sync` bazi 
        record: any,  // Podatek kot ga imamo v FE `sync` bazi 
        requestUuid: string,
    ): Promise<any> {
        // ): Promise<SyncEntityResponse2I<TheTest>> {
        // Convert with automerge
        // Problem imamo s funkcijo, ki pretvori podatke iz automerga - Po vsej verjetnosti zato, ker referenca na funkcijo je neka funkcija znotraj AutoMergeWrapper razreda, ki vsebuje promise.
        console.log(`KAJ PA TA PRAVI:  ${JSON.stringify(record.record)}`);
        // const convertedRecord = convertAutomergeDocToObject(record.record);  //@warning Moramo imeti eno funkcijo ki vraca samo objekte, ker Proxy ne more prenesti instanco celotnega razreda, zato moram imeti ENO funkcijo, ki vrne le objekt
        // this.consoleOutput.output(`A to pa gre a ne`, convertedRecord)

        // const convertedRecord = await this.autoMergeConvertDocToObject(convertedToDoc);
        // console.log(JSON.stringify(convertedRecord));

        return axios.post(
            encodeURI(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}/${entityName}/${requestUuid}`),
            record.record,
            // convertedRecord,
            // {
            //     responseType: 'json',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     }
            // }
        ).then(
            (success) => {
                console.log('#Success in sync_entity_record POST request');
                console.log(success);

                return success.data;

            },
            (error) => {
                console.log('#Error in sync_entity_record POST request');
                console.log(error);

                return error;
            }
        );
    }

    /**
     * Funkcija, ki se bo uporabljala za INTERVALNE SYNCE
     * @param entityName 
     * @param records 
     * @param requestUuid 
     * @returns 
     */
    public sync_entity_records_batch(
        entityName: string,
        records: SynchronizationSyncEntityRecord[],
        requestUuid: string,
    ): Promise<any> {

        // Zaenkrat bom ustvaril avtomatsko uuid ob vstopu v funkcijo. Kasneje je potrebno videti, ali bo to potrebno poslati kot del argumentov
        const consoleOutput = new CustomConsoleOutput('sync_entity_records_batch', CONSOLE_STYLE.promise_success!);
        const jobUuid = requestUuid;
        const dataToSync = { entityName, jobUuid, data: records } as SynchronizationSyncEntityPostData;
        consoleOutput.output('STARTED EXECUTING `sync_entity_records_batch` function', {});
        consoleOutput.closeGroup();
        // return firstValueFrom(of({}));

        // Primer klica, ki je klical star `/api/sync-entity` api klic. -> Od dne 25.2.2023 uporabljam endopint `api/refactored/sync-merging/{entity_name}`
        // return axios.post(
        //   `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}`,
        //   dataToSync,
        //   {
        //     timeout: 1000, // Za testiranje scenarija, ko pride do timeouta
        //   }
        // );

        return axios.post(
            `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}/${entityName}`,
            dataToSync,
            {
                timeout: 1000, // Za testiranje scenarija, ko pride do timeouta
            }
        );
    }

    async initDatabases() {

        // this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME);
        // this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
        this.retryDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME);


        // await this.syncDB.finishSetup();
        // await this.syncingDB.finishSetup();
        await this.retryDB.finishSetup();

        await this.finishSyncDBSetup(); // this creates instance for db and sets listener for never versions of the database
        await this.finishSyncingDBSetup(); // this creates instance for db and sets listener for never versions of the database
        await this.finishTempDBSetup();
        await this.finishSyncConflictDBSetup();

    }

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
        this.syncConflictDBChangeSubscription = this.tempChangeSubscription(this.syncConflictDB);
    }

    async setSyncDBAfterSchemaChange(entityName: string) {
        // this.syncDB = await AppDB.changeSchema(this.syncDB!, {[entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]});
        // this.syncDB = await this.syncDB?.changeSchemaInstance(this.syncDB!, {[entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]});
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
                next: (newDB) => {
                    this.syncConflictDB = newDB;
                    this.syncConflictChangeSubscription(newDB!);
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

    async startObjectEntitySyncProcessRefactored(entityName: string, data: any, objectUuid: string, delay_to_wait: number = 0, useSyncLibAutoMerge: boolean = true) {
        const getSingleSyncEntry = async (entityName: string, objectUuid: string): Promise<SyncChamberRecordStructure> => {
            return await (await this.getSyncDB())!.table(entityName).get(objectUuid);
        }

        this.consoleOutput.output(`What is going on in REFACTOREED`, { entityName, data, objectUuid });


        if (!(await this.doesTableExistInSyncDB(entityName))) {
            const syncDB = await this.getSyncDB();
            // changeSchemaInstance allows us to return changed DB and to notify all databases that are pointing to this DB.
            this.syncDB = await syncDB?.changeSchemaInstance(syncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });


        }
        // Naslednji dve vrstici sta NESMISELNI!!!! Mi pred klicem `startObjectEntitySyncProcessRefactored` ze shranimo podatek v SYNC, ali TEMP !!!!!!!!
        let entryFromSyncDB = await this.doestEntryExistInSyncDBTable(entityName, objectUuid);
        if (!entryFromSyncDB) {
            // dodajmo objekt v tabelo in takoj posljemo na B
            (await this.getSyncDB())?.table(entityName).put(prepareSyncEntryStructure(objectUuid, data, null, undefined, ChamberSyncObjectStatus.pending_sync, new Date()), objectUuid);
        } else if (!(entryFromSyncDB.objectStatus == ChamberSyncObjectStatus.synced || entryFromSyncDB.objectStatus == ChamberSyncObjectStatus.pending_sync)) {
            throw new Error('I think this logic is already covered in AutoMergeWrapper.storeNewObject -- CONSIDER WHAT TO DO WITH THIS BLOCK OF LOGIC!!!!');
            /**
             * 1. Ce objekt v bazi ima status razlicen od `synced` ali `pending_sync`, potem mormao zakljuciti izvajanje, ker podatek se ocitno v ozadju se vedno izvaja.
             * 2. Potrebno je nastaviti podatke za TEMP, ker novi podatki bodo morali biti kasneje nastavljeni - ko retry/ali sync zakljuci delovanje.
             * 
             * TODO: Preveri NOTION board za `sync-entity.worker→startObjectEntitySyncProcess`
             */

            // TODO: Missing implementation
            //check if eneity exists in temp DB
            if (!(await this.doesTableExistInDB(await this.getTempDB(), entityName))) {
                this.consoleOutput.output(`GOing to add entity: ${entityName} to TEMP DB.`);
                this.tempDB = await this.tempDB?.changeSchemaInstance(await this.getTempDB(), { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] })
            }
            this.consoleOutput.output(`GOing to add entity: ${entityName} to TEMP DB with UUID: ${objectUuid}`);
            (await this.getTempDB()).table(entityName).put(entryFromSyncDB, objectUuid);
            return;
        }

        //@warning Logiko ki prepreci sinhronizacijo ob shranjevanju ce imamo TEMP ali CONFLICT primer je urejen v `storeNewObject` funkciji. 
        // TODO: V main.ts bo potrebno narediti eno splosno funkcijo, ki bo namenjena za INSERt/UPDATE in ki bo posledicno naredila isto kot sedaj delam npr v `home-sync-clean` komponenti.

        const syncingDBreference = await this.getSyncingDB();
        if (!(await this.doesTableExistInDB(syncingDBreference, entityName))) {
            this.syncingDB = await syncingDBreference.changeSchemaInstance(syncingDBreference, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] })
        }

        const doesEntryExistCollection: Collection<SyncingEntryI> = (await this.getSyncingDB())!.table(entityName).where({ 'objectUuid': objectUuid });
        const doesEntryExist: SyncingEntryI | undefined = await doesEntryExistCollection.first();

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
                record: useSyncLibAutoMerge ? syncingItem.data?.record : convertUint8ArrayToObject(syncingItem.data?.record), //@warning `syncingItem.data.record` je tipa Uint8Array!!!
                // } as SyncChamberRecordStructure
            } as SynchronizationSyncEntityDecodedRecord
        });

        const requestUuid = objectUuid; // uuidv4();


        // @ALERT: This call to BE should not be executed if there is no NETWORK!!!!!!!!!!
        let batchResponse = {};
        try {
            this.consoleOutput.output(`Back in the 90s!!!!!`);
            // this.sendNewEventNotification(classTransformer.plainToClass(SyncLibraryNotification, {type: SyncLibraryNotificationEnum.UNKNOWN_TYPE, createdAt: new Date(), message: 'Before I run sync_entity_record axios func.'} as SyncLibraryNotification))
            if (!isNaN(delay_to_wait) && delay_to_wait > 0) {
                this.consoleOutput.output(`Delay is about to execute`);
                await delay(delay_to_wait);
            }
            batchResponse = await this.sync_entity_record(getObjectNameToPathMapper('')[entityName], entityRecords[0], requestUuid).then(
                async (success) => await this.singleSyncProcessSuccess.apply(this, [success, entityName, requestUuid, entityRecords[0]]),
                // async (success: SyncEntityResponse2I<TheTest>) => await this.singleSyncProcessSuccessFake.apply(this, [success]),
                async (error) => await this.singleSyncProcessError.apply(this, [error, entityName, objectUuid, requestUuid]),
            );
        }
        catch (exception) {
            this.consoleOutput.output(`This is errror in sync-entity worker ${JSON.stringify(exception)}`);
            batchResponse = {};
        }
        this.consoleOutput.output(`This is what we get from BE - mora se zgoditi napaka, ker trenutno ne pozna BE te entitete`, batchResponse);


        return batchResponse; // Ta await je pomojem nonsense!

    }

    async startObjectEntitySyncProcess(entityName: string, objectUuid: string) {
        // we could actually switch logic from main.ts to here
        /** 
         * Predpostavke: ce syncDB nima entry-ja za objectUuid, potem zakljucimo, 
         * ce syncDB ima entry in ce istega entryja nimamo v syncing DB potem zacnemo 
         * sync process. Predpostavljamo, da ko enkrat izvedemo sync proces, se entry 
         * za objectUuid iz syncingDB pobrise!!!!
         * 
         * Zakaj taka logika???
         * - zakaj samo uuid posljemo in ne tudi objekta?
         * - zakaj je mogoc le UPDATE in ne tudi INSERT?
         * - 
         */

        const canProceedWithSingleSyncProcess = async (entityName: string, objectUuid: string): Promise<any | undefined> => {
            const syncTableName = entityName;
            const syncEntityTableExists = this.syncDB?.tables.find((table: Table) => table.name == syncTableName);  // ALI OBSTAJA sync entry za omenjen uuid (OD KJE TEBI UUID?)

            // *************************** Check conditions for SYNC DB ***************************
            if (!syncEntityTableExists) {
                this.consoleOutput.output(`Cannot continue startSyncEntityObject since ${entityName} does not exist in ${CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME}`);
                return undefined;
            }
            this.consoleOutput.output(`${ChamberSyncObjectStatus.pending_sync}`);
            const findSyncItem = await this.syncDB!.table(syncTableName).where({ 'localUUID': objectUuid }).filter((item) => item.status == ChamberSyncObjectStatus.pending_sync || item.status == ChamberSyncObjectStatus.synced).first();

            if (!findSyncItem) {
                this.consoleOutput.output(`Item with uuid: ${objectUuid} does not exist in ${CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME} db.`);
                return undefined;
            }

            const syncingTableName = entityName; // CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME + entityName;
            const entityTableExists = await this.syncingDB?.tables.find((table: Table) => table.name == syncingTableName);

            if (!entityTableExists) {
                this.consoleOutput.output(`Table for : ${syncingTableName} does not exist. Will finish execution`);
                return undefined;
            }
            // ************************************************************************************


            // *************************** Check conditions for SYNCING DB ***************************
            // const alreadySyncingItem = await this.syncingDB!.table(syncingTableName).where({ 'localUUID': objectUuid }).filter((item) => item.status == 'in_sync').first();
            this.consoleOutput.output('CHekc conditions for SYNCING DB');
            const alreadySyncingItem = await this.syncingDB!.table(syncingTableName).where({ 'objectUuid': objectUuid }).filter((item) => item.status == 'in_progress' || item.status == 'pending_retry').first(); // status == 'in_progress' | 'finished' | 'pending_retry'

            if (alreadySyncingItem) {
                this.consoleOutput.output('Item is already syncing (or in retry mode), will terminate current request.', alreadySyncingItem);
                return undefined;
            }

            return findSyncItem;
            // ***************************************************************************************

        }

        const getSingleSyncEntry = async (entityName: string, objectUuid: string): Promise<SyncChamberRecordStructure> => {
            return await this.syncDB!.table(entityName).get(objectUuid);
        }


        /////// CODE ABOVE SHOULD BE converted to a function, which will return ( <undefined> | <item from sync DB that matches this function arguments>)

        this.consoleOutput.output(`We can start new sync process, since no other items are in syncing DB for this object UUID: ${objectUuid}`);

        // @error -> Mislim, da je tu napaka. Ta logika dovoli le ce gre za UPDATE. Kaj pa ce bo INSERT???


        // everything ok, then we insert duplicate from syncDB to SYNCING DB and set status to in_sync in SYNCING DB.
        const syncingTableName = entityName;


        if (!(await this.doesTableExistInSyncDB(syncingTableName))) {
            // dodajmo tabelo v sync
            this.syncDB = await AppDB.changeSchema(this.syncDB!, { [syncingTableName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });
        }

        if (!(await this.doestEntryExistInSyncDBTable(syncingTableName, objectUuid))) {
            // dodajmo objekt v tabelo in takoj posljemo na BE
            throw new Error('We need to implement parent function to allow object data to be passed.... Currently UPDATE is only supported and even that is VAGUE description of supported');
            // this.syncDB?.table(syncingTableName).put(prepareSyncEntryStructure(null, null, null))
        }


        const entityAndObjectExist: boolean = await this.entityAndObjectExistInSyncDB(entityName, objectUuid); // findSyncItem;

        // To bi moralo biti DEPRECATED, ker ze zgoraj resimo zadevo s pomocjo this.doesTableExistInSyncDB in this.doestEntryExistInSyncDBTable
        // if (!entityAndObjectExist) {
        //     // @TODO!!! If !duplicate -> then we either do not have entry for sync, either table for syncing is missing!!!!
        //     this.consoleOutput.output(`Entry for ${objectUuid} in ${entityName} in syncDB does not either exist, or it does not exist in syncingDB`);
        //     this.consoleOutput.output(`Cannot start process for single entity sync, since there werre already some inadequate conditions in 'canProceedWithSingleSyncProcess' function.`);
        //     return;
        // }

        const entryFromSyncDB = await getSingleSyncEntry(entityName, objectUuid);
        entryFromSyncDB.objectStatus = ChamberSyncObjectStatus.in_sync;

        // FIRST CHECK IF EXISTS ANBD THEN GO fudge yourself!!!!!
        const doesEntryExist: SyncingEntryI = await this.syncingDB!.table(entityName).where({ 'objectUuid': objectUuid }).first();

        // If found entry is already pending retry or in_sync --> then do not proceed further
        if (doesEntryExist && (doesEntryExist.status == SyncingObjectStatus.pending_retry || doesEntryExist.status == SyncingObjectStatus.in_sync)) {
            // Close should not execute further
            this.consoleOutput.output(`This should be tterminated!!!!!!`);
            return;

        }

        // Create object that we will send to BE -> it just so happens that structure is the same as entry in the SYNCING DB!
        const syncingDuplicate = createSyncingEntry(objectUuid, objectUuid, 0, SyncingObjectStatus.in_sync, new Date(), entryFromSyncDB);

        // await this.syncingDB!.table(syncingTableName).put(duplicate, objectUuid)
        await this.syncingDB!.table(syncingTableName).put(syncingDuplicate);
        // const data = await this.syncEntityInstance?.startSyncProcess(entityName)
        this.consoleOutput.output('syincing item was added to table');



        // SEND data to BE
        // THIS PART IS NOT USED ANYWHERE! Maybe this is a missing implementation???
        const dataBE = {} as SynchronizationPostData;
        dataBE.class_name = getObjectNameToPathMapper('')[entityName];
        dataBE.last_db_modified = new Date();
        dataBE.object_data = {};
        // -------------------------------------------------- //



        const entityRecords = [syncingDuplicate].map((syncingItem: SyncingEntryI) => {
            return {
                localUUID: syncingItem.objectUuid,
                lastModified: syncingItem.data?.lastModified,
                record: syncingItem.data?.record,
            } as SynchronizationSyncEntityRecord
        });

        this.consoleOutput.output(`This is entityRecords data: `, entityRecords);

        const requestUuid = uuidv4();


        // @ALERT: This call to BE should not be executed if there is no NETWORK!!!!!!!!!!
        const batchResponse = await this.sync_entity_records_batch(getObjectNameToPathMapper('')[entityName], entityRecords, requestUuid).then(
            async (success) => await this.batchSyncProcessSuccess.apply(this, [success, entityName, entityRecords]),
            async (error) => await this.singleSyncProcessError.apply(this, [error, entityName, objectUuid, requestUuid]),
        );

        return await batchResponse;
    }


    /*********************CALLBACKS FOR SINGLE SYNC PROCESS*******************/
    /**
     * @description Ta funkcija je namenjena za uspesno zakljucen POST request v primeru `sync_entity_record` funkcije.
     * Ta funkcija deluje samo za enojen sync. Za batch primer, bo potrebno pripraviti nek drugi callback
     * @param success To je odgovor, ki bo tipa `SyncEntityResponse`
     * @param collectionName 
     * @param syncEntityRecord To je podatek, ki ga imamo ze preden posljemo zahtevo na BE!!!!
     */
    async singleSyncProcessSuccess(success: SyncEntityResponseI, collectionName: string, objectUuid: string, syncEntityRecord: SynchronizationSyncEntityDecodedRecord) {
        this.consoleOutput.output(`startObjectEntitySyncProcess -> Success can be: COMPLETE, ?PARTIAL? (i think not in this use-case, but in BULK use case), FAILED ALL'.`, success);
        // if succeess cOMPLETE -> remove duplicatred entry from syncingDB and set entry in syncDB to SYNCED
        this.consoleOutput.output(`Back to you TOM:`, success);
        this.consoleOutput.output(`Should she stay or should she go:`, syncEntityRecord);

        this.consoleOutput.output(`ja delovelo pa bile:`);


        // PRvo moramo predprocesirati `success` in ga pretvoriti v class instance

        // const syncEntityResponseInstance = new SyncEntityResponse((success));
        const syncEntityResponseInstance = classTransformer.plainToInstance(SyncEntityResponse, success);

        switch (syncEntityResponseInstance.status) {
            case SyncEntityStatusEnum.SUCCESS:
                //@description Scenarij, ko je vse ok
                await this.syncStatusSuccessLogicCustomAutoMerge(objectUuid, syncEntityResponseInstance?.mergedData?.mergedDbObject, syncEntityRecord, collectionName);
                // await this.syncStatusSuccessLogic(objectUuid, syncEntityResponseInstance?.mergedData?.mergedDbObject, syncEntityRecord, collectionName);
                break;
            case SyncEntityStatusEnum.CONFLICT:
                await this.syncStatusConflictLogic(objectUuid, collectionName, syncEntityResponseInstance.mergedData?.mergedDbObject, syncEntityResponseInstance.mergedData?.conflicts ? syncEntityResponseInstance.mergedData?.conflicts : []); // Ampak ce pride do tukaj, ne bi smelo biti dvoma da imamo vsaj prazen Array
                break;
            case SyncEntityStatusEnum.ENTITY_DOES_NOT_EXIST:
            case SyncEntityStatusEnum.MISSING_REQUIRED_FIELDS:
            case SyncEntityStatusEnum.REPOSITORY_NOT_FOUND:
            case SyncEntityStatusEnum.SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH:
            case SyncEntityStatusEnum.UNKNOWN_ERROR:
                //@description zaenkrat bom vse napake zdruzil pod to logiko
                break;
            default:
                //@description V primeru, da dobimo nek status, ki ga nisem predpostavil
                break;

        }
        this.consoleOutput.output(`Kako smo pretvorili`, syncEntityResponseInstance);

        // Potrebno je preveriti vse statuse, ker ceprav je to SUCCESS, se je lahko zgodilo vmes nekaj drugih primerov.


        return;
        //@ts-ignore
        const convertedData = success.data as ResponseMessage;
        if (convertedData?.data?.finishedSuccessfully.length == 1) { // Ker predpostavljamo, da ce naredimo single sync process, bomo dobili kot odgovor single entry v array-ju.
            // This part in perfect scenario works...
            const returnedRecord = convertedData.data.finishedSuccessfully[0];
            await (await this.getSyncDB()!).table(collectionName).where({ 'localUUID': returnedRecord.localUuid }).modify(
                (objectItem: SyncEntryI) => {
                    // objectItem.status = ChamberSyncObjectStatus.synced; // Po novem imamo `objectStatus` in ne 'status' polje
                    objectItem.objectStatus = ChamberSyncObjectStatus.synced
                }
            );
            await (await this.getSyncingDB()).table(collectionName).where({ 'objectUuid': returnedRecord.localUuid }).delete();
        } else {
            this.consoleOutput.output(`This is data of response`, convertedData);
            throw new Error('singleSyncProcessSuccess -> some use case we did not presume')
        }
        this.consoleOutput.output(`This is data of response`, convertedData);

    }

    async syncStatusConflictLogic(objectUuid: string, collectionName: string, mergedData: any, conflicts: SyncConflictItemI[]): Promise<void> {
        // 1. preverimo ali tabela ze obstaja, ce ne jo je potrebno narediti
        const conflictEvent: SyncLibraryNotification = classTransformer.plainToClass(SyncLibraryNotification, {type: SyncLibraryNotificationEnum.CONFLICT, createdAt: new Date(), data: {'something': 'nananaa'}});
        try{
            this.consoleOutput.output(`why cant we be friends  . . . `, conflictEvent);
            this.sendNewEventNotification(conflictEvent);
        }catch (exception) {
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
        const conflictSchemaObject: SyncConflictSchema = classTransformer.plainToClass(SyncConflictSchema, { objectUuid, record: mergedData, conflicts: convertedConflicts});
        const syncConfDB = (await this.getSyncConflictDB()).table(collectionName).put(conflictSchemaObject, objectUuid);


    }

    /**
     * 
     * @param objectUuid 
     * @param mergedData Podatek, ki ga BE vrne kot merged data
     * @param syncEntityChamberData FE Sync objekt, ki ga posljemo na BE. Tukaj ga imamo zato da lahko zdruzimo BE in FE objekt
     * @param collectionName 
     */
    async syncStatusSuccessLogicCustomAutoMerge(objectUuid: string, mergedData: any, syncEntityChamberData: SynchronizationSyncEntityDecodedRecord, collectionName: string) {
        // mergedData -> je podatek iz BE, ki je naceloma zdruzen ustrezno glede na poslane podatke. Torej mora biti to novi `sync` podatek.
        const newSyncChamberRecordData = cloneDeep(mergedData);

        // Logika, ki poskrbi, da se zdruzi TEMP podatke z novimi podatki
        const retrievedTempDB = await this.getTempDB();
        const tempEntry: SyncChamberRecordStructure = await retrievedTempDB.table(collectionName).get(objectUuid);

        if (tempEntry)
        {
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

            const changesBetweenMergedAndTemp = {changes: this.syncLibAutoMerge.compareTwoObjects(tempEntry.record, mergedData), changesDatetime: new Date()} as SyncChamberRecordChangesStructure;
            const newChanges = tempEntry.changes?.length > 0 ? [...tempEntry.changes, changesBetweenMergedAndTemp] : [changesBetweenMergedAndTemp];
            // tempEntry.changes = newChanges;
            const conflictService = new ConflictService();
            let dataToInsert: SyncChamberRecordStructure =  conflictService.prepareSyncRecordChamberStructure(
                objectUuid,
                tempEntry.record,
                // newChanges, // previous example of setting `changes` table
                changesBetweenMergedAndTemp.changes,
                tempEntry,
                ChamberSyncObjectStatus.pending_sync
            ) as SyncChamberRecordStructure;

            await (await this.getSyncDB()).table(collectionName).put(dataToInsert, objectUuid); // Popravimo obstojeci podatek
            await (retrievedTempDB.table(collectionName)).where({'localUUID': objectUuid}).delete(); // Odstranimo podatek iz TEMP    
        }
        else
        {

            //@description Ta logika zaenkrat deluje ce ni confliktov - ko bom zacel delati s konflikti, bo potrebno drugace speljati proces.
            // TODO: calculate diff between latest BE object and current SYNC entry
            await (await this.getSyncDB()!).table(collectionName).where({ 'localUUID': objectUuid }).modify(
                (objectItem: SyncEntryI) => {
                    // objectItem.status = ChamberSyncObjectStatus.synced; // Po novem imamo `objectStatus` in ne 'status' polje
                    objectItem.record = newSyncChamberRecordData
                    objectItem.objectStatus = ChamberSyncObjectStatus.synced;
                }
            );
        }
        await (await this.getSyncingDB()).table(collectionName).where({ 'objectUuid': objectUuid }).delete();
    }

    /**
     * 
     * @param objectUuid 
     * @param mergedData Podatek, ki ga BE vrne kot merged data
     * @param syncEntityChamberData FE Sync objekt, ki ga posljemo na BE. Tukaj ga imamo zato da lahko zdruzimo BE in FE objekt
     * @param collectionName 
     */
    async syncStatusSuccessLogic(objectUuid: string, mergedData: any, syncEntityChamberData: SynchronizationSyncEntityDecodedRecord, collectionName: string) {

        // prvo je potrebno mergedData pretvoriti v Automerge.doc
        const newAutomergeDoc = convertObjectToAutomergeDoc(mergedData);
        const mergedDataAsUint8Array = convertAutomergeDocToUint8Array(newAutomergeDoc);
        this.consoleOutput.output(`#syncSTatusSucessLogic prirpavljen automerge doc: `, newAutomergeDoc);
        this.consoleOutput.output(`#syncSTatusSucessLogic uint8array doc: `, mergedDataAsUint8Array);
        const mergedDocs = mergeTwoAutoMergeDocs(syncEntityChamberData.record, newAutomergeDoc);

        // TODO: Potrebno je dodati tudi logiko, ki bo upostevala TEMP bazo
        const retrievedTempDB = await this.getTempDB();
        const tempEntry = await retrievedTempDB.table(collectionName).get(objectUuid);

        if (tempEntry) {
            /**
             * Potrebno bo narediti sledece:
             * - narediti "merge" med prejetim podatkom in TEMP podatkom
             * - ?ce mogoce? poiskati "changes" in jih dodati v CHANGES tabelo -> to mislim da naredi ze `applyNewChangesToExistingSyncObject`
             * - shraniti novi podatek v SYNC in sele nato nastaviti SYNC podatek v `pending_sync` ali `synced`
             */
            const mergedDocsCloned = Automerge.clone(mergedDocs);
            const dataFromTemp = cloneSyncObjectWithEncoded(tempEntry as any) as SyncChamberRecordStructure; // TODO: Spremeniti tip ki ga damo v funkcijo in ki ga dobimo iz funkcije
            const mergeBetweenLatestDataAndTemp = mergeTwoAutoMergeDocs(mergedDocsCloned,dataFromTemp.record);
            const mergeReversed = mergeTwoAutoMergeDocs(dataFromTemp.record, mergedDocsCloned); // Ta bi moral vrniti drugacen MERGE kot zgornji merge....
            
            const objectData = mergedData; // To morajo biti podatki iz BE --> TO SO PODATKI IZ BE!!!!

            // po mojem bo potrebno pred applyNewChangesToExistingSyncObject narediti ze merge... Ali pa potrebuje applyNewChanges... cisto drugacno logiko!!!!
            // applyNewChangeToExistingSyncObject --> drugi objekt mora biti objekt, ki bo vseboval nazadnje mergane podatke -> v tem primeru je to MERGE med BE podatki in TEMP podatki!!!
            // const dataToInsert = getChangesBetweenObjectAndExistingDoc(objectUuid, objectData, dataFromTemp);
            const dataToInsert = getChangesBetweenObjectAndExistingDoc(objectUuid, mergeBetweenLatestDataAndTemp, mergedDocsCloned);
            if (dataToInsert.record) {
                dataToInsert.record = Automerge.save(dataToInsert.record); // Pretvorimo v Uint8Array
            }
            dataToInsert.objectStatus = ChamberSyncObjectStatus.pending_sync; // Ker smo ze nastavili nove podatke
            await (await this.getSyncDB()).table(collectionName).put(dataToInsert, objectUuid); // Popravimo obstojeci podatek
            await (retrievedTempDB.table(collectionName)).where({'localUUID': objectUuid}).delete(); // Odstranimo podatek iz TEMP
        } else {

            //@description Ta logika zaenkrat deluje ce ni confliktov - ko bom zacel delati s konflikti, bo potrebno drugace speljati proces.
            await (await this.getSyncDB()!).table(collectionName).where({ 'localUUID': objectUuid }).modify(
                (objectItem: SyncEntryI) => {
                    // objectItem.status = ChamberSyncObjectStatus.synced; // Po novem imamo `objectStatus` in ne 'status' polje
                    // + potrebno je povoziti record podatek s tem kar smo dobili iz BE, ampak prvo je potrebno to pretvoriti v Automerge.doc in nato uporabiti Automerge.save
                    objectItem.record = convertAutomergeDocToUint8Array(mergedDocs);
                    objectItem.objectStatus = ChamberSyncObjectStatus.synced;
                }
            );
        }
        await (await this.getSyncingDB()).table(collectionName).where({ 'objectUuid': objectUuid }).delete();
    }

    async batchSyncProcessSuccess(success: any, collectionName: string, entityRecords: any[]) {
        throw new Error(`#batchSyncProcessSuccess is not yet implemented!`);
    }

    async doesTableExistInSyncDB(syncTableName: string): Promise<boolean> {
        const syncEntityTableExists = (await this.getSyncDB())?.tables.find((table: Table) => table.name == syncTableName);  // ALI OBSTAJA sync entry za omenjen uuid (OD KJE TEBI UUID?)
        if (!syncEntityTableExists) {
            this.consoleOutput.output(`It is extremewly wierd that we do not have this entry for specified tabke and UUID!`);
            this.consoleOutput.output(`Cannot continue startSyncEntityObject since ${syncTableName} does not exist in ${CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME}`);
            return false;
        }
        return true;
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

        this.consoleOutput.output(`What is uuid: ${objectUuid} and what is table name: ${syncTableName}`);

        // const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid }).filter((item) => item.status == ChamberSyncObjectStatus.pending_sync || item.status == ChamberSyncObjectStatus.synced);
        // const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid }).filter((item) => item.objectStatus == ChamberSyncObjectStatus.pending_sync || item.objectStatus == ChamberSyncObjectStatus.synced);
        const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid });
        this.consoleOutput.output(`IS DATABASE SYNC OPEN: ${(await this.getSyncDB())?.isOpen()}`)
        if (await findSyncItems.count() == 0) {
            this.consoleOutput.output(`But this is sometging else`);
            // return false;
            return undefined;
        }

        this.consoleOutput.output(`This gets executed`);
        const findSyncItem = await findSyncItems.first();

        this.consoleOutput.output(`But after fetching first`, findSyncItem);
        if (!findSyncItem) {
            this.consoleOutput.output(`Item with uuid: ${objectUuid} does not exist in ${CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME} db.`);
            // return false;
            return undefined;
        }
        // return true;
        return findSyncItem;
    }

    /**
     * DEPRECATED
     * @param syncTableName 
     * @param objectUuid 
     * @returns 
     */
    async doestEntryExistInSyncDBTableDeprecated(syncTableName: string, objectUuid: string): Promise<boolean> {
        if (!(await this.doesTableExistInSyncDB(syncTableName))) {
            return false;
        }

        this.consoleOutput.output(`What is uuid: ${objectUuid} and what is table name: ${syncTableName}`);

        // const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid }).filter((item) => item.status == ChamberSyncObjectStatus.pending_sync || item.status == ChamberSyncObjectStatus.synced);
        const findSyncItems = (await this.getSyncDB())!.table(syncTableName).where({ 'localUUID': objectUuid }).filter((item) => item.objectStatus == ChamberSyncObjectStatus.pending_sync || item.objectStatus == ChamberSyncObjectStatus.synced);
        this.consoleOutput.output(`IS DATABASE SYNC OPEN: ${(await this.getSyncDB())?.isOpen()}`)
        if (await findSyncItems.count() == 0) {
            this.consoleOutput.output(`But this is sometging else`);
            return false;
        }

        this.consoleOutput.output(`This gets executed`);
        const findSyncItem = await findSyncItems.first();

        if (!findSyncItem) {
            this.consoleOutput.output(`Item with uuid: ${objectUuid} does not exist in ${CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME} db.`);
            return false;
        }
        return true;
    }

    async entityAndObjectExistInSyncDB(entityName: string, objectUuid: string): Promise<boolean> {
        if (!(await this.doesTableExistInSyncDB(entityName))) {
            return false;
        }
        if (!(await this.doestEntryExistInSyncDBTable(entityName, objectUuid))) {
            return false;
        }
        return true;
    }

    async singleSyncProcessError(error: any, entityName: string, objectUuid: string, requestUuid: string): Promise<any> {
        // predpostavka -> Ce ERR_NETWORK -> zadeva ni bila poslana na BE -> v tem primeru, pobrisemo entry iz SyncingDB, da se bo kasneje se enkrat avtomatsko preneslo
        // predpostavka -> Ce ECONNABORTED -> med izvajanjeme je prislo do timeouta -> potreben retry da vidimo ali se je uspesno izvedlo ali ne.
        this.consoleOutput.output(`Napaka pri prenosu singleSyncProcessError`, error);
        // await delay(10000);
        this.consoleOutput.output(`After delay is gone`);

        // SPODNJI SCENARIJ, je malce dvoumen... Ce bomo imeli ze obstojec retry proces. Ima smisel, da ga pustimo in ga ne brisemo... NE- obstojec retry ne more obstajati, ker do tukaj ne uspelo priti.
        if (error.code === HttpErrorResponseEnum.ERR_NETWORK) {
            // remove entry from syncing
            // USE-CASE(ERR_NETWORK), ko nimamo dostopa do serverja DELUJE (in perfect scenario)
            // USE-CASE(ERR_BAD_RESPONSE), ko server vrne error -> torej da se izvede neka logika, ampak ker nismo ujeli te napake na BE, da response vrne kot error DELUJE (in perfect scenario)
            // throw new Error('Check what we need to do when ERR_NETWORK is given!');
            // return;

            //TODO: Odstrani delay-je
            this.consoleOutput.output(`Will delete data for ${objectUuid} from table: ${entityName}`);
            await delay(3000);
            this.syncingDB!.table(entityName).where({ 'objectUuid': objectUuid }).delete(); // Vedno je lahko le en entry za isti UUID, zato ne rabimo dodatnega filtriranja
            // Potrebno je vrniti SYNC podatek v 'pending_sync' stanje.
            await delay(5000);
            await (await this.getSyncDB()).table(entityName).where({ 'localUUID': objectUuid }).modify((obj: SyncChamberRecordStructure) => { obj.objectStatus = ChamberSyncObjectStatus.pending_sync });

        } else if (error.code === SynchronizationSyncStatus.ECONNABORTED) {
            // start retry process -> in this case retry process == repeat check if request was executed after configured time
            const valueFromSyncingDB = await this.syncingDB?.table(entityName).where({ 'objectUuid': objectUuid }).filter((item: SyncingEntryI) => item.retries < 10)?.modify((item: SyncingEntryI) => item.status = SyncingObjectStatus.pending_retry);  // THIS SHOULD EXIST - since we do not proceed to send to BE without creating data in syncingDB
            this.consoleOutput.output('SHOW ME THE RESULT MODIFY number  ', valueFromSyncingDB);
            // OLD CODE
            // 1. check if entry exists if yes, increase counter
            // const retryEntry = createRetryEntry(objectUuid, requestUuid, 0);

            // this.consoleOutput.output(`This is retryEntry`, retryEntry);
            // this.syncingDB!.table(entityName).where({ 'localUUID': objectUuid }).delete(); // Vedno je lahko le en entry za isti UUID, zato ne rabimo dodatnega filtriranja
            // check if table exists
            // if (!this.retryDB?.tables.find((table) => table.name === entityName)) {
            //     this.consoleOutput.output(`created new table in retry DB : ${entityName}`);
            //     this.retryDB = await AppDB.changeSchema(this.retryDB!,{ [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME] });
            //     //database = await AppDB.changeSchema(database, {[CONFIGURATION_CONSTANTS.SYNC_RETRY_DB_PREFIX_STRING+receivedData.objectName]:'&requestUuid,status,retries,createdDatetime'});
            // }
            // await this.retryDB!.table(entityName).add(retryEntry, requestUuid);


        } else if (error.code === HttpErrorResponseEnum.ERR_BAD_RESPONSE) {
            this.consoleOutput.output(`ERR_BAD_RESPONSE - TODO , missing implementation`);
            throw new Error('SYNC-entity-worker -> ERR_BAD_RESPONSE TODO implementation');
        }
    }
    /*************************************************************************/






    // THIS IS BULK VERSION OF SYNC
    async startSyncProcess(objectName: string): Promise<any> { // THIS SHOULD BE USED FOR BULK version of sync













        if (!objectName || !this.syncDB) {
            return;
        }

        const collectionName = CONFIGURATION_CONSTANTS.SYNC_DB_PREFIX_STRING + objectName
        const responseData = createEmptyResponseData();



        /**
         * Proces sinhronizacije:
         * 
         * 1. poisci vse objekte, ki so za sync
         *  a. moramo tudi preveriti vse objekte, ki jih zelimo imeti shranjene v bazi?
         *  b. pomojem je dovolj, da se sprehodimo po tabelah.
         */


        const currentTables = this.syncDB!.tables;
        // const objectExistsInDatabase = check_if_object_name_exists(databaseInstance, SYNC_DB_PREFIX_STRING + objectName);

        // const map_records_to_tables = {}



        // Ce bomo poslali objectName='', se bo worker zakljucil preden pride do tega dela.
        const tablesForSync = findTablesForSync(currentTables, CONFIGURATION_CONSTANTS.SYNC_DB_PREFIX_STRING + objectName);

        // Poisci tabele in pripadajoce recorde, ki so pripravljeni za sync.
        // v trenutnem primeru, bo to delovalo le za eno tabelo, saj je trenutna ideja, da v objectName podamo ime entite in posledicno dobimo le podatke ene tabele.
        const mapRecordsToTables = await tablesForSync.reduce(mapRecordsToTablesReduceCallback,
            Promise.resolve({} as { [key: string]: SynchronizationSyncEntityRecord[] }),
        );

        // IF DATA EXISTS then process otherwise end worker logic

        if ((!mapRecordsToTables[CONFIGURATION_CONSTANTS.SYNC_DB_PREFIX_STRING + objectName]) || mapRecordsToTables[CONFIGURATION_CONSTANTS.SYNC_DB_PREFIX_STRING + objectName]?.length == 0) {
            // @explanation: if no data found for entity, we finish our work;
            console_log_with_style(`NOW this condition should be ok: ${collectionName}`, CONSOLE_STYLE.sync_entity_worker, mapRecordsToTables, 4);
            responseData.code = 0;
            responseData.status = SynchronizationSyncStatus.NO_ACTION;
            responseData.data = {};
            of(responseData);
        }

        // @explanaction: Before we start we need to put all found objects to 'in-sync' status
        console_log_with_style(`DO TUKAJ PRIDE`, CONSOLE_STYLE.sync_entity_worker, null, 4);
        const itemsUpdated = await this.syncDB.setStatusOnSyncItemsBasedOnStatus(collectionName, ChamberSyncObjectStatus.pending_sync, ChamberSyncObjectStatus.in_sync);

        if (!itemsUpdated) {
            console_log_with_style('ITEMS UPDATE FAILED', CONSOLE_STYLE.sync_entity_worker, '', 4); // TODO-LOG --> dodati ta zapis v LOG
            return;
        }

        // SEND data to BE
        const dataBE = {} as SynchronizationPostData;

        dataBE.class_name = getObjectNameToPathMapper('')[objectName];
        console_log_with_style('WHAT ABOUT NOW: ', CONSOLE_STYLE.sync_entity_worker, dataBE.class_name, 4);
        dataBE.last_db_modified = new Date();
        dataBE.object_data = {};

        const entityRecords = mapRecordsToTables[collectionName]


        const requestUuid = uuidv4();

        // @ALERT: This call to BE should not be executed if there is no NETWORK!!!!!!!!!!
        const batchResponse = await this.sync_entity_records_batch(getObjectNameToPathMapper('')[objectName], entityRecords, requestUuid).then(
            async (success) => await this.syncEntityRecordsBatchSuccess.apply(this, [success, collectionName, entityRecords]),
            async (error) => await this.syncEntityRecordsBatchError.apply(this, [error, objectName, collectionName, requestUuid])
        );

        return await batchResponse;
    }

    private async syncEntityRecordsBatchSuccess(success: any, collectionName: string, entityRecords: any[]): Promise<any> {
        const responseData = createEmptyResponseData();
        const response_data: ResponseMessage | undefined = success.data;
        console_log_with_style('WHERE IS THIS _ SUCCESS', CONSOLE_STYLE.sync_entity_worker, success, 4);
        /**
         * TODO: On success we need to mark data in CLIENT indexedDB(dexie) that data is synced
         * To pomeni, da bom moral iz BE dobiti odgovor o vseh recording/objektih, ki so bili posodobljeni/sinhronizirani.
         *  DONE -> narejeno tako, da posljem na BE seznam objektov ki vsebuje tudi localUUID in nato posljem nazaj seznam objektov (localUuid in lastModified), s katerim uredim zadnje zahteve.
         * 
         * Potrebno bo imeti predpripravljen seznam vsega kar smo poslali, da bom kasneje primerjal, kaj
         * je bilo popravljeno in kaj ne - v primeru, da se kaj ne bo posinchalo.
         *  -> ta seznam sem pripravil, mmanjka samo logika kako odreagirati, ko ne bom uspesen sync (delni ali popolni fail).
         * 
         */

        console_log_with_style('SOME PEOPLE LIVE JUST OT PLAy the game', CONSOLE_STYLE.sync_entity_worker, response_data?.type, 4);


        if (response_data?.type == ResponseMessageType.SUCCESS) {

            // start doing some specific work
            const sync_data: SynchronizationSyncResponse = response_data.data;
            console_log_with_style('WHAT IS SYNC STATUS:  ', CONSOLE_STYLE.sync_entity_worker, sync_data.syncStatus, 4);
            if (sync_data.syncStatus === SynchronizationSyncStatus.FAILED_ALL) {
                // START PROCESS RELATED TO synchronization failed
                console_log_with_style('SYNCHRONIZATION FAILED', CONSOLE_STYLE.sync_entity_worker, {}, 4);
                responseData.status = SynchronizationSyncStatus.FAILED_ALL;

            } else {

                { // first update all successful data;
                    // TODO: Add this logic to some function in `worker-utilities.ts`
                    sync_data.finishedSuccessfully?.forEach(
                        async (recordItem: SynchronizationSyncedObject, index: number) => {
                            /**
                             * TODO: Potrebno bo razmisliti, ali bom moral shranjevati v BULK mode-u, ki ga omogoca DEXIE.js!!!
                             */
                            console_log_with_style('BE item, that needs to be updated on FE: ', CONSOLE_STYLE.sync_entity_worker, recordItem, 4);
                            // find record that was successfully updated/inserted in BE in browser DB based on localUuid
                            // PREPOSTAVKA: Podatek mora obstajati, drugace localUuid ne bi mogel biti poslan na BE.
                            const recordItemInBrowserDB = await this.syncDB!.getItemByLocalUuid(collectionName, recordItem.localUuid);
                            // TODO: Premisliti, ali bomo lastModified podatek imeli vedno shranjenega v tem polju ali bomo to nekako dinamicno dobili iz neke konfiguracije?
                            recordItemInBrowserDB.record.lastModified = sync_data.finishedSuccessfully.find((record: SynchronizationSyncedObject) => record.localUuid == recordItem.localUuid)?.lastModified;
                            recordItemInBrowserDB.objectStatus = ChamberSyncObjectStatus.synced;
                            // Find key of record from browser DB which is linked to localUuid that is currently processed - because we need item key if we want to update data in browser DB
                            const itemKey = await this.syncDB!.getKeyByLocalUuid(collectionName, recordItem.localUuid);
                            const updateSuccess = this.syncDB!.updateItemFromTable(collectionName, itemKey, recordItemInBrowserDB); // return true|false, depending on success of update function
                            console_log_with_style(`WAS UPDATE FOR DATA ${recordItem.localUuid}, successfull: ${updateSuccess}`, CONSOLE_STYLE.sync_entity_worker, updateSuccess, 4);
                        }
                    )
                }

                { // // then filter array of sent data so that we have only rejected/failed objects so that we start another process
                    const rejectedItems = findRejectedItems(entityRecords, sync_data.finishedSuccessfully);
                    responseData.status = rejectedItems.length > 0 ? SynchronizationSyncStatus.PARTIAL : SynchronizationSyncStatus.COMPLETE;

                }


            }
        } else {
            // start some process for handling error
            responseData.code = 500;
            responseData.status = SynchronizationSyncStatus.FAILED_ALL;
            console_log_with_style(`WORKER-firstRealExample encountered an error with status error: ${response_data?.code}`, CONSOLE_STYLE.sync_entity_worker, response_data?.message, 4);
        }

        return responseData;
    }

    private async syncEntityRecordsBatchError(error: any, objectName: string, collectionName: string, requestUuid: string): Promise<any> {
        const responseData = createEmptyResponseData();
        /***
                     * If there is an error (like timeout) then we receive:
                     * { code="ECONNABORTED", ...}
                     */
        const itemsUpdated = await this.syncDB!.setStatusOnSyncItemsBasedOnStatus(collectionName, ChamberSyncObjectStatus.in_sync, ChamberSyncObjectStatus.pending_sync);
        console_log_with_style('ITEMS SHOULD BE NOW REVERTED BACK TO PENDING SYNC', CONSOLE_STYLE.sync_entity_worker, itemsUpdated, 4);
        console_log_with_style('SYNC PROCESS2323232 API CALL _ ERROR', CONSOLE_STYLE.sync_entity_worker, error, 4);
        console_log_with_style('WHERE IS THIS _ ERROR', CONSOLE_STYLE.sync_entity_worker, error, 4);
        if (error.code === SynchronizationSyncStatus.ECONNABORTED || error.code === SynchronizationSyncStatus.ERR_NETWORK) {
            responseData.code = 500;
            responseData.status = SynchronizationSyncStatus.ECONNABORTED;

            /**
             * Start retry process
             * - get data from constatnt - how many times can you do this
             *      -> but first, i would create new worker that will manage retry process
             *      because it will be easier to manage, execute and etc. stuff related to retry.
             * - after retry management is programmed, do not forget to prepare logic that will
             * check if retry process for object_name is in progress- or pending future executions! Maybe there will be some
             * logic/process flow to consider in that state.
             */


            // const retryManagement = new Worker(new URL('../retry/retry-sync-manager.worker', import.meta.url));
            // retryManagement.onmessage = (ev: MessageEvent) => {
            //     console_log_with_style('IF YOU CHOOSE MEEEE - entity sync worker - received data from retry management', CONSOLE_STYLE.sync_entity_worker, ev);
            // }
            // const dataForRetryManagement = {} as RetryManagementWorkerData;
            // dataForRetryManagement.objectName = objectName;
            // dataForRetryManagement.requestUuid = requestUuid;

            // retryManagement.postMessage(dataForRetryManagement);


        } else {
            responseData.code = 500;
            responseData.status = SynchronizationSyncStatus.FAILED_ALL;
        }
        /**
         * TODO: If error received from BE, we need to take care of some use cases:
         * - if last_modified not ok
         * - if some required fileds are missing
         * - if generic error
         */

        return responseData;
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
}




async function mapRecordsToTablesReduceCallback(accumulatorPromise: Promise<{ [key: string]: SynchronizationSyncEntityRecord[] }>, currentItem: Dexie.Table): Promise<{ [key: string]: SynchronizationSyncEntityRecord[] }> {
    const accumulator = await accumulatorPromise;
    const arrayOfRecordsToSync: any[] = await queryDataBasedOnObjectStatus(currentItem); // TODO: AFTER, revert status back to default!!!

    // Now convert each record to SynchronizationSyncEntityRecord -> so that we can send data to BE
    const syncRecordsStructure: SynchronizationSyncEntityRecord[] = arrayOfRecordsToSync.map(
        (recordItem: SyncChamberRecordStructure) => {
            // recordItem.record['id'] = 1;
            return {
                localUUID: recordItem.localUUID,
                record: { 'name': 'youknow112578', 'description': 'testdescriptionBiti89Now', 'id': '77' }, // recordItem.record,
                lastModified: new Date(),
            } as SynchronizationSyncEntityRecord
        }
    );

    // accumulator[currentItem.name] = await queryDataBasedOnObjectStatus(currentItem); // TODO: AFTER, revert status back to default!!!
    accumulator[currentItem.name] = syncRecordsStructure;
    return accumulator
}


function findTablesForSync(tables: Dexie.Table[], tablePrefix: string): Dexie.Table[] {
    return tables.filter(
        (table: Dexie.Table) => table.name.startsWith(tablePrefix)
    );
}

/**
 * 
 * @param table 
 * @param objectStatus 
 * @returns Array of records in IndexedDB.<table> where `objectStatus` === ChamberSyncObjectStatus.pending_sync
 */
function queryDataBasedOnObjectStatus(table: Dexie.Table, objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync): PromiseExtended<any> {
    // table.)
    return table.filter((obj) => obj.objectStatus == objectStatus).toArray();
}

function createEmptyResponseData() {
    return {
        code: 200, // 0 -> No action, 200 SUCCESS|COMPLETE, 500 Major ERROR
        status: SynchronizationSyncStatus.COMPLETE,
        data: {}
    };
}

Comlink.expose(SyncEntity);