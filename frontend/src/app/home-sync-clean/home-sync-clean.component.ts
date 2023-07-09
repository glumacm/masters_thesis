
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { ApiService } from 'src/app/packages/api.service';
import { Subscription, throwError } from 'rxjs';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';

import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from '../packages/configuration';
import { AppDB } from '../packages/services/db';
import { RetryPushNotificationStatusEnum } from '../packages/interfaces/retry-sync.interfaces';
import { v4 as uuidv4 } from "uuid";
import { SyncLibraryService } from '../services/sync-library.service';
import * as automerge from '@automerge/automerge';
import { AutoMergeWrapper } from '../packages/services/automerge-wrapper';
import { ConflictService } from '../packages/services/conflict-service';
import { SyncChamberRecordStructure } from '../packages/sync-storage.service';
import { SyncingObjectStatus } from '../packages/workers/retry/utilities';
import { ChamberSyncObjectStatus } from '../packages/interfaces/sync-storage.interfaces';
import { cloneDeep, isDate } from 'lodash';
import { changeDocWithNewObject, cloneSyncObject, cloneSyncObjectWithEncoded, convertUint8ArrayToObject, getLastChangesFromDocument, getLastChangesFromDocumentDecoded, initialiseDocument } from '../packages/utilities/automerge-utilities';
import { SentryClient } from '../packages/services/monitor';
import { SynchronizationLibrary } from '../packages/main';
import * as moment from 'moment';
import { Table } from 'dexie';
import { SyncLibraryNotification } from '../packages/models/event/sync-library-notification.model';
import { ObjectStoredToTempError } from '../packages/errors/object-stored-to-temp.error';
import { ObjectAlreadyConflictedError } from '../packages/errors/object-already-conflicted.error';
import { SyncLibAutoMerge } from '../packages/services/automerge-service';


interface BasicForm {
  firstInput: string;
  secondInput: string;
}

@Component({
  selector: 'app-home-sync-clean',
  templateUrl: './home-sync-clean.component.html',
  styleUrls: ['./home-sync-clean.component.scss']
})
export class HomeSyncCleanComponent implements OnInit {

  firstInput: string = 'Initial value';

  currentObjectUuid: string = '4904e49c-6d6a-4627-91ef-30b9294db523';
  currentTestingTableName: string = 'testing_table';
  showExampleConflict: boolean = true;
  resolveConflictWithRemote: boolean = true;

  exampleConflict: any = {}

  private consoleOutput: CustomConsoleOutput;
  private automergeWrapper: AutoMergeWrapper;


  private syncDB: AppDB | undefined;
  private tempDB: AppDB | undefined;
  private syncingDB: AppDB | undefined;
  private conflictDB: AppDB | undefined;

  private syncDBChangeSubscription: Subscription | undefined;
  private syncingDBChangeSubscription: Subscription | undefined;
  private tempDBChangeSubscription: Subscription | undefined;

  private syncLib: SynchronizationLibrary;

  constructor(
    private apiService: ApiService,
    private syncLibService: SyncLibraryService,
  ) {
    this.syncLib = new SynchronizationLibrary();
    SynchronizationLibrary.eventsSubject.subscribe(
      (event: SyncLibraryNotification) => {
        this.consoleOutput.output(`HOME-SYNC-CLEAN -> events subscription ... .this is what ia get   `, event);
      }
    )

    this.consoleOutput = new CustomConsoleOutput('HOME-SYNC', CONSOLE_STYLE.sync_lib_main_positive_vibe);
    this.consoleOutput.output(`Watch you glide city sleeps to high `);

    // // this.automergeWrapper = new AutoMergeWrapper(this.conflictService);
    this.automergeWrapper = new AutoMergeWrapper(new ConflictService());

  }

