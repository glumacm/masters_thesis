import { Component, OnInit } from '@angular/core';
import { AppDB } from '../packages/services/db';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, DATABASE_TABLES_SCHEMA_MAPPER } from '../packages/configuration';
import { createEmptySyncEntry } from '../packages/utilities/sync-entity-utilities';
import { v4 as uuidv4 } from 'uuid'
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../packages/interfaces/sync-storage.interfaces';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';
import { plainToInstance } from 'class-transformer';
import { SyncLibraryNotification } from '../packages/models/event/sync-library-notification.model';
import { SyncLibraryNotificationEnum } from '../packages/enums/event/sync-library-notification-type.enum';
import { DataSizeService } from '../packages/services/data-size-service';
import { StopwatchService } from '../packages/services/stopwatch-service';

@Component({
  selector: 'app-playground',
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.scss']
})
export class PlaygroundComponent implements OnInit{

  private consoleOutput: CustomConsoleOutput;
  constructor() {
    this.consoleOutput = new CustomConsoleOutput('playground', CONSOLE_STYLE.sync_lib_main_positive_vibe);
  }

  async ngOnInit(): Promise<void> {
    await this.playgroundFunction();
  }

  async playgroundFunction() {
    const stopwatch = new StopwatchService(true);
    const entityName = 'playgroundTesting';
    // pripravimo setup shrambe -> ime: playgroundTesting ; schema: ista kot za SYNC shrambo
    stopwatch.createIntermediateTime();
    let syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME);
    stopwatch.createIntermediateTime();
    // await syncingDB.finishSetup();
    // syncingDB = (await AppDB.changeSchema(syncingDB, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]));
    syncingDB = (await AppDB.changeSchema(syncingDB, {[entityName] : DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]}));
    stopwatch.createIntermediateTime();
    syncingDB.close();
    stopwatch.createIntermediateTime();
    await syncingDB.open();
    stopwatch.createIntermediateTime();
    // await syncingDB.changeSchemaInstance(syncingDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });

    // vstavimo prvi podatek v shgrambo
    stopwatch.createIntermediateTime();
    const syncRecord = createEmptySyncEntry(uuidv4(), [], {'something': 'somteghing dark side'}, ChamberSyncObjectStatus.synced);
    stopwatch.createIntermediateTime();

    syncingDB.table(entityName).add(syncRecord, syncRecord.localUUID);
    stopwatch.createIntermediateTime();
    syncingDB.table(entityName).where({'localUUID': syncRecord.localUUID}).modify((obj) => this.modifyCallback(obj, {'something': 'differnet'}));
    // poskusimo .apply metodo
    stopwatch.createIntermediateTime();
    


    // pobrisi podatek iz baze
    syncingDB.table(entityName).delete(syncRecord.localUUID);
    stopwatch.createIntermediateTime();
    stopwatch.stop();
    this.consoleOutput.output(`This is the end of stopwatch: ${stopwatch.showTime()}`);
    this.consoleOutput.output(`This laps of stopwatch: ${stopwatch.showIntermediateTimes()}`);
  }

  modifyCallback(object: SyncChamberRecordStructure, somethingElse: any) {
    this.consoleOutput.output(`this is working`, object);
    this.consoleOutput.output(`this is the second arghument  ` , somethingElse);

    const dataSizeService = new DataSizeService();
    this.consoleOutput.output(`bring sally up`, dataSizeService.getCurrentSizeCount());
    const testObject = {
      'just': new Date(),
      'from': 'everything',
      'blackes': 45,
      'dont': {
        'how': 'could you',
        'no': 45.454,
        'need': plainToInstance(SyncLibraryNotification, {createdAt: new Date(), type: SyncLibraryNotificationEnum.ALREADY_CONFLICTED, message: 'how could you do it iiiiii'}),
      }
    }
    const testObjectSize = dataSizeService.calculateDataSize(testObject);
    this.consoleOutput.output(`current status is:  `, dataSizeService.getCurrentSizeCount());
    this.consoleOutput.output(`returend calculated:  `, testObjectSize);

    const calculatedString = dataSizeService.calculateDataSize('Adn when it rains:');
    this.consoleOutput.output(`Returned calculated: `, calculatedString);
    this.consoleOutput.output(`current size count: `, dataSizeService.getCurrentSizeCount(DataSizeService.KILOBYTES_DIVIDER));
    
  }
  
}
