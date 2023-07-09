import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { v4 as uuidv4 } from "uuid";
// import { ExportOptions, exportDB, importDB, importInto } from 'dexie-export-import';
import 'dexie-export-import';
import { SynchronizationLibrary } from '../packages/main';
import { SyncLibraryNotification } from '../packages/models/event/sync-library-notification.model';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';
import { AppDB } from '../packages/services/db';
import * as download from 'downloadjs';
import Dexie from 'dexie';
import axios from 'axios';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_SCHEMA_MAPPER, DEFAULT_MERCURE_SYNC_POLICY } from '../packages/configuration';
import { ApiService } from '../services/api-service';
import { EventSourceService } from '../packages/services/event-source-service';
import { SyncLibraryNotificationEnum } from '../packages/enums/event/sync-library-notification-type.enum';
import { first } from 'rxjs';
import { NetworkStatus } from '../packages/services/network-status';

@Component({
  selector: 'app-simulation-offline',
  templateUrl: './simulation-offline.component.html',
  styleUrls: ['./simulation-offline.component.scss']
})
export class SimulationOfflineComponent {

  // Input related variables;
  firstInput: string = 'Initial value';
  secondInput: string = 'Initial value';
  thirdInput: string = 'Initial value';
  fourthInput: string = 'Initial value';
  fifthInput: string = 'Initial value';

  basicInputForm: FormGroup = new FormGroup({
    'uuidValues': new FormControl(),
    'browserName': new FormControl(''),
    'firstInput': new FormControl(),
    'secondInput': new FormControl(),
    'thirdInput': new FormControl(),
    'fourthInput': new FormControl(),
    'fifthInput': new FormControl(),
    'loadingFinished': new FormControl<Boolean>(false),
    'simulationFinished': new FormControl<Boolean>(false),
  })

  // sinhronizacijska komponenta
  private syncLib: SynchronizationLibrary;

  private eventSourceService: EventSourceService | undefined;

  // ostalo
  private consoleOutput = new CustomConsoleOutput('Simluation', CONSOLE_STYLE.sync_lib_main);

  constructor(

  ) {
    // this.syncLib = new SynchronizationLibrary(false, false, DEFAULT_MERCURE_SYNC_POLICY, '0e7d4ac7-71f0-47a9-bc73-b4c9b2592d0b');
    const netSt = NetworkStatus.getInstance();
    // window.dispatchEvent(new Event('offline'));

    this.syncLib = new SynchronizationLibrary(false, false, DEFAULT_MERCURE_SYNC_POLICY, undefined, true);
    SynchronizationLibrary.eventsSubject.subscribe(
      (event: SyncLibraryNotification) => {
        this.consoleOutput.output(`SIMULATION -> events subscription ... .this is what ia get   `, event);
        if (event.type === SyncLibraryNotificationEnum.NETWORK_UNAVAILABLE) {
          // this.setSimulationFinished(true);
          SynchronizationLibrary.eventsSubject.next({type: SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED, message: 'finished'} as SyncLibraryNotification);
        }
      }
    );
  }

  async ngOnInit(): Promise<void> {
    await this.syncLib.finishSetup();
    this.consoleOutput.output(`Are you online?`, navigator.onLine ? 'YES': 'NO');
    this.basicInputForm.controls['loadingFinished'].setValue(true);
  }

  public async startSeleniumCustomData1() {
    console.log('WHEN YOU SAY YOU HAD ENUGH');
    console.log('This is browserName ', this.basicInputForm.controls['browserName'].value);
    // return;
    const preSetUUIDsInput = this.basicInputForm.controls['uuidValues'].value;
    if (!preSetUUIDsInput || preSetUUIDsInput == '') {
      this.consoleOutput.output('Simulation finished because UUIDS are not set');
      this.setSimulationFinished(true);
      return;
    }

    const preSetUUIDs = preSetUUIDsInput.split(',');
    // try {
    //   const importedSyncDatabase = await this.importDatabase();
    //   if (!importedSyncDatabase) {
    //     this.setSimulationFinished(true);
    //     return;
    //   }
    // } catch (error) {
    //   this.consoleOutput.output('Could not import database, error: ', error);
    //   this.setSimulationFinished(true);
    //   return;
    // }




    // await this.syncLib.storeNewObject('testEntity', uuidv4(), { 'firstInput': this.firstInput, 'secondInput': this.secondInput });
    await this.syncLib.storeNewObject('testEntity', preSetUUIDs[0], { 'firstInput': this.basicInputForm.controls['firstInput'].value, 'secondInput': this.basicInputForm.controls['secondInput'].value });
    this.syncLib.startBatchSync(); // Nima smisla cakati, saj ne vrnemo nicesar


    const eventSubscription = SynchronizationLibrary.eventsSubject.pipe(first(value => value.type === SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED));
    eventSubscription.subscribe(async (event) => {
      this.consoleOutput.output('Subscription is set and executed with event: ', event);
      try {
        const exportedFileSync = await this.exportToFile('sync');
        this.consoleOutput.output('To je rezultat  ', exportedFileSync);
        const exportedFileSyncConflict = await this.exportToFile('sync_conflict');
        this.consoleOutput.output('To je rezultat  ', exportedFileSyncConflict);
        const exportedFileSyncTemp = await this.exportToFile('sync_temp');
        this.consoleOutput.output('To je rezultat  ', exportedFileSyncTemp);
      } catch (error) {
        this.consoleOutput.output('neka napaka', error);

      }
      this.setSimulationFinished(true);
      return;

      // this.basicInputForm.controls['simulationFinished'].setValue(true);
    });

    console.log('------------------------------------------------');
  }