  async ngOnInit(): Promise<void> {
    this.consoleOutput.output(`Watch you glide do you know what i am saying?`);
    await this.syncLib.finishSetup();
    /**
     * Kaksne funkcije potrebujem implementirati in testirati za automerge?
     * - shranjevanje dokumentov v obstojeco strukturo ---> automergeWrapper.storeNewObject(...)
     * - loadanje dokumenta iz obstojece strukture
     * - pridobivanje sprememb
     * 
     */

    await this.setupSyncDB();
    await this.setupSyncingDB();
    // await this.setupConflictDB();

    this.consoleOutput.output(`Watch you glide`);
    const setExampleConflict = async (entityName: string = this.currentTestingTableName, uuid: string = this.currentObjectUuid) => {
      this.consoleOutput.output(`Watch you glide3`);
      const conflictDB = await this.getConflictDB();
      const conflictItem = conflictDB.tableExists(entityName) ? await conflictDB.table(entityName).get(uuid) : undefined;

      console.log('surrender');
      console.log(conflictItem);


      if (conflictItem) {
        this.exampleConflict.remoteConflictRecord = { objectAsString: JSON.stringify(conflictItem), fields: conflictItem.conflicts };
        this.exampleConflict.localConflictedRecord = JSON.stringify((await (await this.getSyncDB()).table(entityName).get(uuid))?.record ?? {});
      }
    }
    this.consoleOutput.output(`Watch you glide2`);
    await setExampleConflict();
  }

  async resolveOneConflict(conflictId: string, useRemote: boolean): Promise<void> {
    if (!conflictId) {
      alert('Cannot resolve conflict without conflict ID!!!!');
      return;
    }

    const returnedData = this.syncLib.resolveConflict(this.currentObjectUuid, this.currentTestingTableName, conflictId, useRemote);
    this.consoleOutput.output(`This is resolved data from resolveConflict function: `, returnedData);
  }


  async saveWithAutoMerge(docUuid: string = '047bb698-ddcb-4681-a3e2-02e487a5cd88') { // uuidv4()) {
    let theDoc: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc = this.automergeWrapper.changeDoc(theDoc, 'First changes', (doc) => {
      doc.f1 = 'f1 data';
      doc.f2 = 'f22 data';
      doc.f3 = 'f3 data';
      doc.f4 = 'f454 data';
      doc.f5 = 'f5 data';
    });

    let theDoc2: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc2 = this.automergeWrapper.changeDoc(theDoc2, 'First changes', (doc) => {
      doc.f1 = 'f000198 data New Sharif Oldies goldies';
      // doc.f1 = 'f000198 data';
      doc.f2 = 'f882 data make it pay';
      doc.f3 = 'f003 data Something DontLikeit';
      doc.f4 = 'f4 77data';
      doc.f5 = 'f5 data';
      doc.f5 = null;
      delete doc.f5;
      doc.f7 = 'Kemona';
    });

    this.consoleOutput.output(`Show doc1`, automerge.toJS(theDoc));
    this.consoleOutput.output(`Show doc2`, automerge.toJS(theDoc2));

    this.consoleOutput.output(`Meged doc and doc2`, automerge.toJS(automerge.merge(theDoc, theDoc2))); // to pomeni, da bo iz `theDoc2` preneslo podatke v `theDoc`. Na koncu bo theDoc == theDoc2.


    this.consoleOutput.output(`Doc2 data:`, theDoc2);
    this.automergeWrapper.storeNewObject('example_table2', docUuid, automerge.toJS(theDoc2));


  }

  async exampleSaveInTempWithExceptionWhenTempExists(tableName = 'example_table2', docUuid = uuidv4()) {
    await this.exampleSaveInTemp(tableName, docUuid);

    // Predpostavimo, da mora biti podatek ze v SYNC in v TEMP
    // Zato mora ob naslednjem shranjevanju vrniti napako

    const existingEntry = cloneSyncObjectWithEncoded(await (await this.getSyncDB()).table(tableName).get(docUuid));
    this.automergeWrapper.storeNewObject(tableName, docUuid, this.automergeWrapper.convertAutomergeDocToObject(existingEntry.record));

  }

