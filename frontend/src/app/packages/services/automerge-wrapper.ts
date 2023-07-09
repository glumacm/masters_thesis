import { HttpClient } from '@angular/common/http';
import * as Automerge from '@automerge/automerge';
import { Op } from '@automerge/automerge-wasm';
import { plainToInstance } from 'class-transformer';
import { Table } from 'dexie';
import { clone, cloneDeep } from 'lodash';
import { Subscription } from 'rxjs';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_SCHEMA_MAPPER } from '../configuration';
import { ConflictManagerService } from '../conflict-manager.service';
import { SyncLibraryNotificationEnum } from '../enums/event/sync-library-notification-type.enum';
import { ObjectAlreadyConflictedError } from '../errors/object-already-conflicted.error';
import { ObjectStoredToTempError } from '../errors/object-stored-to-temp.error';
import { CustomChangeI } from '../interfaces/automerge-wrapper.interfaces';
import { SyncChamberRecordStructure } from '../interfaces/sync-storage.interfaces';
import { SynchronizationLibrary } from '../main';
import { SyncLibraryNotification } from '../models/event/sync-library-notification.model';
import { ChamberSyncObjectStatus } from '../sync-storage.service';
import { changeDocWithNewObject, cloneSyncObject, cloneSyncObjectWithEncoded, convertAutomergeDocToObject, convertObjectToAutomergeDoc, convertUint8ArrayToObject } from '../utilities/automerge-utilities';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../utilities/console-style';
import { SyncEntryI, SyncingEntryI, SyncingObjectStatus } from '../workers/retry/utilities';
import { ConflictService } from './conflict-service';
import { AppDB } from './db';

export class AutoMergeWrapper {

    private syncDB: AppDB | undefined;
    private tempDB: AppDB | undefined;
    private syncingDB: AppDB | undefined;
    private conflictDB: AppDB | undefined;

    private syncDBChangeSubscription: Subscription | undefined;
    private conflictDBChangeSubscription: Subscription | undefined;

    private consoleOutput: CustomConsoleOutput;
    constructor(
        // protected conflictService: ConflictManagerService,
        protected conflictService: ConflictService,
    ) {
        this.consoleOutput = new CustomConsoleOutput('AUTOMERGEWRAPPER', CONSOLE_STYLE.sync_lib_retry_management);
        this.consoleOutput.closeGroup();
        this.init();

        /**
         * @remarks
         * Automerge.getLastLocalChange() -> vrne tabelo sprememb. Za nas so pomembni sledeci podatki v objektih v tabeli:
         * - key: string -> ime lastnosti iz objekta
         * - action: 'set' | 'del' -> 'set' => update ali create operacija; 'del' pobrisimo lastnost
         */

        /**
         * Funkcije pripravljene za uporabo:
         *  - init
         *  - setupSyncDB
         *  - storeNewObject --> shrani sync podatke v `sync` tabelo skupaj z zadnjimi dodanimi spremembami.
         *  - getConvertedSyncEntry --> Poisci sync entry in pretvori `record` objekt iz Uint8Array v navaden objekt
         *  - getSyncEntry --> Poisci sync entry (ki vkljucuje `record` polje v Uint8Array obliki)
         *  - changeDocWithNewObject --> Nek obstojec dokument popravi s podatki iz posredovanega objekta. Pri tem preveri in `apliciraj` brisanje specificnih polj,
         * ce jih nimamo v novem objektu.
         *  - convertAutomergeChangeToCustomChange --> Pretvori tabelo sprememb, ki jih vrne AutoMerge v obliko, ki jo potrebujemo na zalednem sistemu.
         *  - getLastChangesFromDocumentEncoded --> poisce zadnje spremembe na dokumentu in jih dekodira v cloveku prijazno obliko (iz Uint8Array v tabelo)
         *  - convertAutomergeDocToObject -> pretvori Automerge.doc v nek JS objekt
         *  - convertUint8ArrayToObject -> pretvori Uint8Array v JS objekt
         */
    }

    /**
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     *                              Pomozne funkcije
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     */

    async init() {
        // 16.06.2023 -> zakomentiral spodnje inicializacije baz, ker ta wrapper ne bi smel biti vec v uporabi, saj ne bom uporabljal AutoMerge!!!
        // await this.setupSyncDB();
        // await this.setupTempDB();
        // await this.setupSyncingDB();

        return;
    }

