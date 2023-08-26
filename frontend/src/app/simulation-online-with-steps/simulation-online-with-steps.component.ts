import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Route, Router } from '@angular/router';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';
import { ClassTransformOptions, Type, plainToInstance } from 'class-transformer';
import { SynchronizationLibrary } from '../packages/main';
import { FormControl, FormGroup } from '@angular/forms';
import { EventSourceService } from '../packages/services/event-source-service';
import { SyncLibraryNotification } from '../packages/models/event/sync-library-notification.model';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_SCHEMA_MAPPER, DEFAULT_MERCURE_SYNC_POLICY } from '../packages/configuration';
import { SyncLibraryNotificationEnum } from '../packages/enums/event/sync-library-notification-type.enum';
import axios from 'axios';
import 'dexie-export-import';
import { AppDB } from '../packages/services/db';
import Dexie from 'dexie';
import * as download from 'downloadjs';
import { ApiService } from '../services/api-service';
import { BehaviorSubject, Subscription, first } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import syncTestEntityBackup from '../packages/mock-data/26-08-2023/sync_testEntity_backup';


@Component({
  selector: 'app-simulation-online-with-steps',
  templateUrl: './simulation-online-with-steps.component.html',
  styleUrls: ['./simulation-online-with-steps.component.scss']
})
export class SimulationOnlineWithStepsComponent implements OnInit {

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
  //@ts-ignore
  private syncLib: SynchronizationLibrary;

  private eventSourceService: EventSourceService | undefined;

  private consoleOutput: CustomConsoleOutput;

  private simulationSteps: SimulationStep[] = [];
  private simulation: Simulation = {} as Simulation;