  async exampleSaveInTemp(tableName = 'example_table2', docUuid = uuidv4()) {
    let theDoc2: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc2 = this.automergeWrapper.changeDoc(theDoc2, 'First changes', (doc) => {
      doc.f1 = 'f000198 data New Sharif Oldies goldies';
      // doc.f1 = 'f000198 data';
      doc.f2 = 'f882 data make it pay';
      doc.f3 = 'f003 data Something DontLikeit';
      doc.f4 = 'f4 77data';
      doc.f5 = 'f5 data';
      doc.f5 = null;
      delete doc.f5;
      doc.f7 = 'Kemona';
    });

    // Shranimo prvic v bazo
    const returnedValue = await this.automergeWrapper.storeNewObject(tableName, docUuid, automerge.toJS(theDoc2));
    let syncDB = await this.getSyncDB();
    this.consoleOutput.output(`ExampleSaveInTemp: Prvic shranimo in dobimo:`, returnedValue);
    this.consoleOutput.output(`ExampleSaveInTemp: V sync bazi mora dobiti uuid ${docUuid}:`, await syncDB.table(tableName).get(docUuid));

    // simulirati moram object, da je v stanju posiljanja
    returnedValue.objectStatus = ChamberSyncObjectStatus.in_sync;
    const returnedValueClone = cloneSyncObject(returnedValue);
    console.log('WHAT IS THIS');
    console.log(returnedValueClone);


    returnedValueClone.record = automerge.save(returnedValueClone.record);
    await syncDB.table(tableName).put(returnedValueClone, docUuid);


    // Poskusimo shraniti drugic v bazo, ampak se mora zapisati podatek v tempDB
    // returnedValue.record -> mora vrniti Automerge.Doc !!!
    const existingRecordJS = this.automergeWrapper.convertAutomergeDocToObject(returnedValue.record);
    existingRecordJS.f23 = 'New York, New York!!!';
    this.consoleOutput.output(`ExampleSaveInTemp: Changed object:`, existingRecordJS);
    // const docWithChanges = this.automergeWrapper.changeDocWithNewObject(returnedValue.record, existingRecordJS);
    const returnedValue2 = await this.automergeWrapper.storeNewObject(tableName, docUuid, existingRecordJS);



    let tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
    await tempDB.finishSetup();

    this.consoleOutput.output(`ExampleSaveInTemp: Drugic shranimo in dobimo:`, returnedValue2);
    this.consoleOutput.output(`ExampleSaveInTemp: V temp bazi mora dobiti uuid ${docUuid}:`, tempDB.table(tableName).get(docUuid));






  }




  async saveWithAutoMerge2(docUuid: string = 'ff9afca6-ec42-4743-850c-cd2fea7c0e8d') {
    let theDoc: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc = this.automergeWrapper.changeDoc(theDoc, 'First changes', this.changeObjectWithInitialTable.bind(this));

    // const fuckyou = automerge.init();
    theDoc = this.automergeWrapper.changeDoc(theDoc, 'What the heelll!', (doc) => { doc.hua = 'Svaka' });
    // this.consoleOutput.output('What teh dfuck', theDoc);
    // this.consoleOutput.output('w', automerge.getHistory(theDoc).map(state => {
    //   this.consoleOutput.output('take it ', state.change);
    // }));

    this.consoleOutput.output(`waw kick ass`, automerge.toJS<{ 'hua': string }>(theDoc));

    this.automergeWrapper.storeNewObject('example_table', docUuid, automerge.toJS(theDoc));
    // this.automergeWrapper.getChangesFromAutoMergeDoc(theDoc);

    // this.automergeWrapper.saveDocument('example_table', uuidv4(), theDoc); 


  }

  async loadExistingDocument(docUuid: string = '047bb698-ddcb-4681-a3e2-02e487a5cd88') {
    const loadDoc: SyncChamberRecordStructure = await this.automergeWrapper.findExistingDocument('example_table', docUuid);
    this.consoleOutput.output(`What was returned DOC:`, loadDoc.record);

    this.consoleOutput.output('This will be loaded', loadDoc ? automerge.toJS(automerge.load<any>(loadDoc.record)) : {});

    let theDoc2: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc2 = this.automergeWrapper.changeDoc(theDoc2, 'First changes', (doc) => {
      doc.f1 = 'f1 data';
      doc.f2 = 'f2 data';
      doc.f3 = 'f3 data';
      doc.f4 = 'f4 data';
      doc.f5 = 'f5 data';
    });

    const compresedData = automerge.save(theDoc2);
    this.consoleOutput.output(`Compresed data again: `, compresedData);
    this.consoleOutput.output(`Loaded data: `, automerge.load(compresedData));
  }

