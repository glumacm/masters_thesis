import { Component, OnInit } from '@angular/core';
import { AppDB } from '../packages/services/db';
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER, DATABASE_TABLES_SCHEMA_MAPPER } from '../packages/configuration';
import { createEmptySyncEntry } from '../packages/utilities/sync-entity-utilities';
import { v4 as uuidv4 } from 'uuid'
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../packages/interfaces/sync-storage.interfaces';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../packages/utilities/console-style';

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
    const entityName = 'playgroundTesting';
    // pripravimo setup shrambe -> ime: playgroundTesting ; schema: ista kot za SYNC shrambo
    let syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME);
    // await syncingDB.finishSetup();
    // syncingDB = (await AppDB.changeSchema(syncingDB, DATABASE_TABLES_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]));
    syncingDB = (await AppDB.changeSchema(syncingDB, {[entityName] : DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME]}));
    
    syncingDB.close();
    await syncingDB.open();
    // await syncingDB.changeSchemaInstance(syncingDB, { [entityName]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] });

    // vstavimo prvi podatek v shgrambo
    const syncRecord = createEmptySyncEntry(uuidv4(), [], {'something': 'somteghing dark side'}, ChamberSyncObjectStatus.synced);
    syncingDB.table(entityName).add(syncRecord, syncRecord.localUUID);

    syncingDB.table(entityName).where({'localUUID': syncRecord.localUUID}).modify((obj) => this.modifyCallback(obj, {'something': 'differnet'}));
    // poskusimo .apply metodo
    


    // pobrisi podatek iz baze
    syncingDB.table(entityName).delete(syncRecord.localUUID);
  }

  modifyCallback(object: SyncChamberRecordStructure, somethingElse: any) {
    this.consoleOutput.output(`this is working`, object);
    this.consoleOutput.output(`this is the second arghument  ` , somethingElse);
  }
  
}