    /**
     * Convert AutoMerge.Doc to plain TS/JS object
     * @param doc AutoMerge.Doc<any>
     * @returns Plain object
     */
    convertAutomergeDocToObject(doc: Automerge.Doc<any>): any {
        return convertAutomergeDocToObject(doc);
    }

    convertUint8ArrayToObject(encodedData: Uint8Array): any {
        return convertUint8ArrayToObject(encodedData);
    }


    /**
     * Basic CmRDT related functions
     */

    /**
     * @example
     * storeNewObject('example_table', docUuid, automerge.toJS(theDoc2));
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
        const existingConflictEntry = (await retrievedConflictDB.table(entityName).get(objectUuid));

        if (existingConflictEntry) {
            // IMAMO PODATEK ZE V CONFLICTU in v tem primeru ne pustimo nadaljnega shranjevanja
            // SyncLibraryNotification
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, { createdAt: new Date(), type: SyncLibraryNotificationEnum.ALREADY_CONFLICTED, message: `Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.` }));
            throw new ObjectAlreadyConflictedError(`Object with uuid: ${objectUuid} is already conflicted. Cannot store current data, please first solve conflict and then try to store again.`);
        }

        // USE-CASE ZA TEMP
        const retrievedTempDB = await this.getTempDB();
        const existingTempEntry = (await retrievedTempDB.table(entityName).get(objectUuid));
        if (
            retrievedTempDB.tables.find((table: Table) => table.name === entityName) &&
            existingTempEntry
        ) {
            const dataFromTemp = cloneSyncObjectWithEncoded(existingTempEntry as any) as SyncChamberRecordStructure; // TODO: Spremeniti tip ki ga damo v funkcijo in ki ga dobimo iz funkcije
            const dataToInsert = await this.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromTemp);
            const dataForReturn = cloneDeep(dataToInsert);
            if (dataToInsert.record) {
                dataToInsert.record = Automerge.save(dataToInsert.record); // Pretvorimo v Uint8Array
            }
            (await retrievedTempDB.table(entityName)).put(dataToInsert, objectUuid);
            // TODO: Manjkajo razlike v `changes` tabeli
            this.consoleOutput.output(`#Storing data to TEMP sync: `, dataForReturn);
            const newEvent = { createdAt: new Date(), type: SyncLibraryNotificationEnum.STORED_TO_TEMP, message: 'Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.' };
            SynchronizationLibrary.eventsSubject.next(plainToInstance(SyncLibraryNotification, newEvent));
            throw new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`);
        }

        const retrievedSyncingDB = await this.getSyncingDB();
        const retrievedSyncDB1 = await this.getSyncDB();
        if (
            // retrievedSyncingDB.tables.find((table: Table) => table.name === entityName)
            retrievedSyncDB1.tables.find((table: Table) => table.name === entityName)
        ) {
            // const existingEntry: SyncingEntryI = await retrievedSyncingDB.table(entityName).get(objectUuid);
            const existingEntry: SyncEntryI = await retrievedSyncDB1.table(entityName).get(objectUuid);
            if (
                existingEntry &&
                (
                    // existingEntry.status === SyncingObjectStatus.in_sync ||
                    // existingEntry.status === SyncingObjectStatus.pending_retry
                    existingEntry.objectStatus === ChamberSyncObjectStatus.in_sync ||
                    existingEntry.objectStatus === ChamberSyncObjectStatus.conflicted
                )
            ) {
                // Dodati moramo TEMP entry in zakljuciti delovanje
                // addEntryToDB
                // naredimo isto logiko kot bi jo naredili za navaden SAVE
                // const dataFromSync = await (await this.getSyncDB()).table(entityName).get(objectUuid); // predpostavljamo, da podatek obstaja
                const dataFromSync = cloneSyncObjectWithEncoded(existingEntry as any) as SyncChamberRecordStructure;
                const dataToInsert = await this.applyNewChangesToExistingSyncObject(objectUuid, objectData, dataFromSync);
                const dataForReturn = cloneSyncObject(dataToInsert); // Kloniramo ker drugace se bo `record` povozil s kasnejso logiko
                if (dataToInsert.record) {
                    // Preden posljemo podatke v bazo moramo pretvoriti `record` v Uint8Array 
                    dataToInsert.record = Automerge.save(dataToInsert.record);
                }
                this.tempDB = await (await this.getTempDB()).addEntryToTable(entityName, objectUuid, dataToInsert, (await this.getTempDB()).verno / 10, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] });
                // return dataForReturn;
                this.consoleOutput.output(`#Storing data to TEMP sync (in syncing scenario): `, dataForReturn);
                throw new ObjectStoredToTempError(`Current data is stored to TEMP because currently sync is in progress. After sync is done, we will update data if possible.`);
            }
        }




        let preExisting = null;

        const retrievedSyncDB: AppDB = await this.getSyncDB()
        if (!retrievedSyncDB.tables.find((table) => table.name == entityName)) {
            // create table for entity

            this.syncDB = await (retrievedSyncDB).changeSchemaInstance(retrievedSyncDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] }, retrievedSyncDB.verno / 10)
            // this.syncDB = await AppDB.changeSchema(await this.getSyncDB(), { entityName: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] }, );
        }

        let dataToReturn: SyncChamberRecordStructure = this.conflictService.prepareSyncRecordChamberStructure(
            objectUuid,
            this.changeDocWithNewObject(this.initialiseDocument(), objectData),
            [],
            undefined,
            ChamberSyncObjectStatus.pending_sync
        ) as SyncChamberRecordStructure;

        // V tem trenutku imamo sigurno tabelo `entityName` v syncDB
        preExisting = await this.getConvertedSyncEntry(await this.getSyncDB(), entityName, objectUuid);

        if (preExisting) {
            dataToReturn = await this.applyNewChangesToExistingSyncObject(objectUuid, objectData, preExisting);
        }

        // Pretvorimo v Uint8Array preden shranimo v bazo
        const dataToInsert = cloneSyncObject(dataToReturn);
        this.consoleOutput.output(`This is DATA STORED TO SYNC:  ` , dataToReturn);
        dataToInsert.record = dataToInsert.record ? Automerge.save(dataToInsert.record) : undefined;

        (await this.getSyncDB()).table(entityName).put(dataToInsert, objectUuid);

        return dataToReturn;
    }

    async applyNewChangesToExistingSyncObject(objectUuid: string, objectDataWithChanges: any, preExisting: SyncChamberRecordStructure): Promise<SyncChamberRecordStructure> {
        let dataToReturn: SyncChamberRecordStructure = this.conflictService.prepareSyncRecordChamberStructure(
            objectUuid,
            this.changeDocWithNewObject(this.initialiseDocument(), objectDataWithChanges),
            [],
            undefined,
            ChamberSyncObjectStatus.pending_sync
        ) as SyncChamberRecordStructure;
        // Preverimo razlike
        const documentWithNewChanges = this.changeDocWithNewObject(preExisting.record, objectDataWithChanges);

        if (!dataToReturn.changes) {
            dataToReturn.changes = [];
        }

        const latestChanges = this.getLastChangesFromDocumentDecoded(documentWithNewChanges);
        this.consoleOutput.output(`riders`, latestChanges);
        const changesToAppend = this.convertAutomergeChangeToCustomChange(latestChanges);

        if (changesToAppend?.length > 0) {
            // Samo ce zaznamo nove spremembe, spremeni tudi lastModified
            dataToReturn.lastModified = new Date();
            dataToReturn.changes.push(this.conflictService.prepareRecordChangesStructure(
                changesToAppend,
                new Date(),
                false,
            ));
        }

        return dataToReturn;
    }

    async getConvertedSyncEntry(syncDB: AppDB, entityName: string, objectUuid: string): Promise<SyncEntryI | undefined> {
        const foundEntry: SyncEntryI | undefined = await this.getSyncEntry(syncDB, entityName, objectUuid);
        if (!foundEntry) {
            return undefined;
        }

        // convert record part -> foundEntry.record is typeof Uint8Array 
        foundEntry.record = Automerge.load(foundEntry.record);
        return foundEntry;

    }

    async getSyncEntry(syncDB: AppDB, entityName: string, objectUuid: string): Promise<SyncEntryI | undefined> {
        return await syncDB.table(entityName).get(objectUuid);
    }

    changeDocWithNewObject(doc: Automerge.Doc<any>, objectWithChanges: any): Automerge.Doc<any> {
        return changeDocWithNewObject(doc, objectWithChanges);
    }

    convertAutomergeChangeToCustomChange(autoMergeChanges: Op[] | undefined) {
        const customChanges: CustomChangeI[] = [];
        if (!autoMergeChanges) {
            return [];
        }
        for (let amChange of autoMergeChanges) {
            customChanges.push(
                {
                    op: amChange.action == 'set' ? 'replace' : 'remove',
                    path: `/${amChange.key}`,
                    value: amChange.value,
                } as CustomChangeI
            );
        }

        return customChanges;
    }




    /**
     * 
     * Functions related to AutoMerge library
     * 
     */

