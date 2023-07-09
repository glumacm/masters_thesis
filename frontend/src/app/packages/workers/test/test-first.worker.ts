/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { Table } from "dexie";
import { AppDB } from "src/app/packages/services/db";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../../configuration";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";


addEventListener('message', async ({ data }) => {
    console_log_with_style('WEEEELLL  BOOOOYYYYYY', CONSOLE_STYLE.promise_success!, '');

    // SETUP init stuff for DATABASE - WITHOUT SPECIFYING VERSION
    let database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    await database.finishSetup();

    database.on('versionchange',
    async (event:IDBVersionChangeEvent) => {
        console_log_with_style('THIS IS VERSION CHANGE FROm _FIRST_WORKER_', CONSOLE_STYLE.red_and_black!, event);    
        
    }
    );

    // first test will add new datat here, second test will wait for some time
    if (!database.tables.find((table:Table) => table.name == 'SyncRetryDB_dataFromFirstWorker10')) {
        console_log_with_style(`Test first worker will create new table`, CONSOLE_STYLE.magenta_and_white, null, 2);
        
        database = await AppDB.changeSchema(database, {'SyncRetryDB_dataFromFirstWorker10': '&requestUuid,test1,test11'});
    }

    postMessage('FINISHED FIRST WORKER');
});