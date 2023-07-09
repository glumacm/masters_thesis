/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { Table } from "dexie";
import { firstValueFrom, of } from "rxjs";
import { AppDB } from "src/app/packages/services/db";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../../configuration";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";


let database: AppDB;

addEventListener('message', async ({ data }) => {
    console_log_with_style('WEEEELLL  BOOOOYYYYYY --- SECOND TEST WORKER', CONSOLE_STYLE.promise_success!, '');

    // SETUP init stuff for DATABASE - WITHOUT SPECIFYING VERSION
    // database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    // await database.finishSetup();
    database = await getDatabase();


    database.on('versionchange',
        async (event:IDBVersionChangeEvent) => {
            console_log_with_style('THIS IS VERSION CHANGE FROm _SECOND_WORKER_', CONSOLE_STYLE.red_and_black!, event);  
            database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
            await database.finishSetup();
        }
    );

    await delay(1000);

    // const database2 = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
    // await database2.finishSetup();
    console_log_with_style('SECOND_TEST WORKER --> What tables are there [Array:Table[]]: ', CONSOLE_STYLE.red_and_black!, database.tables);
    console_log_with_style('SECOND_TEST WORKER --> What tables are there [Array: String[]]: ', CONSOLE_STYLE.red_and_black!, database.tables.map((table:Table) => table.name));

    postMessage('FINISHED SECOND WORKER');
});

function setVersionChangeListenerToDatabase(database: AppDB): void {
    database.on('versionchange',
        async (event:IDBVersionChangeEvent) => {
            console_log_with_style('THIS IS VERSION CHANGE FROm _SECOND_WORKER_', CONSOLE_STYLE.red_and_black!, event);  
            database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
            await database.finishSetup();
        }
    );
}

function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

async function getDatabase(): Promise<AppDB> {
    if (!database) {
        database = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_RETRY_SYNC_DATABASE_NAME, DATABASE_TABLES_MAPPER);
        await database.finishSetup();
    }
    return firstValueFrom(of(database));
}