  async loadExistingDocument2(docUuid: string = 'ff9afca6-ec42-4743-850c-cd2fea7c0e8d') {
    const loadDoc = await this.automergeWrapper.findExistingDocument('example_table', docUuid);
    this.consoleOutput.output('This will be loaded', loadDoc ? automerge.load(loadDoc.record) : {});
  }

  public startEntityObjectSync(entityName: string = 'example_table') {
    this.syncLibService.startEntityObjectSync(entityName, 'backInThe90s');
  }

  changeObjectWithInitialTable(doc: any) {
    doc.hua = 'This si HUA!!!!';
  }






















  runEntitySyncWorker(objectName: string = 'object_name128') {
    this.syncLibService.sendEntityRecord(objectName);
  }

  testWorkerExample(): void {
    if (typeof Worker !== 'undefined') {

      // Create a new worker
      /**
       * A great suggestion from stackOverFlow: Put workers in one place, then creatae function that will
       * build aboslute path to the specified web worker
       * e.g. `function pathToWebWorker(webWorkerName: string) => { return ('/absolutePathToCommonFolderFoAllWebWorkers/'+webWorkerName); }`
       */
      const firstTestWorker = new Worker(new URL('../packages/workers/test/test-first.worker', import.meta.url));
      const secondTestWorker = new Worker(new URL('../packages/workers/test/test-second.worker', import.meta.url));
      firstTestWorker.onmessage = (ev: MessageEvent) => {
        console_log_with_style('FIRST_TEST WORKER finished processing', CONSOLE_STYLE.red_and_black!, ev);
      }
      secondTestWorker.onmessage = (ev: MessageEvent) => {
        console_log_with_style('SECOND_TEST WORKER finished processing', CONSOLE_STYLE.red_and_black!, ev);
      }

      firstTestWorker.postMessage('START');
      secondTestWorker.postMessage('START');


    } else {
      throw Error('Environment does not support web workers');
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }
  }

  makePostBErequest(): void {
    const request = this.apiService.postChangesInBE(
      'App\\Entity\\TheTest',
      {
        // 'id': 51,
        'id': 74,
        'name': 'I had this, the bells will ring it out',
        'description': 'perfect dream'
      },
      // '2022-12-26 15:58:40',
      '2022-12-26 17:09:50',
      null
    ).subscribe(
      (success) => {
        console_log_with_style('This is SUCCESS whne posting data', CONSOLE_STYLE.promise_success!, success);


      },
      (error) => {
        console_log_with_style('This is ERROR when posting data:', CONSOLE_STYLE.promise_error!, error);
      }
    );

  }

  makeBErequest(): void {
    console.group('firstReuqestGroup');
    console_log_with_style('Testing web calls', CONSOLE_STYLE.databaseUtilityLogic!);
    this.apiService.getFirstRequest(1, 'App\\Entity\\TheTest').subscribe(
      {
        next: (value) => {
          console_log_with_style('Testing web calls', CONSOLE_STYLE.databaseUtilityLogic!, value);
        }
      }
    );
    console.groupEnd();
  }

  runSyncWorker(): void {
    // Start web worker, to check for all pending objects
    if (typeof Worker !== 'undefined') {
      // Create a new worker
      /**
       * A great suggestion from stackOverFlow: Put workers in one place, then creatae function that will
       * build aboslute path to the specified web worker
       * e.g. `function pathToWebWorker(webWorkerName: string) => { return ('/absolutePathToCommonFolderFoAllWebWorkers/'+webWorkerName); }`
       */


    } else {
      throwError('Environment does not support web workers');
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }
  }


  public clickOnlineEvent(): void {
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
  }

  public clickOfflineEvent(): void {
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
  }

  public async addRetryNotification() {
    console_log_with_style(`Gonna start new push notification for retry process`, CONSOLE_STYLE.promise_success!, null, 2);
    const retryManagerDatabase = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    await retryManagerDatabase.finishSetup();
    retryManagerDatabase.table(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME).add({ requestUuid: uuidv4(), status: RetryPushNotificationStatusEnum.SENT, createdDatetime: new Date() });
  }

