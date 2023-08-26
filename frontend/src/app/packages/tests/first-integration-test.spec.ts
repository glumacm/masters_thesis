import { SynchronizationLibrary } from '../main';
import Dexie from 'dexie';
import { CONFIGURATION_CONSTANTS, OBJECT_NAME_TO_PATH_MAPPER } from '../configuration';
import { v4 as uuidv4 } from 'uuid'
import { ChamberSyncObjectStatus, SyncChamberRecordStructure, SyncTempChamberRecordStructure } from '../interfaces/sync-storage.interfaces';
import { CustomAxios, CustomAxiosMockedResponseEnum, MockedResponse } from '../services/custom-axios';
import { cloneDeep, merge } from 'lodash';
import { SyncEntityResponseI } from '../interfaces/sync/sync-entity-response.interface';
import { SyncEntityStatusEnum } from '../enums/sync/sync-entity-status.enum';
import { MergeProcessResultI } from '../interfaces/sync/merge-process-result.interface';
import { MergeProcessResult } from '../models/sync/merge-process-result.model';
import { delay } from '../utilities/worker-utilities';
import { SyncEntityResponse } from '../models/sync/sync-entity-response.model';
import { SyncBatchSingleEntityStatusEnum } from '../enums/sync/sync-batch-single-entity-status.enum';
import { SyncBatchSingleEntityResponse } from '../models/sync/sync-batch-single-entity-response.model';
import { SyncConflictItem } from '../models/sync/sync-conflict-item.model';
import { SyncConflictSchema } from '../models/sync/sync-conflict-schema.model';
import { ObjectStoredToTempError } from '../errors/object-stored-to-temp.error';
import { firstValueFrom } from 'rxjs';
import { SyncLibraryNotificationEnum } from '../enums/event/sync-library-notification-type.enum';
import { SyncLibraryNotification } from '../models/event/sync-library-notification.model';
import { plainToInstance } from 'class-transformer';
// import * as moxios from 'moxios';
// import moxios from 'moxios';

// import * as ama from 'axios-mock-adapter';
// import {stub, fakeServer} from 'sinon';
// import {staticAxios} from '../services/custom-axios';


/**
 * Zelo pomembne ugotovitve za poganjanje testov:
 * 
 * - AutoMerge knjiznica ne deluje v testih -> ?Se dobro? - da sem moral uporabiti svojo logiko za konflikte in spremembme itd. ker cene ne bi mogel pisati testov!
 * - Za mockanje/testiranje axios requestov na BE bom poskusil uporabiti knjiznico: `https://github.com/axios/moxios` --> zadeva ne more delovati, ker web worker naredi svojo "kopijo" axios default instance
 * - Paziti je potrebno, ali bo nastavitev `allowSyntheticDefaultImports: true` v TSCONFIG.ts pokvarilo delovanje knjiznice - ampak edino na tak nacin lahko zaenkrat pozenem moxios (za mockanje axiosa)
 * 
 * - PROBLEM: Iz testa ne bom mogel kar neko entiteto poimenovati, ker moram imeti mapping za entiteto (v PHP razred) v konfiguraciji `CONFIGURATION_CONSTANTS`.
 * 
 * - Ok, vidim da mi usoda ne da da bi zivel uspesno in veselo z zakljucenim magisterijem.....
 *  + NArediti bom moral custom logiko, da se bo "MOCKING" (za axios) izvedel znotraj web workerja. To pomeni, da bi lahko uporabil "axios.interceptors" znotraj web workerja 
 *  a preko proxyja bi posredoval objekt, ki bi definiral kaj zelim, da se zgodi in na podlagi tega bi delovala vsa logika...
 *      + mogoce bi posredoval nek objekt, naredil bi se nek "service", ki bi znal konzumirat objekt in ustrezno reagirati v interceptorju
 * 
 * - SynchronizationLibrary uporablja staticno instanco. TO je bilo dodano, da ce bi se kdaj knjiznica veckrat "inicializirala", da bi uporabilo obstojece mehanizme, da ne bi prislo do prepletanja podatkovnih baz
 * razlicnih instanc. TRENUTNO priporocam, da se v TESTIH instanco vedno nastavi na `undefined` preden se naredi novo instanco.
 */
