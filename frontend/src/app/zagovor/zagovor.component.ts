import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';
import { SynchronizationLibrary } from '../packages/main';
import { FormControl, FormGroup } from '@angular/forms';
import { EventSourceService } from '../packages/services/event-source-service';
import { SyncLibraryNotification } from '../packages/models/event/sync-library-notification.model';
import { CONFIGURATION_CONSTANTS, DEFAULT_MERCURE_SYNC_POLICY } from '../packages/configuration';
import { SyncLibraryNotificationEnum } from '../packages/enums/event/sync-library-notification-type.enum';
import axios from 'axios';
import 'dexie-export-import';
import { Subscription } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import syncTestEntityBackup from '../packages/mock-data/26-08-2023/sync_testEntity_backup';
import tempTestEntityBackup from '../packages/mock-data/26-08-2023/temp_testEntity_backup';
import { SimulationStep } from '../packages/models/simulation/simulation-step.model';
import { Simulation } from '../packages/models/simulation/simulation.model';
import { max } from 'lodash';


@Component({
  selector: 'app-zagovor',
  templateUrl: './zagovor.component.html',
  styleUrls: ['./zagovor.component.scss']
})
export class ZagovorComponent implements OnInit {

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
    'conflictUseRemove': new FormControl<Boolean>(true),
  })

  //@ts-ignore
  private syncLib: SynchronizationLibrary;

  private eventSourceService: EventSourceService | undefined;

  private consoleOutput: CustomConsoleOutput;

  private simulationSteps: SimulationStep[] = [];
  private simulation: Simulation = {} as Simulation;

  private syncData = [];
  private tempData = [];
  private conflictData = [];

  useRemoteData: boolean = true;

  eventsSubscription: Subscription | undefined;

  syncTestEntityBackup = syncTestEntityBackup;
  tempTestEntityBackup = tempTestEntityBackup;

  displayedData: any[] = [
    {
      sync: { string: 'Ni podatkov', object: {} },
      temp: { string: 'Ni podatkov', object: {} },
      conflict: { string: 'Ni podatkov', object: {} },
    }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.consoleOutput = new CustomConsoleOutput('SimulationOnlineWithSteps', CONSOLE_STYLE.sync_lib_retry_management);
    this.consoleOutput.closeGroup();
  }
  async getData(database: string = 'sync', testSchema: string = 'testEntity'): Promise<any> {
    let syncData: any[] = [];
    let tempData: any[] = [];
    let conflictData: any[] = [{ string: 'Ni podatkov', object: null }];
    if ((await this.syncLib.getSyncDB()).tableExists(testSchema)) {
      const obj = (await (await this.syncLib.getSyncDB()).table(testSchema).toArray()).map(item => {
        const ob = { status: item.objectStatus, uuid: item.localUUID, object: item.record }
        return {
          string: JSON.stringify(ob),
          object: ob,
        }
      });
      syncData = obj;
    } else {
      syncData = [{ string: 'Ni podatkov', object: null }];
    }
    if ((await this.syncLib.getTempDB()).tableExists(testSchema)) {
      const obj = (await (await this.syncLib.getTempDB()).table(testSchema).toArray()).map(item => {
        const ob = { status: item.objectStatus, uuid: item.localUUID, object: item.record }
        return {
          string: JSON.stringify(ob),
          object: ob,
        }
      });
      tempData = obj;
    } else {
      tempData = [{ string: 'Ni podatkov', object: null }];
    }

    if ((await this.syncLib.getConflictDB()).tableExists(testSchema)) {
      const obj = (await (await this.syncLib.getConflictDB()).table(testSchema).toArray()).map(item => {
        const ob = { uuid: item.objectUuid, object: item.record, conflicts: item.conflicts, beData: item.record}
        return {
          string: JSON.stringify(ob),
          object: ob,
        }
      });
      conflictData = obj;
    } else {
      conflictData = [{ string: 'Ni podatkov', object: null }];
    }

    const endData = [];
    const maxTableIndex = max([syncData.length, tempData.length, conflictData.length, 0]);
    for (let i = 0; i < maxTableIndex!; i++) {
      const dd = { sync: { string: 'Ni podatkov', object: null }, temp: { string: 'Ni podatkov', object: null }, conflict: { string: 'Ni podatkov', object: null } };
      if (i <= syncData.length - 1) {
        dd.sync = syncData[i];
      }
      if (i <= tempData.length - 1) {
        dd.temp = tempData[i];
      }
      if (i <= conflictData.length - 1) {
        dd.conflict = conflictData[i];
      }
      endData.push(dd);
    }
    return endData;
  }
  async ngOnInit(): Promise<void> {
    this.syncLib = new SynchronizationLibrary(false, false, DEFAULT_MERCURE_SYNC_POLICY, this.simulation.agentId, false);
    await this.syncLib.finishSetup();
    this.displayedData = await this.getData('sync');
    this.eventsSubscription = SynchronizationLibrary.eventsSubject.subscribe(
      async (event: SyncLibraryNotification) => {
        this.consoleOutput.output(`SIMULATION -> events subscription:`, event);
        this.displayedData = await this.getData('sync');
        // if (event.type === SyncLibraryNotificationEnum.NETWORK_UNAVAILABLE) {
        //   SynchronizationLibrary.eventsSubject.next({ type: SyncLibraryNotificationEnum.BATCH_SYNC_FINISHED, message: 'finished' } as SyncLibraryNotification);
        // }
      }
    );
  }

  public async resolveConflict(uuid: any, conflictId: any, entityName = 'testEntity', useRemote: boolean = true) {
    useRemote = this.basicInputForm.controls['conflictUseRemove'].value;
    await this.syncLib.resolveConflict(uuid, entityName, conflictId, useRemote);
  }

  public setDataInForm(item: any) {

    this.basicInputForm.controls['uuidValues'].setValue(item.uuid);
    this.basicInputForm.controls['firstInput'].setValue(item.object.firstInput);
    this.basicInputForm.controls['secondInput'].setValue(item.object.secondInput);
  }

  public async storeDataFromForm(useExistingId: boolean = false, recordId = '8b292617-ef08-4ce9-8e7b-161dddc92e5d') {
    recordId = this.basicInputForm.controls['uuidValues'].value ?? recordId;
    const formData = {
      'firstInput': this.basicInputForm.controls['firstInput'].value,
      'secondInput': this.basicInputForm.controls['secondInput'].value
    };
    const savedData = await this.syncLib.storeNewObject('testEntity', useExistingId ? recordId : uuidv4(), formData);
    this.resetObjectFormData();
  }

  resetObjectFormData() {
    this.setDataInForm({uuid: '', object: { firstInput: '', secondInput: ''}});
    // this.basicInputForm.controls['uuidValue'].setValue('');
    // this.basicInputForm.controls['firstInput'].setValue('');
    // this.basicInputForm.controls['secondInput'].setValue('');
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

  public async startBatchSync() {
    this.syncLib.agentId = this.basicInputForm.controls['browserName'].value ?? uuidv4();
    await this.syncLib.startBatchSync();
  }

  setAgentId(event: any) {
    // this.syncLib.agentId 
    // this.consoleOutput.output(`'ggg'`, event?.target?.['value']);
    this.syncLib.agentId = event.target.value;
  }

  public async startBEInitialState(entityName: string = 'TestEntity') {
    if (entityName === 'TestEntity') {
      await axios.get(`${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/refactored/initiate_initial_be_db_state`).then(
        (response) => {
          this.consoleOutput.output(`Response:`, response);
        },
        (error) => {
          this.consoleOutput.output(`Error: `, error);
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
    this.resetObjectFormData();
  }

}