  eventsSubscription: Subscription | undefined;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.consoleOutput = new CustomConsoleOutput('SimulationOnlineWithSteps', CONSOLE_STYLE.sync_lib_retry_management);
    this.consoleOutput.closeGroup();
  }
  ngOnInit(): void {

    this.route.params.subscribe(async (param) => {
      const base64Data = atob(param['dataAsBase64']);

      this.simulation = this.parseBase64ToSimulation(param['dataAsBase64']);

      // this.simulationSteps = this.parseBase64ToSimulationSteps(param['dataAsBase64']);
      // this.simulationSteps = this.parseBase64ToSimulationSteps(param['dataAsBase64']);
      this.simulationSteps = this.simulation.steps;
      // this.consoleOutput.output(`Noise`, this.simulationSteps);
      this.syncLib = new SynchronizationLibrary(false, false, DEFAULT_MERCURE_SYNC_POLICY, this.simulation.agentId, false);
      await this.syncLib.finishSetup();
      this.basicInputForm.controls['loadingFinished'].setValue(true);
    });
  }


  /**
   * START SIMULATION 
   */
  public async startSimulation(enableConcurrencyResolution = false) {
    let concurrencyProblem = false; // Moral sem nastaviti spremenljivko v tem kontekstu, ker drugace se vrednost ni pravilno zaznala znotraj te funkcije....
    this.eventsSubscription = SynchronizationLibrary.eventsSubject.subscribe(
      (event: SyncLibraryNotification) => {
        this.consoleOutput.output(`SIMULATION -> events subscription ... .this is what ia get   `, event);
        if (event.type === SyncLibraryNotificationEnum.NETWORK_UNAVAILABLE) {
          SynchronizationLibrary.eventsSubject.next({ type: SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED, message: 'finished' } as SyncLibraryNotification);
        }
        if (event.type === SyncLibraryNotificationEnum.CONCURRENCY_PROBLEM) {
          concurrencyProblem = true;
        }
      }
    );
    let index = 0;
    for (let simulationStep of this.simulationSteps) {
      await this.executeSingleStep(simulationStep, index);
      index += 1;
    }

    this.eventsSubscription?.unsubscribe();

    if (concurrencyProblem && enableConcurrencyResolution) {
      await this.startSimulation();
      return;
    }
    try {
      const exportedFileSync = await this.exportToFile('sync');
      this.consoleOutput.output('SyncResult  ', exportedFileSync);
      const exportedFileSyncConflict = await this.exportToFile('sync_conflict');
      this.consoleOutput.output('ConflictResult  ', exportedFileSyncConflict);
      const exportedFileSyncTemp = await this.exportToFile('sync_temp');
      this.consoleOutput.output('Temp result ', exportedFileSyncTemp);
    } catch (error) {
      this.consoleOutput.output('Export data error!!!', error);

    }
    this.setSimulationFinished(true);
    this.basicInputForm.controls['simulationFinished'].setValue(true);
  }

  public async storeDataFromForm(useExistingId: boolean = false, recordId = '8b292617-ef08-4ce9-8e7b-161dddc92e5d') {
    this.consoleOutput.output(recordId);
    const formData = {
      'firstInput':this.basicInputForm.controls['firstInput'].value,
      'secondInput': this.basicInputForm.controls['secondInput'].value
    };
    const savedData = await this.syncLib.storeNewObject('testEntity', useExistingId ? recordId : uuidv4(), formData);
  }

  public async executeSingleStep(step: SimulationStep, index: number) {
    if (
      (step.action === SimulationStepActionEnum.EDIT) ||
      (step.action === SimulationStepActionEnum.NEW) ||
      (step.action === SimulationStepActionEnum.UPSERT)
    ) {
      try {
        const savedData = await this.syncLib.storeNewObject(step.entityName ?? 'testEntity', step.recordId ?? uuidv4(), step.data);
      } catch (error) {
        this.consoleOutput.output(`Some error occured in simulation step: `, error);
      }
    } else if (step.action === SimulationStepActionEnum.BATCH_SYNC) {
      await this.syncLib.startBatchSync();
    } else if (step.action === SimulationStepActionEnum.CHANGE_NETWORK) {      
      window.dispatchEvent(new Event(step.networkStatus));
    } else {
      this.consoleOutput.output(`Unrecognized step`, step);
    }
  }


  /**
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
   * 
  */

  parseBase64ToSimulationSteps(base64String: string): SimulationStep[] {
    const decodedString = atob(base64String);
    return plainToInstance(SimulationStep, JSON.parse(decodedString) as any[]);
  }

  parseBase64ToSimulation(base64String: string): Simulation {
    return plainToInstance(Simulation, JSON.parse(atob(base64String)));
  }

  public async startSeleniumCustomData1() {
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
        this.consoleOutput.output('Sync result  ', exportedFileSync);
        const exportedFileSyncConflict = await this.exportToFile('sync_conflict');
        this.consoleOutput.output('Conflict result  ', exportedFileSyncConflict);
        const exportedFileSyncTemp = await this.exportToFile('sync_temp');
        this.consoleOutput.output('Temp result  ', exportedFileSyncTemp);
      } catch (error) {
        this.consoleOutput.output('Some export error', error);

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
    this.consoleOutput.output(`ExportTofile started`);
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
      return apiService.exportDatabaseToFileNew(JSON.parse(await blob.text()), databaseName, this.simulation.agentId, this.simulation.simulationName);
      // download(blob, "dexie-export.json", "application/json");
      this.consoleOutput.output('exported successs', true);
    } catch (error) {
      this.consoleOutput.output('Export failed!', error);
      console.error('' + error);
      throw error;
    }
    // db.close();
  }

  public async exportDatabase() {
    // const db = new AppDB('sync');
    const db = await this.syncLib.getSyncDB();
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

  public async importTestEntitySyncDatabase() {
    let dbSync;
    // import test data
    
    if (await Dexie.exists(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME)) {
      await AppDB.delete(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
    }
    try {
      dbSync = new AppDB('sync');
      dbSync.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER['sync'] });
      syncTestEntityBackup
      const fileFromJSON = new Blob([JSON.stringify(syncTestEntityBackup)],{type:'application/json'});
      await dbSync.import(fileFromJSON);
      await dbSync.finishSetup();
      dbSync.close();
    } finally {}
  }

  public async importDatabase() {
    let db, dbTemp, dbSyncing, dbConflict;
    if (await Dexie.exists('sync')) {
      db = new AppDB('sync');
      await db.finishSetup();
      await db.delete();
      db.close();
    }
    if (await Dexie.exists(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME)) {
      await AppDB.delete(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
    }

    if (await Dexie.exists(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME)) {
      await AppDB.delete(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
    }

    if (await Dexie.exists(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME)) {
      await AppDB.delete(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
    }
    try {
      db = new AppDB('sync');
      db.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER['sync'] });
      await db.finishSetup();

      dbTemp = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
      dbTemp.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME] });
      await dbTemp.finishSetup();

      dbConflict = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME);
      dbConflict.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_CONFLICT_DATABASE_NAME] });
      await dbConflict.finishSetup();

      dbSyncing = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);
      dbSyncing.version(1).stores({ 'testEntity': DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] });
      await dbSyncing.finishSetup();

      // const file = await axios.get('https://localhost/api/refactored/import_test_dexie_database_file', { responseType: 'json' });
      // const fileFromJSON = new Blob([file.data], { type: 'application/json' });
      // await db.import(fileFromJSON);
      db.close();
      dbSyncing.close();
      dbTemp.close();
      dbConflict.close();
    } catch (error) {
      this.consoleOutput.output('some error', error);

    }
  }

  public async startBatchSync() {
    await this.syncLib.startBatchSync();
  }

  public async startBEInitialState(entityName: string = 'TestEntity') {
    if (entityName === 'TestEntity') {
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

enum SimulationStepActionEnum {
  NEW = 'NEW',
  EDIT = 'EDIT',
  DELETE = 'DELETE',
  UPSERT = 'UPSERT',
  BATCH_SYNC = 'BATCH_SYNC',
  CHANGE_NETWORK = 'CHANGE_NETWORK',
}

class SimulationStep {
  //@ts-ignore
  agentId: string;
  //@ts-ignore
  recordId: string;
  //@ts-ignore
  action: string;
  //@ts-ignore
  entityName: string;
  data: any;
  //@ts-ignore
  networkStatus: string;

}

class Simulation {
  //@ts-ignore
  agentId: string;
  //@ts-ignore
  simulationName: string;
  @Type(() => SimulationStep)
  //@ts-ignore
  steps: SimulationStep[];
}