    getLastChangesFromDocumentDecoded(doc: Automerge.Doc<any>): any[] | undefined {
        const lastChanges = this.getLastChangesFromDocument(doc);
        if (!lastChanges) {
            return undefined;
        }
        const decodedChanges = this.decodeChange(lastChanges).ops;
        return decodedChanges?.length > 0 ? decodedChanges : undefined;
    }

    getLastChangesFromDocument(doc: Automerge.Doc<any>): Uint8Array | undefined {
        // ALERT! Ta stvar ni ok!!! Vraca zadnjo spremembo, namesto zadnjo razliko. Kar pomeni, da ne morem imeti array-ja sprememb, ki me vrnejo v preteklost....

        return Automerge.getLastLocalChange(doc);
    }

    decodeChange(changes: Uint8Array): Automerge.DecodedChange {
        return Automerge.decodeChange(changes);
    }

    /**
     * 
     * @param doc 
     * @returns List of all changes (we should create somekind of filter to return changes from some specific Datetime)
     */
    getChangesFromAutoMergeDoc(doc: Automerge.unstable.Doc<any>) {
        this.consoleOutput.output(`I dont want to sound like`);
        const allChanges = Automerge.getAllChanges(doc);
        for (let change of allChanges) {
            this.consoleOutput.output(`And I actually`, Automerge.decodeChange(change));
        }
    }

