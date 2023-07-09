import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
// import * as ts_essentials from 'ts-essentials';
import { ApiService } from 'src/app/packages/api.service';
import { throwError } from 'rxjs';
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';

import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from '../packages/configuration';
import { AppDB } from '../packages/services/db';
import { RetryPushNotificationStatusEnum } from '../packages/interfaces/retry-sync.interfaces';
import { v4 as uuidv4 } from "uuid";
import { SyncLibraryService } from '../services/sync-library.service';
import * as automerge from '@automerge/automerge';
import { AutoMergeWrapper } from '../packages/services/automerge-wrapper';
import { ConflictManagerService } from '../packages/conflict-manager.service';
import { ConflictService } from '../packages/services/conflict-service';
import { SyncChamberRecordStructure } from '../packages/sync-storage.service';


interface BasicForm {
  firstInput: string;
  secondInput: string;
}

@Component({
  selector: 'app-home-sync',
  templateUrl: './home-sync.component.html',
  styleUrls: ['./home-sync.component.scss']
})
export class HomeSyncComponent implements OnInit {

  firstInput: string = 'Initial value';
  readonly basicForm: FormGroup;
  readonly initialState: BasicForm;
  private consoleOutput: CustomConsoleOutput;
  private automergeWrapper: AutoMergeWrapper;

  constructor(
    private apiService: ApiService,
    private syncLibService: SyncLibraryService,
    private conflictService: ConflictManagerService,
  ) {

    this.consoleOutput = new CustomConsoleOutput('HOME-SYNC', CONSOLE_STYLE.sync_lib_main_positive_vibe);
    this.basicForm = this.createBasicFormGroup();
    this.initialState = this.basicForm.value;
    // this.automergeWrapper = new AutoMergeWrapper(this.conflictService);
    this.automergeWrapper = new AutoMergeWrapper(new ConflictService());

  }

  async ngOnInit(): Promise<void> {
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
      doc.f1 = 'f000198 data';
      doc.f2 = 'f882 data';
      doc.f3 = 'f003 data';
      doc.f4 = 'f4 77data';
      doc.f5 = 'f5 data';
    });

    this.consoleOutput.output(`Show doc1`, automerge.toJS(theDoc));
    this.consoleOutput.output(`Show doc2`, automerge.toJS(theDoc2));

    this.consoleOutput.output(`Meged doc and doc2`, automerge.toJS(automerge.merge(theDoc, theDoc2))); // to pomeni, da bo iz `theDoc2` preneslo podatke v `theDoc`. Na koncu bo theDoc == theDoc2.
    

    this.automergeWrapper.storeNewObject('example_table', docUuid, automerge.toJS(theDoc2));

    
  }




  async saveWithAutoMerge2(docUuid: string = 'ff9afca6-ec42-4743-850c-cd2fea7c0e8d') {
    let theDoc: automerge.Doc<any> = this.automergeWrapper.initialiseDocument();
    theDoc = this.automergeWrapper.changeDoc(theDoc, 'First changes', this.changeObjectWithInitialTable.bind(this));

    // const fuckyou = automerge.init();
    theDoc = this.automergeWrapper.changeDoc(theDoc, 'What the heelll!', (doc)=> {doc.hua = 'Svaka'});
    // this.consoleOutput.output('What teh dfuck', theDoc);
    // this.consoleOutput.output('w', automerge.getHistory(theDoc).map(state => {
    //   this.consoleOutput.output('take it ', state.change);
    // }));

    this.consoleOutput.output(`waw kick ass`, automerge.toJS<{'hua': string}>(theDoc));

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
      throwError('Environment does not support web workers');
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
    console_log_with_style(`Gonna start new push notification for retry process`, CONSOLE_STYLE.promise_success!,null, 2);
    const retryManagerDatabase = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    await retryManagerDatabase.finishSetup();
    retryManagerDatabase.table(CONFIGURATION_CONSTANTS.BROWSER_RETRY_MANAGER_TABLE_NAME).add({requestUuid: uuidv4() ,status: RetryPushNotificationStatusEnum.SENT, createdDatetime: new Date()});
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

}