  private throwException(message: string, exception: any = null): never {
    console.log(exception);
    throw new Error(message);
  }

  private createBasicFormGroup(): FormGroup {
    return new FormGroup({
      firstInput: new FormControl('', []),
      secondInput: new FormControl('', [])
    });
  }



  async setupSyncDB(): Promise<AppDB> {
    this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
    await this.syncDB.open();
    this.syncChangeSubscription(this.syncDB);
    return this.syncDB;
  }

  async setupSyncingDB(): Promise<AppDB> {
    this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
    await this.syncingDB.open();
    this.syncingChangeSubscription(this.syncingDB);
    return this.syncingDB;
  }

  async setupTempDB(): Promise<AppDB> {
    this.tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
    await this.tempDB.open();
    this.tempChangeSubscription(this.tempDB);
    return this.tempDB;
  }

  async setupConflictDB(): Promise<AppDB> {
    this.conflictDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
    await this.conflictDB.open();
    // this.tempChangeSubscription(this.tempDB);
    return this.conflictDB;
  }


  async getSyncDB(): Promise<AppDB> {
    if (!this.syncDB) {
      this.syncDB = await this.setupSyncDB();
    }
    return this.syncDB;
  }

  async getSyncingDB(): Promise<AppDB> {
    if (!this.syncingDB) {
      this.syncingDB = await this.setupSyncingDB();
    }
    return this.syncingDB;
  }