  public onInputChange(event: any, inputName: any): void {
    if (inputName == 'firstInput') {
      this.firstInput = event.target.value;
    } else if (inputName == 'secondInput') {
      this.secondInput = event.target.value;
    } else if (inputName == 'thirdInput') {
      this.thirdInput = event.target.value;
    } else if (inputName == 'fourthInput') {
      this.fourthInput = event.target.value;
    }
  }

  public setSimulationFinished(value: boolean) {
    this.basicInputForm.controls['simulationFinished'].setValue(value);
  }

  public async exportToFile(databaseName: string = 'sync') {
    // const db = new AppDB(databaseName);
    // await db.finishSetup();
    this.consoleOutput.output(`Kdaj se izvede export`);
    let db;
    if (databaseName == 'sync_conflict') {
      db = await this.syncLib.getConflictDB();
    } else if (databaseName == 'sync_temp') {
      db = await this.syncLib.getTempDB();
    } else {
      db = await this.syncLib.getSyncDB();
    }

    const apiService = new ApiService(false, null);
    try {
      const blob = await db.export();
      db.close();
      return apiService.exportDatabaseToFile(JSON.parse(await blob.text()), databaseName, this.basicInputForm.controls['browserName'].value);
      // download(blob, "dexie-export.json", "application/json");
      this.consoleOutput.output('exported successs', true);
    } catch (error) {
      this.consoleOutput.output('Export failed!', error);
      console.error('' + error);
      throw error;
    }
    // db.close();
  }

  public async exportToFileDeprecated() {
    const db = new AppDB('sync');
    await db.finishSetup();
    const apiService = new ApiService(false, null);
    try {
      const blob = await db.export();
      await apiService.exportDatabaseToFile(JSON.parse(await blob.text()), 'sync', this.basicInputForm.controls['browserName'].value);
      // download(blob, "dexie-export.json", "application/json");
      this.consoleOutput.output('exported successs', true);
    } catch (error) {
      this.consoleOutput.output('Export failed!', error);
      console.error('' + error);
    }
    db.close();
  }

  public async exportDatabase() {
    const db = new AppDB('sync');
    await db.finishSetup();

    try {
      const blob = await db.export();
      download(blob, "dexie-export.json", "application/json");
      this.consoleOutput.output('exported successs', true);
    } catch (error) {
      this.consoleOutput.output('Export failed!', error);
      console.error('' + error);
    }
    db.close();
  }

  public async importDatabase() {
    let db;
    if (await Dexie.exists('sync')) {
      db = new AppDB('sync');
      await db.finishSetup();
      await db.delete();
      db.close();
    }
    try {
      db = new AppDB('sync');
      db.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER['sync'] });
      await db.finishSetup();

      const file = await axios.get('https://localhost/api/refactored/import_test_dexie_database_file', { responseType: 'json' });
      const fileFromJSON = new Blob([file.data], { type: 'application/json' });
      await db.import(fileFromJSON);
      db.close();
    } catch (error) {
      this.consoleOutput.output('some error', error);

    }
  }

  public async startBatchSync() {
    this.syncLib.startBatchSync();
  }

  public async startBEInitialState(entityName: string = 'TestEntity') {
    if(entityName === 'TestEntity') {
      await axios.get(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/initiate_initial_be_db_state`).then(
        (response) => {
          this.consoleOutput.output(`Say yes to life!`, response);
        },
        (error) => {
          this.consoleOutput.output(`The YEs Man! `, error);
        }
      )
    }
  }

  public async storeDataToObject() {
    const uuid = uuidv4();
    const data = {
      firstInput: this.basicInputForm.controls['firstInput'].value,
      secondInput: this.basicInputForm.controls['secondInput'].value,
      uuid: uuid,
    };
    await this.syncLib.storeNewObject('testEntity', uuid, data);
  }

}
