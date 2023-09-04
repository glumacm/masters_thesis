

// import { ComponentFixture, fakeAsync, TestBed } from '@angular/core/testing';
// import { RouterTestingModule } from '@angular/router/testing';
// import { AppComponent } from './app.component';
// import { SynchronizationLibrary } from './packages/main';
// import { v4 as uuidv4 } from 'uuid'
// import { SyncEntity } from './packages/workers/object-oriented/sync-entity.worker';

// import * as Comlink from 'comlink';
// import { AppDB } from './packages/services/db';
// import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER_NEW, DATABASE_TABLES_SCHEMA_MAPPER } from './packages/configuration';
// import { first, firstValueFrom, NEVER, of, Subscription } from 'rxjs';

// import * as NetworkCalls from './packages/services/network-calls';
// import { SynchronizationSyncEntityRecord } from './packages/interfaces/sync-process.interfaces';

// describe('AppComponent', () => {
    
//     let library: SynchronizationLibrary;
    
//     let syncWorker: Comlink.Remote<SyncEntity> | undefined;
//     let newUuid: string;
//     let syncDB: AppDB;
//     let syncingDB: AppDB;
//     let testTable: string = 'example_table';
//     let syncDBSubsc: Subscription | undefined;
//     let syncingDBSubsc: Subscription | undefined;

//     beforeAll(async () => { 

//          /**
//          * A lot of commented code below is something I was working on to prepare unit-tests for workers. But this just
//          * does not work, so a lot of code is probably DEPRECATED and not important.
//          */

//         library = new SynchronizationLibrary();
//         const pr:any = ((entityName: string, records: SynchronizationSyncEntityRecord[], requestUuid: string)=> firstValueFrom(of({})));
//         await library.finishSetup();
//         // const port = pr[Comlink.createEndpoint]();
//         // const ff = library.syncEntityInstance![Comlink.createEndpoint]();
//         // pr[Comlink.createEndpoint]()
//         // const dd = Comlink.wrap(await ff);
//         jasmine.createSpy('ss', library.syncEntityInstance!.sync_entity_records_batch).and.returnValue(firstValueFrom(of({dsada:'das'})));
        


//         newUuid = uuidv4();
//         syncWorker = library.syncEntityInstance;

//         syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
//         syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_DATABASE_NAME);

//         const syncDBSubscription = (newDB: AppDB): void => {
//             syncDBSubsc?.unsubscribe();
//             syncDBSubsc = newDB.instanceChanged.subscribe(
//                 {
//                     next: (newDB1) => {
//                         syncDB = newDB1;
//                         syncDBSubscription(newDB1);

//                     }
//                 }
//             )
//         }

//         const syncingDBSubscription = (newDB: AppDB): void => {
//             syncingDBSubsc?.unsubscribe();
//             syncingDBSubsc = newDB.instanceChanged.subscribe(
//                 {
//                     next: (newDB1) => {
//                         syncingDB = newDB1;
//                         syncingDBSubscription(newDB1);

//                     }
//                 }
//             )
//         }

//         syncDBSubscription(syncDB);
//         syncingDBSubscription(syncingDB);
//         // // syncDB = (await library.syncEntityInstance?.getSyncDB())!; // To velja, ker sync se ustvari ob finishSetup()
//         // // syncingDB = (await library.syncEntityInstance?.getSyncingDB())!;


//         // // Ustvari vse podatke, ker je IndexedDB prazna
//         // // syncDB = await AppDB.changeSchema(syncDB, { [testTable]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] })
//         // // syncingDB = await AppDB.changeSchema(syncingDB, { [testTable]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] })
//         // syncingDB = await syncingDB.changeSchemaInstance(syncingDB, { [testTable]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] })
//         await syncDB.changeSchemaInstance(syncDB, { [testTable]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME] })
//         await syncingDB.changeSchemaInstance(syncingDB, { [testTable]: DATABASE_TABLES_SCHEMA_MAPPER[CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME] })











//         // DONT KNOW WHAT TO DO WITH CODE BELOW
//         // syncDB.on('versionchange',
//         //     databaseChange
//         // );
//         // async function databaseChange(event: IDBVersionChangeEvent) {
//         //     syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
//         //     syncDB.on('versionchange', databaseChange);
//         //     await syncDB.finishSetup();
//         // }
//         // library.startSyncEntityObject('example-test', newUuid);

//         // set up some data!!!!
//     })

//     it('should give up on myself', async () => {
//         /**
//          * A lot of commented code below is something I was working on to prepare unit-tests for workers. But this just
//          * does not work, so a lot of code is probably DEPRECATED and not important.
//          * 
//          * Maybe next time try to start with this link to find some real solution for testing workers:
//          * https://github.com/GoogleChromeLabs/comlink/blob/main/tests/worker.comlink.test.js
//          */



//         const tableDoesNotExist = await library.syncEntityInstance?.doesTableExistInSyncDB('example-test');
//         expect(tableDoesNotExist).toBeFalsy();
//         const objectNotexists = await library.syncEntityInstance?.doestEntryExistInSyncDBTable('example_table', newUuid);
//         expect(objectNotexists).toBeFalsy();
//         const entityAndObjectExist = await library.syncEntityInstance?.entityAndObjectExistInSyncDB('example_test', newUuid);
//         expect(entityAndObjectExist).toBeFalsy();

//         // preverimo da je testna tabela prazna
//         expect(await syncDB.table(testTable).count()).toEqual(0);
//         const addedUuid = uuidv4();
//         const currentDatetime = new Date();
//         await syncDB.table(testTable).put({ // &localUUID,changes,lastModified,record,status
//             'localUUID': addedUuid,
//             'changes': [],
//             lastModified: currentDatetime,
//             record: {}
//         }, addedUuid);
//         expect(await syncDB.table(testTable).count()).toEqual(1);
//         expect(await syncDB.table(testTable).get(addedUuid)).toBeTruthy();



//         expect(true).toBeTruthy();

//         const chokeOrShoot = uuidv4();
//         const cu = new NetworkCalls.ExampleClassForComlinkProxy();
//         spyOn(cu, 'exampleFunction').and.returnValue('Master of Gloom is near');
//         await library.syncEntityInstance?.setDependencies(Comlink.proxy({dependency1: cu, sync_entity_records_batch: NetworkCalls.sync_entity_records_batch}));
//         await library.syncEntityInstance?.startObjectEntitySyncProcessRefactored('example_table', {}, chokeOrShoot); // Ce BE ne vrne SUCCESS se bo entry iz SyncingDB pobrisal!!!!
//     })

//     it('should just quit', () => {
//         expect(true).toBeTruthy();
//     });
// });