  async getTempDB(): Promise<AppDB> {
    if (!this.tempDB) {
      this.tempDB = await this.setupSyncingDB();
    }
    return this.tempDB;
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

  syncingChangeSubscription(newDB: AppDB): Subscription {
    this.syncingDBChangeSubscription?.unsubscribe();

    this.syncingDBChangeSubscription = newDB.instanceChanged.subscribe(
      {
        next: (newDB) => {
          this.syncingDB = newDB;
          this.syncingChangeSubscription(newDB!);
        }
      }
    );
    return this.syncingDBChangeSubscription;
  }

  tempChangeSubscription(newDB: AppDB): Subscription {
    this.tempDBChangeSubscription?.unsubscribe();

    this.tempDBChangeSubscription = newDB.instanceChanged.subscribe(
      {
        next: (newDB) => {
          this.tempDB = newDB;
          this.tempChangeSubscription(newDB!);
        }
      }
    );
    return this.tempDBChangeSubscription;
  }



  /**
   * FUNKCIJE KI SO UPORABLJENE ZA PRIMERE/TESTIRANJE delovanja
   */

  private newObject(objectUuid: string): any {
    let doc = {} as any;
        doc.uuid = objectUuid ? objectUuid : uuidv4();
        doc.f1 = 'f000198 data New Sharif Oldies goldies';
        doc.description = 'Ja kaj pa to no!' + ` random uuid: ${uuidv4()}`;
        doc.name = 'To bo pa name SHOULD TRIGGER CHANGE!';
        // doc.f1 = 'f000198 data';
        doc.f2 = 'f882 data make it pay';
        doc.f3 = 'f003 data Something DontLikeit';
        doc.f4 = 'f4 77data';
        doc.f5 = 'f5 data';
        doc.f5 = null;
        delete doc.f5;
        doc.f7 = 'Kemona';
        return doc;
  };

  async testSaveObject(tableName: string = this.currentTestingTableName, objectUuid: string = this.currentObjectUuid): Promise<void> {
    try {
      const addedData = await this.syncLib.storeNewObject(tableName, objectUuid, this.newObject(objectUuid));
      this.consoleOutput.output(`Ocitno je shranjevanje 'testSaveObject' delovalo.`);
    }catch (exception) {
      this.consoleOutput.output(`This is the other error: `, exception);
      alert(`Ocitno prislo do napake`);
      return;
    }
  }

  async testSyncBasicUseCase(tableName: string = 'testing_table', objectUuid: string = '4904e49c-6d6a-4627-91ef-30b9294db523') {

    // Shranimo prvi podatek v SYNC tabelo
    // SLEDECA LOGIKA MORA BITI DODANA NEKJE v MAIN.TS, da bomo imeli ENO tocko kjer se bo preverjalo errorje
    let addedData;
    try {
      // addedData = await this.addDataToSync(tableName, objectUuid);
      // addedData = await this.syncLibService.
      const newObject = () => {
        let doc = {} as any;
        doc.uuid = objectUuid ? objectUuid : uuidv4();
        doc.f1 = 'f000198 data New Sharif Oldies goldies';
        doc.description = 'Ja kaj pa to no!' + ` random uuid: ${uuidv4()}`;
        doc.name = 'To bo pa name SHOULD TRIGGER CHANGE!';
        // doc.f1 = 'f000198 data';
        doc.f2 = 'f882 data make it pay';
        doc.f3 = 'f003 data Something DontLikeit';
        doc.f4 = 'f4 77data';
        doc.f5 = 'f5 data';
        doc.f5 = null;
        delete doc.f5;
        doc.f7 = 'Kemona';
        return doc;
      };
      addedData = await this.syncLib.storeNewObject(tableName, objectUuid, newObject());
    } catch (error) {
      if (error instanceof ObjectStoredToTempError) {
        alert(`Ne moremo nadaljevati s sihronizaicjo, ker smo shranili trenutni objekt v TEMP. Message: ${error.message} `);
        return;
      } else if (error instanceof ObjectAlreadyConflictedError) {
        alert(`Ne moremo nadaljevati s sihnronizacijo, ker imamo ze nek podatek v conflictu. Prosimo resite conflict in nadaljujte: ${error.message}`);
        return;
      }
      this.consoleOutput.output(`This is the other error: `, error);
      alert(`Ocitno prislo do druge napake`)
      return;
    }
    this.consoleOutput.output(`TestSyncBasicUseCase: What do we have here`, addedData);

    // Pozenemo logiko za synhronizacijo enega objekta
    // this.syncLibService.startEntityObjectSync(tableName, objectUuid);
    // Nadomestil syncLibService s klicem direktno v sync thread
    this.syncLib.startSyncEntityObject(tableName, objectUuid, {}, 15000); // @alert - Will cause 15s delay before processing response from BE!

  }

  testSentryCaptureMessageWithDecorator(message: string = 'test message'): void {
    const sentry = new SentryClient();
    sentry.captureMessage(`Who ta hell you`);
  }


  playingWithTsEssentials(whatever: any = { 'odjeb': 'dsf', 'dds': 'fdfs' }) {

  }

  playingWithDates(dd = '2023-03-26T22:47:22+00:00') {
    console.log('#playingWithDates');
    console.log((new Date(dd)));
    const bla = new Date(dd);
    console.log(Object.prototype.toString.call(bla) === '[object Date]');

    console.log('The Date');
    console.log(moment.utc(dd).isValid());



  }


  private async addDataToSync(tableName: string, objectUuid: string) {

    let theDoc2: automerge.Doc<any> = this.createDocWithPredefinedData(objectUuid);
    return await this.automergeWrapper.storeNewObject(tableName, objectUuid, this.automergeWrapper.convertAutomergeDocToObject(theDoc2));

  }

  private createDocWithPredefinedData(objectUuid?: string): automerge.Doc<any> {
    return this.automergeWrapper.changeDoc(this.automergeWrapper.initialiseDocument(), 'First changes', (doc) => {
      doc.uuid = objectUuid ? objectUuid : uuidv4();
      doc.f1 = 'f000198 data New Sharif Oldies goldies';
      doc.description = 'Ja kaj pa to no!' + ` random uuid: ${uuidv4()}`;
      doc.name = 'To bo pa name SHOULD TRIGGER CHANGE!';
      // doc.f1 = 'f000198 data';
      doc.f2 = 'f882 data make it pay';
      doc.f3 = 'f003 data Something DontLikeit';
      doc.f4 = 'f4 77data';
      doc.f5 = 'f5 data';
      doc.f5 = null;
      delete doc.f5;
      doc.f7 = 'Kemona';
    });
  }

  public async resetDataForExistingObject(objectUuid: string, tableName: string = 'testing_table'): Promise<void> {
    if ((await this.getSyncingDB()).tables.find((table: Table) => table.name == tableName)) {
      const foundItem = (await this.getSyncingDB()).table(tableName).delete(objectUuid);
    }
    if ((await this.getTempDB()).tables.find((table: Table) => table.name == tableName)) {
      const syncTempItem = (await this.getTempDB()).table(tableName).delete(objectUuid);
    }
    const updateSyncItem = await (await this.getSyncDB()).table(tableName).where({ 'localUUID': objectUuid }).modify((obj: SyncChamberRecordStructure) => {
      obj.objectStatus = ChamberSyncObjectStatus.pending_sync;
    });
    alert(`Finished reseting data for: ${objectUuid}`);
  };

  public testingChangesFunctions(): void {

    const oneObject = { 'f1': 'f1', f2: 'f2' };
    const secondObject = { f2: 'f3', f3: 'f4' };

    const oneObjectDoc = changeDocWithNewObject(initialiseDocument(), oneObject);
    const secondObjectDoc = changeDocWithNewObject(initialiseDocument(), secondObject);

    // Test case from one to second
    const clonedFirstDoc = automerge.clone(oneObjectDoc);
    const clonedSecondDoc = automerge.clone(secondObjectDoc);
    const mergedDataFromObjectToDoc = changeDocWithNewObject(clonedFirstDoc, clonedSecondDoc);
    const changesFromSecond = getLastChangesFromDocumentDecoded(mergedDataFromObjectToDoc);

    this.consoleOutput.output(`#testingChangesFunctions   ... Before convertion from first to second`, oneObject);
    this.consoleOutput.output(`#testingChangesFunctions   ... Merged result: `, mergedDataFromObjectToDoc);
    this.consoleOutput.output(`#testingChangesFunctions   ... changes from oneObject to secondObject`, changesFromSecond);

    // Test case from second to first
    const clonedFirstDoc2 = automerge.clone(oneObjectDoc);
    const clonedSecondDoc2 = automerge.clone(secondObjectDoc);
    const mergedDataFromObjectToDoc2 = changeDocWithNewObject(clonedSecondDoc2, clonedFirstDoc2);
    const changesFromFirst = getLastChangesFromDocumentDecoded(mergedDataFromObjectToDoc2);

    this.consoleOutput.output(`#testingChangesFunctions   ... Before convertion from second to first`, secondObject);
    this.consoleOutput.output(`#testingChangesFunctions   ... Merged result2 : `, mergedDataFromObjectToDoc2);
    this.consoleOutput.output(`#testingChangesFunctions   ... changes from oneObject to secondObject`, changesFromFirst);




  }

  async decodeCurrentTestingExampleRecord(example_uuid: string = this.currentObjectUuid): Promise<void> {
    const exampleChamberObject: SyncChamberRecordStructure = await (await this.getSyncDB()).table(this.currentTestingTableName).get(example_uuid);
    exampleChamberObject.record = convertUint8ArrayToObject(exampleChamberObject.record);

    this.consoleOutput.output(`This is decoded entire sync chamber data: `, exampleChamberObject);
  }

  testSyncLibAutoMergeService() {
    const syncLibAutoMerge = new SyncLibAutoMerge();
    const obj1 = { f1: 'f1', f2: 'f2' };
    const obj2 = { f1: 'f11', f3: 'f3' };
    this.consoleOutput.output(`This is obj1: `, obj1);
    this.consoleOutput.output(`This is obj2: `, obj2);
    const diff = syncLibAutoMerge.compareTwoObjects(
      obj1,
      obj2,
    );
    this.consoleOutput.output(`this is differnece between two objects: `, diff);
    const clonedObj1 = cloneDeep(obj1);

    this.consoleOutput.output(`WHAT IN THE HEEEELLLL:   `, syncLibAutoMerge.applyPatch(clonedObj1, diff).newDocument);
  }

  toggleShowExampleConflict() {
    this.showExampleConflict = !this.showExampleConflict;
  }

  updateSyncItemWithStatus() {
    const finalResult = this.syncLib.setSyncChamberAsSynced(this.currentObjectUuid, this.currentTestingTableName);
    this.consoleOutput.output(`Terrible business: ${finalResult}`, finalResult);
  }

  batchSync() {
    const batchSyncExection = this.syncLib.startBatchSync(1000, true);
  }
}
