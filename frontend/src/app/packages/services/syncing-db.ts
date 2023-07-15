import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../configuration";
import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";
import { AppDB } from "./db";

export class SyncingDB extends AppDB {
     // SYNC_DB should be from now on referenced as CURRENT DB !!!
    static syncingDB: AppDB | undefined;
    constructor(databaseName: string = CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME, tables: { [key: string]: any } = DATABASE_TABLES_MAPPER) {
        console_log_with_style(`ENTER APPDB constructor! --- for table: ${databaseName}`, CONSOLE_STYLE.promise_success!, '');
        super(databaseName, tables);
        
    }

    public async finishStaticSetup(): Promise<void> {
        if (!SyncingDB.syncingDB) {
            const syncing = await this.finishSetup();
            SyncingDB.syncingDB = this;
        }
        
        await new Promise<void>(resolve => resolve());
    }
    


}