    async findExistingDocument(entityName: string, objectUuid: string): Promise<SyncChamberRecordStructure | any> {
        if (!this.syncDB?.tables.find(table => table.name == entityName)) {
            return undefined;
        }

        const entityTable = this.syncDB.table(entityName);
        return await entityTable.get(objectUuid);
    }

    initialiseDocument(): any {//Automerge.unstable.Doc<any> {

        return Automerge.init(); // this creates a single AutoMerge document, which is like one single JSON object -> hipothetically I would created this for each record in a table.
    }

    /**
     * 
     * @param doc Document created with Automerge.init()
     * @param commitMessage `Commit like` message that will represent changes to document
     * @param callbackForDocChange Callback which includes logic how to change data in `doc`
     * @returns Automerge.unstable.Doc<any> object, which represents data of some object
     */
    changeDoc(doc: Automerge.unstable.Doc<any>, commitMessage: string, callbackForDocChange: Automerge.ChangeFn<any> | undefined): Automerge.unstable.Doc<any> {
        return Automerge.change(doc, commitMessage, callbackForDocChange);
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
        this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.syncDB.open();
        this.syncChangeSubscription(this.syncDB);
        return this.syncDB;
    }

    async setupTempDB(): Promise<AppDB> {
        this.tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
        await this.tempDB.open();
        return this.tempDB;
    }

    async setupSyncingDB(): Promise<AppDB> {
        this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
        await this.syncingDB.open();
        return this.syncingDB;
    }

    async setupConflictDB(): Promise<AppDB> {
        this.conflictDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
        await this.conflictDB.open();
        return this.conflictDB;
    }


    async getSyncDB(): Promise<AppDB> {
        if (!this.syncDB) {
            this.syncDB = await this.setupSyncDB();
        }
        return this.syncDB;
    }

    async getTempDB(): Promise<AppDB> {
        if (!this.tempDB) {
            this.tempDB = await this.setupTempDB();
        }
        return this.tempDB;
    }

    async getSyncingDB(): Promise<AppDB> {
        if (!this.syncingDB) {
            this.syncingDB = await this.setupSyncingDB();
        }
        return this.syncingDB;
    }

    async getConflictDB(): Promise<AppDB> {
        if (!this.conflictDB) {
            this.conflictDB = await this.setupConflictDB();
        }
        return this.conflictDB;
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

    conflictChangeSubscription(newDB: AppDB): Subscription {
        this.conflictDBChangeSubscription?.unsubscribe();

        this.conflictDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.conflictDB = newDB;
                    this.conflictChangeSubscription(newDB!);
                }
            }
        )
        return this.conflictDBChangeSubscription;
    }


}