describe('Integration tests for SynchronizationLibrary', () => {

    const testTableName = 'testing_table';

    const allDatabasesUsedInApp = [
        CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME,
        CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME,
        CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME,
        CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME,
        CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME,
        CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME,
    ];

    async function doesDBExist(databaseName: string): Promise<boolean> {
        return Dexie.exists(databaseName);
    }

    async function deleteDatabaseIfExists(databaseName: string): Promise<void> {
        await Dexie.delete(databaseName);
    }

    async function expectAllDatabasesTo(exist: boolean = false): Promise<void> {
        for (let dbName of allDatabasesUsedInApp) {
            // const dbExists = await doesDBExist(dbName);
            const dbExists = await Dexie.exists(dbName);
            expect(dbExists).toEqual(exist);
        }
    }

    function prepareResponseStructureWithDataForBatch(syncRecords: any[], status: SyncBatchSingleEntityStatusEnum = SyncBatchSingleEntityStatusEnum.COMPLETE_SUCCESS, statusCode: number = 200) {
        // Pripravim pricakovan response iz BE
        const batchDataFromBE = { syncRecords: syncRecords, status: status, createdAt: new Date() } as SyncBatchSingleEntityResponse;
        return { status: statusCode, response: batchDataFromBE as any } as any 
    }

    beforeAll(async () => {
    });

    beforeEach(async () => {
        /**
         * tukaj bo koda, ko se bo izvedla pred vsakim testom
         * 
         */


        // Pobrisemo vse baze pred vsakim testom - zato da vemo, da se vedno pravilno ponovno ustvarijo
        console.log('BEforeEach before delete tables');

        for (let dbName of allDatabasesUsedInApp) {
            await deleteDatabaseIfExists(dbName);
        }
        console.log('BEforeEach after delete tables');

        // vedno nastavim obstojeco instanco na undefined, drugace se ohranijo vrednosti med testi!!!!
        SynchronizationLibrary.existingInstance = undefined;
    });

    afterEach(async () => {
        /**
         * VELIK PROBLEM!!!! 
         * afterEach se izvede preden se zadnja logika testa izvfede!!!!!!
         */
        console.log('Kdaj se izvede afterEach');

    })

    it('#1 Test insert new object data to new table to SYNC DB', async () => {
        /**
         * Ta test preveri, da se nek objekt zapise v SYNC bazo s pending_sync statusom
         */
        console.log('SOMEWHERE');

        // Preverimo, da pred testom res nimamo nobene baze
        await expectAllDatabasesTo(false);

        const syncLibrary = new SynchronizationLibrary();
        await syncLibrary.finishSetup();


        // Preverimo, da so generirale vse baze (se zgodi znotraj inicializacije sinhronizacijske knjiznice)
        await expectAllDatabasesTo(true);
        const newUuid = uuidv4();

        const newObjectData = {
            'field1': 'Test field1',
            'field2': 'Test field2'
        };

        const newTable = testTableName;
        const storedData = await syncLibrary.storeNewObject(newTable, newUuid, newObjectData);

        expect(await doesDBExist(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME)).toEqual(true);

        const syncDB = await syncLibrary.getSyncDB();

        expect(syncDB.tableExists(newTable)).toEqual(true);
        // expect(storedData.record).toEqual(newObjectData);
        // expect(storedData.objectStatus).toEqual(ChamberSyncObjectStatus.pending_sync);

        const dataFromDB: SyncChamberRecordStructure = await syncDB.table(newTable).get(newUuid);

        expect(dataFromDB).toBeTruthy();
        expect(dataFromDB.record).toEqual(newObjectData);
        expect(dataFromDB.objectStatus).toEqual(ChamberSyncObjectStatus.pending_sync);
    });

    it('#2 should have test table defined in configuration', async () => {
        // expect(!!CONFIGURATION_CONSTANTS).toBeTruthy();
        
        expect(!!OBJECT_NAME_TO_PATH_MAPPER).toBeTruthy();
        expect(Object.keys(OBJECT_NAME_TO_PATH_MAPPER)).toContain(testTableName);
    });


    it('#3 should store and sync data (single record sync)', async () => {
        // Check that all databases are emoty before starting
        await expectAllDatabasesTo(false);

        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();


        // Preverimo, da so generirale vse baze (se zgodi znotraj inicializacije sinhronizacijske knjiznice)
        await expectAllDatabasesTo(true);
        const newUuid = uuidv4();

        // Data that will be stored to database before syncing
        const newObjectData = {
            'field1': 'Test field1',
            'field2': 'Test field2'
        };

        const mergedDataFromBE = cloneDeep(newObjectData);
        mergedDataFromBE.field1 = 'Different data';

        const dataFromBE = { conflicts: [], mergedDbObject: mergedDataFromBE } as MergeProcessResultI;


        // Prepare expected response from BE
        const justDontCareAtAll = { status: SyncEntityStatusEnum.SUCCESS, mergedData: dataFromBE, recordUuid: newUuid, error: undefined } as SyncEntityResponse;
        // syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, ({status: 200, response: {data: dataFromBE} as any} as any) as any);
        syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, ({ status: 200, response: justDontCareAtAll as any } as any) as any);
        // syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS,{ status: 200, response: { data: dataFromBE, status: 200, statusText: 'chase the', headers: {} as any, config: { headers: {} as any } as any } as any, data: dataFromBE, statusText: 'lived back in the days', headers: {}, config: { data: { 'its': 'intheway' } } as any } as any);

        // WARNING: We need to be careful that we have set mapping for passed entity in the CONFIGURATION
        const newTable = testTableName;
        const storedData = await syncLibrary.storeNewObject(newTable, newUuid, newObjectData);

        expect(await doesDBExist(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME)).toEqual(true);

        const syncDB = await syncLibrary.getSyncDB();

        expect(syncDB.tableExists(newTable)).toEqual(true);
        // expect(storedData.record).toEqual(newObjectData);


        /**
         * Here we have a HUGE problem, because ASYNC code does not wait.
         * That is because in main.ts we cannot wait for execution to finish, because we want the task to be executed in the "background". So we need  to
         * artifically create await in the test or we need to prepare such data that would be set from main.ts when calling the function.
         */
        // await syncLibrary.startSyncEntityObject(newTable, newUuid, storedData.record); --> This is not posible because it causes database locking... This is something I need to be careful about when I test automatic synchronisation.
        // await syncLibrary.syncEntityInstance?.startObjectEntitySyncProcessRefactored(newTable, storedData.record, newUuid); // starts background processing

        const afterSyncDB = await syncLibrary.getSyncDB();
        const data: SyncChamberRecordStructure = await afterSyncDB.getItemByLocalUuid(newTable, newUuid);


        expect(afterSyncDB.tableExists(newTable)).toEqual(true);
        expect(data.record).toEqual(justDontCareAtAll.mergedData?.mergedDbObject);

        //startSyncEntityObject(entityName: string, objectUuid: string, data: any = {}, delay_to_wait: number = 0, useSyncLibAutoMerge: boolean = true) 

    });


    it('#4 should store and sync data (batch sync)', async () => {
        // Preverimo, da pred testom res nimamo nobene baze
        await expectAllDatabasesTo(false);

        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();


        // Preverimo, da so generirale vse baze (se zgodi znotraj inicializacije sinhronizacijske knjiznice)
        await expectAllDatabasesTo(true);
        const newUuid = uuidv4();

        // podatek, ki ga bom shranil v bazo pred syncom
        const newObjectData = {
            'field1': 'Test field1',
            'field2': 'Test field2'
        };

        const mergedDataFromBE = cloneDeep(newObjectData);
        mergedDataFromBE.field1 = 'Different data';

        const dataFromBE = { conflicts: [], mergedDbObject: mergedDataFromBE } as MergeProcessResultI;

        // Pripravim pricakovan response iz BE
        // V tem primeru BE vrne drugacen response
        const justDontCareAtAll = { status: SyncEntityStatusEnum.SUCCESS as any, mergedData: dataFromBE, recordUuid: newUuid, error: undefined } as SyncEntityResponse;
        const batchDataFromBE = prepareResponseStructureWithDataForBatch([justDontCareAtAll], SyncBatchSingleEntityStatusEnum.COMPLETE_SUCCESS, 200);  //{ syncRecords: [justDontCareAtAll], status: SyncBatchSingleEntityStatusEnum.COMPLETE_SUCCESS, createdAt: new Date() } as SyncBatchSingleEntityResponse;
        // syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, ({ status: 200, response: batchDataFromBE as any } as any) as any);
        syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, (batchDataFromBE) as any);

        // POZOR: Paziti moramo, da imamo v CONFIGURATION nastavljen mapping za podano tabelo!!!
        const newTable = testTableName;
        const storedData = await syncLibrary.storeNewObject(newTable, newUuid, newObjectData);

        expect(await doesDBExist(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME)).toEqual(true);

        const syncDB = await syncLibrary.getSyncDB();

        expect(syncDB.tableExists(newTable)).toEqual(true);
        // expect(storedData.record).toEqual(newObjectData);


        /**
         * Tukaj imamo HUGE problem, ker se nekje ASYNC KODA NE pocaka.
         * To je zazto ,ker v main.ts ne moremo cakati na izvedbo, ce hocemo, da se v ozadju izvede zadeva. Torej moramo "umetno" v testu narediti await
         * Zaenkrta bom to resil tako, da bom kar direktno v testu poklical dolocene metode v sync threadu -> torej hipoteticno ne bom preko main.ts poganjal glavne logike -> POZOR, potrebno preveriti pred vsakim klicem
         * ali moram kaksne posebne podatke nastaviti, ki bi jih main.ts nastavil ob klicu.
         */
        // await syncLibrary.startSyncEntityObject(newTable, newUuid, storedData.record); --> tako ne moremo, ker pride do zaklepanja baze... na to je treba biti pozoren tudi, ko bom preizkusal samodejno sinhronizacijo
        await syncLibrary.syncEntityInstance?.startBatchSync(); // starts background processing as batch (multiple records for each entity)

        const afterSyncDB = await syncLibrary.getSyncDB();
        const data: SyncChamberRecordStructure = await afterSyncDB.getItemByLocalUuid(newTable, newUuid);


        expect(afterSyncDB.tableExists(newTable)).toEqual(true);
        expect(data.record).toEqual(justDontCareAtAll.mergedData?.mergedDbObject);
        
        syncLibrary.entitySyncWorker?.terminate(); 

    });

    it('#5 Should return conflicts and write to conflict DB', async () => {

        /**
         * Pripraviti moram podatke:
         * 1. v SYNC DB moram imeti podatek
         * 2. iz BE moram poslati podatek, ki ima conflikte
         * 2.1 preveriti moram kaksna je struktura za konflikte (v BE kodi):
                public string $field_name;
                public string $value;
                public string $conflict_id;
                public ?\DateTime $datetime;

          2.2 struktura celotnega odgovora (SyncEntityResponse):
                status: SyncEntityStatusEnum;
                mergedData: MergeProcessResult | undefined;
                        conflicts: any[]; --> SyncConflictItem[]
                        mergedDbObject: any; --> plain object
                recordUuid: string | undefined;
                error: any;
         * 
         */
        
        const dataToInsert = {
            'name': 'Unknown name',
            'description': 'Unknown description',
            lastModified: new Date(),
        };
        const uuidToUse = uuidv4();
        const conflictedData = {
            fieldName: 'name',
            value: 'Unknown name', // v mergedDBobject moram dati podatek, ki velja iz BE
            conflictId: uuidv4(), // conflict should have it's own ID and should not be in any way linked with id of the object that is synced
            datetime: new Date()
        } as SyncConflictItem;
        const objectDataOnBE = cloneDeep(dataToInsert);
        objectDataOnBE.name = 'This is dark magic!';
        const responseData = { error: undefined, mergedData: { conflicts: [conflictedData], mergedDbObject: objectDataOnBE, lastModified: new Date() } as MergeProcessResult, recordUuid: uuidToUse, status: SyncEntityStatusEnum.CONFLICT } as SyncEntityResponse
        // const justDontCareAtAll = { status: SyncEntityStatusEnum.SUCCESS as any, mergedData: dataFromBE, recordUuid: newUuid, error: undefined } as SyncEntityResponse;
        // const syncRecords: SyncBatchSingleEntityResponse = {syncRecords: [responseData], status: SyncBatchSingleEntityStatusEnum.PARTIAL_SUCESS, createdAt: new Date()} as SyncBatchSingleEntityResponse;
        const responseFromBE = prepareResponseStructureWithDataForBatch([responseData], SyncBatchSingleEntityStatusEnum.PARTIAL_SUCESS, 200);

        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();

        syncLibrary.syncEntityInstance?.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, responseFromBE);

        // prvo je potrebno tudi shraniti podatek v bazo
        await syncLibrary.storeNewObject(testTableName, uuidToUse, dataToInsert);

        await syncLibrary.syncEntityInstance?.startBatchSync();

        const syncDB = await syncLibrary.getSyncDB();
        const conflictDB = await syncLibrary.getConflictDB();
        const dataFromSyncDB = await syncDB.getItemByLocalUuid(testTableName, uuidToUse) as SyncChamberRecordStructure;
        
        const dataFromConflictDB = await conflictDB.table(testTableName).get(uuidToUse) as SyncConflictSchema;
        expect(dataFromSyncDB.objectStatus).toEqual(ChamberSyncObjectStatus.conflicted);
        expect(dataFromConflictDB.objectUuid).toEqual(dataFromSyncDB.localUUID);
        expect(dataFromConflictDB.record).toEqual(objectDataOnBE);
        expect(dataFromConflictDB.conflicts).toEqual([conflictedData]);
        expect(dataFromConflictDB.record.name).toEqual('This is dark magic!');
        expect(dataFromSyncDB.record.name).toEqual('Unknown name');


    });

    it('#6 should add data to TEMP when data in status `in_sync`', async() => {
        const dataToInsert = {
            'name': 'Unknown name',
            'description': 'Unknown description'
        };
        const uuidToUse = uuidv4();
        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();

        const syncLibEventsObservable = SynchronizationLibrary.eventsSubject.asObservable(); // Ta zadeva mora biti tukaj nastavljena, ker pred prvo inicializacijo SynchronizationLibrary-ja je `eventsSubject` undefined!!!!

        const dataForTemp = cloneDeep(dataToInsert);
        dataForTemp.name = 'Name in TEMP db';

        // prvo je potrebno tudi shraniti podatek v bazo
        await syncLibrary.storeNewObject(testTableName, uuidToUse, dataToInsert);
        const syncEntry: SyncChamberRecordStructure = await (await syncLibrary.getSyncDB()).table(testTableName).get(uuidToUse);
        syncEntry.objectStatus = ChamberSyncObjectStatus.in_sync;
        await (await syncLibrary.getSyncDB()).table(testTableName).put(syncEntry, uuidToUse);
        const syncLibNotificationAsync = firstValueFrom(syncLibEventsObservable);
        let error = undefined;
        try{
            await syncLibrary.storeNewObject(testTableName, uuidToUse, dataForTemp);
        }catch(er: any) {
            error = er; 
        }
        
        const syncLibNotification = await syncLibNotificationAsync;
        expect(!!error).toBeTruthy();
        expect(error).toEqual((new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`)));
        const tempDB = await syncLibrary.getTempDB();
        expect(tempDB.tableExists(testTableName)).toBeTruthy();
        const tempEntry: SyncChamberRecordStructure = await tempDB.table(testTableName).get(uuidToUse);
        expect(!!tempEntry).toBeTruthy();
        expect(tempEntry.changes.length).toEqual(1);
        expect(tempEntry.changes[0].changes[0].value).toEqual('Unknown name');
        expect(tempEntry.changes[0].changes[0].path).toEqual('/name');
        expect(tempEntry.record.name).toEqual('Name in TEMP db');
        const replicatedSyncNotificationWithIncorrectDate = plainToInstance(SyncLibraryNotification, {createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' });
        expect(syncLibNotification.data).toEqual(replicatedSyncNotificationWithIncorrectDate.data);
        expect(syncLibNotification.error).toEqual(replicatedSyncNotificationWithIncorrectDate.error);
        expect(syncLibNotification.message).toEqual(replicatedSyncNotificationWithIncorrectDate.message);
        expect(syncLibNotification.type).toEqual(replicatedSyncNotificationWithIncorrectDate.type);
        console.log(tempEntry);

    });



    it('#7 should add data to TEMP twice when data in status `in_sync`', async() => {
        const dataToInsert = {
            'name': 'Unknown name',
            'description': 'Unknown description'
        };
        const uuidToUse = uuidv4();
        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();

        const syncLibEventsObservable = SynchronizationLibrary.eventsSubject.asObservable(); // Ta zadeva mora biti tukaj nastavljena, ker pred prvo inicializacijo SynchronizationLibrary-ja je `eventsSubject` undefined!!!!

        const dataForTemp = cloneDeep(dataToInsert);
        dataForTemp.name = 'Name in TEMP db';

        // prvo je potrebno tudi shraniti podatek v bazo
        await syncLibrary.storeNewObject(testTableName, uuidToUse, dataToInsert);
        const syncEntry: SyncChamberRecordStructure = await (await syncLibrary.getSyncDB()).table(testTableName).get(uuidToUse);
        syncEntry.objectStatus = ChamberSyncObjectStatus.in_sync;
        await (await syncLibrary.getSyncDB()).table(testTableName).put(syncEntry, uuidToUse);
        // const syncLibNotificationAsync = firstValueFrom(SynchronizationLibrary.eventsSubject.asObservable());
        const syncLibNotificationAsync = firstValueFrom(syncLibEventsObservable);
        let error = undefined;
        try{
            await syncLibrary.storeNewObject(testTableName, uuidToUse, dataForTemp);
        }catch(er: any) {
            error = er; 
        }
        
        const syncLibNotification = await syncLibNotificationAsync;
        expect(!!error).toBeTruthy();
        expect(error).toEqual((new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`)));
        const tempDB = await syncLibrary.getTempDB();
        expect(tempDB.tableExists(testTableName)).toBeTruthy();
        const tempEntry: SyncTempChamberRecordStructure = await tempDB.table(testTableName).get(uuidToUse);
        expect(!!tempEntry).toBeTruthy();
        expect(tempEntry.record.name).toEqual('Name in TEMP db');
        const replicatedSyncNotificationWithIncorrectDate = plainToInstance(SyncLibraryNotification, {createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' });
        expect(syncLibNotification.data).toEqual(replicatedSyncNotificationWithIncorrectDate.data);
        expect(syncLibNotification.error).toEqual(replicatedSyncNotificationWithIncorrectDate.error);
        expect(syncLibNotification.message).toEqual(replicatedSyncNotificationWithIncorrectDate.message);
        expect(syncLibNotification.type).toEqual(replicatedSyncNotificationWithIncorrectDate.type);

        
        // Del ko vstavimo drugic podatek z TEMP -> ponovno se mora podatek zapisati v TEMP in dobiti moramo notification , vendar tokrat je specificno notification za drugi TEMP scenarij

        const secondDataForTemp = cloneDeep(dataToInsert);
        secondDataForTemp.name = 'Name in TEMP db 2';
        // const secondSyncLibNotificationAsync = lastValueFrom(SynchronizationLibrary.eventsSubject.asObservable());
        const secondSyncLibNotificationAsync = firstValueFrom(syncLibEventsObservable); // ker smo ze enkrat pocakali odgovor iz observable se mora ponovno uporabiti firstValueFrom (za naslednjo vrednost iz observable) !!!
        let secondError = undefined;
        try{
            await syncLibrary.storeNewObject(testTableName, uuidToUse, secondDataForTemp);
        }catch(er: any) {
            secondError = er; 
        }
        
        const secondSyncLibNotification = await secondSyncLibNotificationAsync;
        expect(!!secondError).toBeTruthy();
        expect(secondError).toEqual((new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible (overwritten temp data).`)));
        const tempDB2 = await syncLibrary.getTempDB();
        expect(tempDB.tableExists(testTableName)).toBeTruthy();
        const secondTempEntry: SyncTempChamberRecordStructure = await tempDB2.table(testTableName).get(uuidToUse);
        expect(!!secondTempEntry).toBeTruthy();
        expect(secondTempEntry.record.name).toEqual('Name in TEMP db 2');
        const secondReplicatedSyncNotificationWithIncorrectDate = plainToInstance(SyncLibraryNotification, {createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible (overwritten temp data).' });
        expect(secondSyncLibNotification.data).toEqual(secondReplicatedSyncNotificationWithIncorrectDate.data);
        expect(secondSyncLibNotification.error).toEqual(secondReplicatedSyncNotificationWithIncorrectDate.error);
        expect(secondSyncLibNotification.message).toEqual(secondReplicatedSyncNotificationWithIncorrectDate.message);
        expect(secondSyncLibNotification.type).toEqual(secondReplicatedSyncNotificationWithIncorrectDate.type);
        


    });



    /**
     * Trenutno je potrebno resiti:
     * 
     * + changes tabela v syncChamber nima pravilne strukture -> pojavi se prazen CHANGES tabela ( kar se ne sme zgoditi) -> POPRAVLJENO
     * + changes tabela ima dvakrat isto spremembo za isti field ceprav smo iz TEMP podatka izvlekli drugacen podatek --> V Notion-u je razlaga zakaj se to lahko zgodi in da je to ok (se posebej v tem primeru ki ga tukaj uporabljam)
     */
    it('#8 should sync data and then recalculate with TEMP data', async() => {

        const dataToInsert = {
            'name': 'Unknown name',
            'description': 'Unknown description',
            'lastModified': new Date(),
        };
        const uuidToUse = uuidv4();
        const syncLibrary = new SynchronizationLibrary(false, true);
        await syncLibrary.finishSetup();
        const syncLibEventsObservable = SynchronizationLibrary.eventsSubject.asObservable();

        const dataForTemp = cloneDeep(dataToInsert);
        dataForTemp.name = 'Name in TEMP db';

        // prvo je potrebno tudi shraniti podatek v bazo
        await syncLibrary.storeNewObject(testTableName, uuidToUse, dataToInsert);
        let syncEntry: SyncChamberRecordStructure = await (await syncLibrary.getSyncDB()).table(testTableName).get(uuidToUse);
        syncEntry.objectStatus = ChamberSyncObjectStatus.in_sync;
        await (await syncLibrary.getSyncDB()).table(testTableName).put(syncEntry, uuidToUse);
        // const syncLibNotificationAsync = firstValueFrom(SynchronizationLibrary.eventsSubject.asObservable());
        const syncLibNotificationAsync = firstValueFrom(syncLibEventsObservable);
        let error = undefined;
        try{
            await syncLibrary.storeNewObject(testTableName, uuidToUse, dataForTemp);
        }catch(er: any) {
            error = er; 
        }
        
        const syncLibNotification = await syncLibNotificationAsync;
        expect(!!error).toBeTruthy();
        expect(error).toEqual((new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`)));
        let tempDB = await syncLibrary.getTempDB();
        expect(tempDB.tableExists(testTableName)).toBeTruthy();
        let tempEntry: SyncChamberRecordStructure = await tempDB.table(testTableName).get(uuidToUse);
        
        expect(!!tempEntry).toBeTruthy();
        expect(tempEntry.changes.length).toEqual(1);
        expect(tempEntry.changes[0].changes[0].value).toEqual('Unknown name');
        expect(tempEntry.changes[0].changes[0].path).toEqual('/name');
        expect(tempEntry.record.name).toEqual('Name in TEMP db');

        /**
         * Logika kako naj se izvede prenos TEMP v sync bazo ko se izvede syncbatch/sync record:
         * +    TEMP je tako ali tako diff med SYNC objektom in trenutnih podanih objektom
         * +    ko dobim uspesen response iz BE moram prvo v obstojec SYNC record DODATI (appendat) razlike iz TEMP
         * +    nato narediti izracun razlik med BE objektom in TEMP objektom
         * +    zadnje izracunane razlike tudi dodamo v SYNC objekt
         * +    sync objekt nastavimo na pending sync
         * 
         * VPRASANJE:
         * A ne bo TEMP ze vkljuceval changes, ki jih ima SYNC takoj ko izvedemo prvi TEMP?
         * KER MOGOCE JE PROBLEM DRUGI TEMP store!!!!!!
         * 
         * Zadnji odgovor (02.05.2023 15:20) -> Trenutno dobim pravilno strukturo v changes glede na trenutni primer (2x isti change v CHANGES tabeli), zato ker prvi change je ustvarjen ko se naredi
         * diff med TEMP in SYNC in nato se naredi DIFF se med TEMP in BE (ker pa BE je ostal nespremenjen imamo spet isti DIFF).
         * IDEJA: Primerjajmo prvo BE in SYNC, ce tam ni sprememb, ce ne dela sprememb med TEMP in BE!
         *      TUKAJ LAHKO PRIDE DO PROBLEMA: Ker BE bo lahko vrnil nazaj manj fieldov kot jih ima SYNC (kaksni neobstojeci fieldi). Zato bo v takem primeru DIFF vrnil neko razliko.
         */
        const replicatedSyncNotificationWithIncorrectDate = plainToInstance(SyncLibraryNotification, {createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' });
        expect(syncLibNotification.data).toEqual(replicatedSyncNotificationWithIncorrectDate.data);
        expect(syncLibNotification.error).toEqual(replicatedSyncNotificationWithIncorrectDate.error);
        expect(syncLibNotification.message).toEqual(replicatedSyncNotificationWithIncorrectDate.message);
        expect(syncLibNotification.type).toEqual(replicatedSyncNotificationWithIncorrectDate.type);

        let syncDB = await syncLibrary.getSyncDB();
        syncEntry = await syncDB.table(testTableName).get(uuidToUse);
        expect(!!syncEntry).toBeTruthy();
        expect(syncEntry.changes.length).toEqual(0); // Ze tukaj ne deluje ok



        syncEntry.objectStatus = ChamberSyncObjectStatus.pending_sync;
        await syncDB.table(testTableName).put(syncEntry, uuidToUse);

        const objectDataOnBE = cloneDeep(dataToInsert);
        objectDataOnBE.name = 'Unknown name - from BE';

        // Nastavimo mocked request response iz BE 
        const responseData = { error: undefined, mergedData: { conflicts: [], mergedDbObject: objectDataOnBE, lastModified: new Date() } as MergeProcessResult, recordUuid: uuidToUse, status: SyncEntityStatusEnum.SUCCESS } as SyncEntityResponse
        const batchResponseFromBE = prepareResponseStructureWithDataForBatch([responseData], SyncBatchSingleEntityStatusEnum.COMPLETE_SUCCESS, 200);
        syncLibrary.setMockedResponse(CustomAxiosMockedResponseEnum.SUCCESS, batchResponseFromBE as any);

        await syncLibrary.syncEntityInstance?.startBatchSync();

        syncDB = await syncLibrary.getSyncDB();
        syncEntry = await syncDB.table(testTableName).get(uuidToUse);
        tempDB = await syncLibrary.getTempDB();
        const tempEntry2 = await tempDB.table(testTableName).get(uuidToUse);

        expect(!!tempEntry2).toBeFalsy();
        expect(!!syncEntry).toBeTruthy();
        expect(syncEntry.objectStatus).toEqual(ChamberSyncObjectStatus.pending_sync);
        expect(syncEntry.changes.length).toEqual(2);
        expect(syncEntry.changes[1].changes[0].value).toEqual(objectDataOnBE.name);
        expect(syncEntry.record.name).toEqual(tempEntry.record.name); // namensko primerjam tukaj `tempEntry` in ne `tempEntry2`, ker `tempEntry` vsebuje podatke pred zakljuckom batch synca in ti podatki morajo na koncu biti v `syncEntry`
    });

    // it('da bi\' t kuhala in gospodinla', async () => {
    //     // const ff = new ama(axios);
    //     // const syncLibrary = new SynchronizationLibrary(false);
    //     // await syncLibrary.finishSetup();

    //     /**
    //      * Interceptorji ne delujejo na tak nacin
    //      */



    //     // axios.get('https://google.com');

    //     const entityNameFromConfiguration = 'App\\Entity\\TheTest';
    //     const urlToCall = encodeURI(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.BATCH_SINGLE_ENTITY_SYNC_PATH_NAME}/${entityNameFromConfiguration}`);
    //     console.log(urlToCall);


    //     // f f.onPost(urlToCall).reply(200, {});
    //     //@ts-ignore
    //     // spyOn(syncLibrary.syncEntityInstance!, 'XMLHttpRequest').and.callFake(() => {
    //     //     console.log('METTTAAAAAQ8888888!!!!!!');

    //     //     var xhr = new XMLHttpRequest();
    //     //     xhr.response(200, {'test': 'META!'});
    //     //     return xhr;
    //     // });


    //     const newUuid = uuidv4();

    //     const newObjectData = {
    //         'field1': 'Test field1',
    //         'field2': 'Test field2'
    //     };

    //     const newTable = 'testing_table';
    //     // const storedData = await syncLibrary.storeNewObject(newTable, newUuid, newObjectData);

    //     // moxios.stubRequest('http://localhost/api/',{});
    //     // moxios.stubFailure('post', 'http://localhost/api/', {});
    //     // axios.post('http://localhost/api/', {});

    //     // moxios.wait(()=>{
    //     //     console.log('SEVEDE DELA ,,, jade');

    //     //     let request = moxios.requests.mostRecent();
    //     //     console.log(request);

    //     //     request.respondWith(
    //     //         {
    //     //             status: 200,
    //     //             response: {
    //     //                 'boga': 'zvauca'
    //     //             }
    //     //         }
    //     //     );
    //     // });
    //     console.log('KDAJ PA TO?');


    //     // syncLibrary.startBatchSync();
    //     // axios.post('https://localhost/api/', {});
    //     // const v = new ama(axios);
    //     // v.onPost('https://localhost/api/').reply(200, {});


    //     // moxios.stubFailure('POST', urlToCall, new Item())

    // });


});
