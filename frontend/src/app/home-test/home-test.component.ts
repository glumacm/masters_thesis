import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
// import * as ts_essentials from 'ts-essentials';
import { ChamberSyncObjectStatus, SyncStorageService } from 'src/app/packages/sync-storage.service';
import { NetworkService } from 'src/app/packages/network.service';
import { ApiService } from 'src/app/packages/api.service';
import { ConflictManagerService, ConflictProcessParameters } from 'src/app/packages/conflict-manager.service';
import { Operation } from 'fast-json-patch';
import { DeferredPromise } from 'src/app/packages/utilities/deferred';
import { NetworkStatusEnum } from '../packages/interfaces/network-status.interfaces';
import { DatabaseUtility } from '../packages/utilities/database-utility';
import { throwError } from 'rxjs';
import { console_log_with_style, CONSOLE_STYLE } from '../packages/utilities/console-style';

import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from '../packages/configuration';
import { AppDB } from '../packages/services/db';
import { RetryPushNotificationStatusEnum } from '../packages/interfaces/retry-sync.interfaces';
import { v4 as uuidv4 } from "uuid";
import { SyncLibraryService } from '../services/sync-library.service';


interface BasicForm {
  firstInput: string;
  secondInput: string;
}

@Component({
  selector: 'app-home-test',
  templateUrl: './home-test.component.html',
  styleUrls: ['./home-test.component.scss']
})
export class HomeTestComponent implements OnInit {

  firstInput: string = 'Initial value';
  readonly basicForm: FormGroup;
  readonly initialState: BasicForm;
  private databaseTemp: DatabaseUtility;
  private testDB: AppDB | undefined;

  constructor(
    private syncStorageService: SyncStorageService,
    private networkService: NetworkService,
    private apiService: ApiService,
    private conflictManagerService: ConflictManagerService,
    private syncLibService: SyncLibraryService,
  ) {


    this.basicForm = this.createBasicFormGroup();
    this.initialState = this.basicForm.value;


    this.databaseTemp = new DatabaseUtility();
    this.databaseTemp.openDatabase(window, this.syncStorageService.SYNC_TEMP_DATABASE_NAME);
  }

  async ngOnInit(): Promise<void> {

    this.testDB = new AppDB();
    await this.testDB.finishSetup();

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


  public update(): void {
    this.update1();
  }

  public startEntityObjectSync(entityName: string = 'example_table') {
    this.syncLibService.startEntityObjectSync(entityName, 'backInThe90s');
  }

  public clickOnlineEvent(): void {
    const onlineEvent = new Event('online');
    window.dispatchEvent(onlineEvent);
  }

  public clickOfflineEvent(): void {
    const offlineEvent = new Event('offline');
    window.dispatchEvent(offlineEvent);
  }

  public async update1(): Promise<void> {

    /**
     * PREDPOSTAVKE:
     * 
     * 1. Trenutno imamo na FE cisto isti OBJEKT kot je na BE. V nasprotnem primeru bom imel veliko nepotrebnih DIFF-ov. V kolikor bo potrebno rešiti ta problem glede celovitosti objekta predlagam:
     *    a. da, ko dobimo BE objekt, naredimo _.pick na podlagi fieldov, ki jih FE ima in nato združimo te objekte skupaj?
     *    b. da imamo definicije objektov tocno take kot so na FE. Torej ce FE ima le 2 fielda, bo moral BE API znat shraniti le del objekta
     * 2. KONFLIKTI, morajo preverjati točno specifičen field za datum. V kolikor ne bomo preverjali pravega datuma lahko pride do tega, da povozi neke podatke, ki jih nisemo še prenesli iz FE na BE.
     *    a. ne pozabimo, uporabnik klikne na SAVE in pričakuje da so vse stvari "tipi topi".
     * 
     * 3. diff bomo vedno delali na prvem nivoju objekta. Ne bomo handlali primerov, ko bodo objekti v vec nivojih.
     * 
     */


    /**
     * Sklepamo da update object je del konfiguracije, torej ta razred/objekt moramo sinhronizirati
     */

    const dataToSend = this.basicForm.value;

    // 1. Preveri ali je objekt v in-sync statusu?

    if (dataToSend?.id || dataToSend?.uuid) {
      // We are NOT in INSERT MODE
      throw new Error('This use-case is not yet considered and programmed - Missing implementation for existing id/uuid');

    }

    const objectID = 2;
    const predefined_object_type = 'object_name128';


    // const foundObjectStore = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readonly');
    const foundObjectStore = await this.syncStorageService.retrieveTransationForObjectTypeObs(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readonly').toPromise();

    if (foundObjectStore) {
      /**
       * PRIMER, ko OBJECT STORE za omenjeni objekt obstaja v bazi
       */
      const entryObservable = this.syncStorageService.retrieveEntryFromStoreObservable(foundObjectStore!, objectID);

      // Trenutna predpostavka je da nimamo se `in-sync` delovanja -> torej posledicno lahko vedno izpeljemo proces
      // `in-sync` pomeni, da moramo izracunati spremembe in jih shraniti v "temp"
      let foundEntry = undefined;
      try { foundEntry = await entryObservable.toPromise(); await this.syncStorageService.transactionAsObservable(foundObjectStore.transaction).toPromise(); }
      catch (exception) {
        throw new Error('This use-case is not yet considered and programmed - Cannot retrieve data from: ' + this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type + '  for ID: ' + objectID)
      }

      if (!foundEntry) {
        /**
         * PRIMER KO OBJEKT OBSTAJA V OBJECT STORE-U
         * Object ne obstaja v shrambi; Podatek bo poslan na BE ampak pred tem ga moramo tudi shraniti v shrambo;
         */

        // const predefinedStoreWriteAccess = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite'); // objectStore Exists!
        const predefinedStoreWriteAccess = await this.syncStorageService.retrieveTransationForObjectTypeObs(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite').toPromise(); // objectStore Exists!

        // Spodnja vrstica je uporabna, ko testiramo primer, da zapise shranjeni objekt v TEMP!!!
        // const preparedData = this.syncStorageService.prepareSyncRecordChamberStructure(dataToSend, undefined, undefined, ChamberSyncObjectStatus.in_sync);
        const preparedData = this.syncStorageService.prepareSyncRecordChamberStructure(dataToSend, undefined, undefined, ChamberSyncObjectStatus.pending_sync);

        if (!predefinedStoreWriteAccess) { throw new Error('This use-case is not yet considered and programmed - object store: ' + this.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + predefined_object_type + ' does not exist!'); }

        try {
          const entryAdded = await this.syncStorageService.addEntryToStoreObserv(predefinedStoreWriteAccess, objectID, preparedData).toPromise();
          throw new Error('Missing implementation after we TRY to STORE object data to chamber FIRST');

          // Shrani objekt na BE
          const storedObject = await this.apiService.storeObjectInBE(predefined_object_type, preparedData.record).toPromise().then(
            (_) => {
              console_log_with_style('NEW ENTRY in object store, was added to BE - new function', CONSOLE_STYLE.promise_success!);
            },
            (_) => {
              console_log_with_style('NEW ENTRY in object store was NOT added to BE', CONSOLE_STYLE.promise_error!);
            }
          );
          if (entryAdded) { } else { }
        } catch (error) { this.throwException('This use-case is not yet considered and programmed - error while adding data to objectstore', error); }

      } else {
        /**
         * PRIMER KO OBJEKT !! NE !! OBSTAJA V OBJECT STORE-U
         */

        if (foundEntry.objectStatus === ChamberSyncObjectStatus.in_sync) {
          // if in-sync -> pomeni, da imamo nek web_worker, ki trenutno sinhronizira objekt
          // shrani objekt v TEMP chamber
          // let predefinedTempStoreWriteAccess = await this.syncStorageService.retrieveTransationForObjectTypeObs(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite').toPromise();
          let predefinedTempStoreWriteAccess = await this.databaseTemp.retrieveTransationForObjectTypeObs(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite').toPromise();
          // let predefinedTempStoreWriteAccess = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite');
          // let tempTransaction = this.syncStorageService.retrieveTransationForObjectType(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite');

          // let predefinedTempStoreWriteAccess = tempTransaction?.objectStore(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type);
          // await this.syncStorageService.transactionAsObservable(tempTransaction!).toPromise();





          if (!predefinedTempStoreWriteAccess) {
            /**
             * PRIMER, KO OBJECT STORE V !! TEMP !! BAZI NE OBSTAJA
             */

            // object store does not exist
            // create it


            // this.syncStorageService.getSyncDB()?.close();
            const outsidePromise = new DeferredPromise()
            try {
              await this.databaseTemp.openDatabase( // Ta zadeva bi morala poslati rezultat v `onupgradeneeded` funkciji
                window,
                // this.syncStorageService.SYNC_DATABASE_NAME,
                this.syncStorageService.SYNC_TEMP_DATABASE_NAME,
                this.syncStorageService.getSyncDB()?.version! + 1,
                async (ev: Event) => {

                  const target = ev.target as IDBRequest;
                  const database = target.result as IDBDatabase;
                  const transaction = database.createObjectStore(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type);

                  // wait for transaction to finish
                  await this.syncStorageService.transactionAsObservable(transaction.transaction).toPromise();

                  this.databaseTemp.setDatabase(database);
                  // this.syncStorageService.setSyncDB(database);
                  outsidePromise.resolve(database);
                },
                outsidePromise,
              ).then();

              // Since we created changes in the database it seems that we need to re-open if we want to receive latest instance in the 'syncStorageService' .........
              // this.syncStorageService.getSyncDB()?.close();
              predefinedTempStoreWriteAccess = await this.databaseTemp.retrieveTransationForObjectTypeObs(this.syncStorageService.SYNC_TEMP_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite').toPromise(); // objectStore Exists!

              // await this.syncStorageService.addEntryToStoreObserv(predefinedTempStoreWriteAccess!, objectID, dataToSend).toPromise();
              await this.databaseTemp.addEntryToStoreObserv(predefinedTempStoreWriteAccess!, objectID, this.syncStorageService.prepareStructureForTempChamber(dataToSend)).toPromise();

              await this.syncStorageService.transactionAsObservable(predefinedTempStoreWriteAccess!.transaction).toPromise();

            }
            catch (exception) {
              this.throwException('Nismo prisli do konca');
              return;
            }
          } else {
            // TEMP USE-CASE, but object store already exists

            // await this.syncStorageService.addEntryToStoreObserv(predefinedTempStoreWriteAccess!, objectID, this.syncStorageService.prepareStructureForTempChamber(dataToSend)).toPromise();
            await this.databaseTemp.addEntryToStoreObserv(predefinedTempStoreWriteAccess!, objectID, this.syncStorageService.prepareStructureForTempChamber(dataToSend)).toPromise();

            await this.syncStorageService.transactionAsObservable(predefinedTempStoreWriteAccess!.transaction).toPromise();
          }
          return;

        } else {
          /**
           * OBJECT STORE ZA OBJEKT OBSTAJA
           * in
           * status objekta je v 'synced' ali 'pending_sync' (ce cakamo prenos na BE, se lahko vmes popravi podatek v shrambi)
           */

          // do normal process with existing entry

          // MOGOCE BI IMELO SMISEL, da nastavim prvo status objekta na 'in_sync' zato, da ga kaksen zaledni proces, ne bi zajel ..
          // .. in na koncu, bi ponovno shranil objekt v shrambo s statusom 'synced' | 'pending_sync' , odvisno kaj smo naredili.
          const preparedRecord = this.syncStorageService.calculateDifferencesAndPrepareSyncRecordChamberStructure(foundEntry, dataToSend, ChamberSyncObjectStatus.in_sync);
          preparedRecord.objectStatus = ChamberSyncObjectStatus.in_sync;
          const predefinedStoreWriteAccess = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite'); // objectStore Exists!

          if (!predefinedStoreWriteAccess) { this.throwException('This use-case is not yet considered and programmed - cannot retrieve OBJECT STORE: ' + this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, null); }
          await this.testDB?.table('SyncDB_object_name128').update(objectID, preparedRecord);
          console_log_with_style(
            'TOREJ SMO USPELI SHRANITI V BAZO',
            CONSOLE_STYLE.white_and_black!
          );


          try {
            return;
            // throwError('Something something');
            const dataStored = undefined; // await this.syncStorageService.addEntryToStoreObserv(predefinedStoreWriteAccess, objectID, preparedRecord).toPromise();
            if (dataStored) { // DATA IS SUCCESSFULLY STORED TO CHAMBER !!!

              if (this.networkService.status.value) { // CHECK IF WE HAVE NETWORK CONNECTION
                // Potrebno premisliti, ali mora ta funkcija kaj vrniti!!!

                await this.conflictManagerService.potentialFunctionInConflictServiceForConflictProcess(
                  {
                    predefined_object_type,
                    difference_from_BE_to_local_object: {} as Operation[],
                    objectFromBE: {},
                    local_updated_at: new Date(2023, 3, 4),
                    objectID,
                    predefinedStoreWriteAccess,
                    preparedRecord,
                    syncStorageService: this.syncStorageService,
                    apiService: this.apiService,

                  } as ConflictProcessParameters<any>
                );

                return;
              } else {
                // store data to TEMP, so that later when we get back online, we send data to BE
                /**
                 * Ali res rabimo shraniti v TEMP? A ne bi bilo dovolj, bi je pravi status nastavljen in potem naredimno sync glede na status?
                 * Mislim da je dovolj, da hranim pravilen status, vendar je potrebno potem v subscribe, kjer se pozene web worker narediti dodatno logiko, ki bo pobrala BE objekt za vsak objekt v queue in naredilo conflict check
                 */
                this.throwException('This use-case is not yet considered and programmed - IF NETWORK DATA IS NOT AVAILABLE: then do nothing, until network data is back on, then try to do code in the TRUE condition!!!!!!');
              }
            } else { this.throwException('This use-case is not yet considered and programmed - CANNOT STORE calculated (diff, updated, et.c) data to FE chamber!!!!'); }
          } catch (error) { this.throwException('This use-case is not yet considered and programmed - CANNOT Add UPDATED data from UI to FE chamber!!!!', error); }
        }
      }

      // vsa nadaljna logika mora preiti v "onsuccess/onerror" handlerje, saj se tam noter dobi rezultate/napake
      // ideja kako to pretvoriti mogoce v nekaj smiselnega za uporabo preko modula, bi bilo, da bi se ustvarilo PROMISE/Observable in rezultat vrnilo preko tega

    } else {
      /**
       * To je primer, ko nimamo OBJECT STORE-a v bazi in ga je potrebno dodati.
       */

      const outsidePromise = new DeferredPromise()
      this.syncStorageService.getSyncDB()?.close;
      try {
        await this.syncStorageService.openDatabase( // Ta zadeva bi morala poslati rezultat v `onupgradeneeded` funkciji
          this.syncStorageService.SYNC_DATABASE_NAME,
          this.syncStorageService.getSyncDB()?.version! + 1,
          async (ev: Event) => {
            const target = ev.target as IDBRequest;
            const database = target.result as IDBDatabase;
            database.createObjectStore(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type);
            this.syncStorageService.setSyncDB(database);
            outsidePromise.resolve(database);

            // potrebno je anrediti isto stvar kot ce obstaja object store ampak nimamo se keya noter
            // Object ne obstaja v shrambi; Podatek bo poslan na BE ampak pred tem ga moramo tudi shraniti v shrambo;

          },
          outsidePromise,
        );

        // Since we created changes in the database it seems that we need to re-open if we want to receive latest instance in the 'syncStorageService' .........
        await this.syncStorageService.openDatabase(this.syncStorageService.SYNC_DATABASE_NAME);

        const predefinedStoreWriteAccess = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite'); // objectStore Exists!
        const preparedData = this.syncStorageService.prepareSyncRecordChamberStructure(dataToSend, undefined, undefined, ChamberSyncObjectStatus.pending_sync);

        if (!predefinedStoreWriteAccess) { throw new Error('This use-case is not yet considered and programmed - object store: ' + this.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + predefined_object_type + ' does not exist!'); }

        try {
          /**
           * Kaj vemo o tem primeru?
           * - Vemo, da objekt ne obstaja v shrambi
           * - ne moremo vedeti, ali objekt obstaja na BE ali ne
           * 
           * Sklepam, da bom moral preverjati, ali imamo uuid/id podatek nastavljen na objektu.
           * Hmm.. mislim, da bo ta knjiznica morala delovati tako, da bo vedno bil prisoten uuid (ce bo prvic ustvarjen objekt se bo uuid moral ustvariti preko FE)
           */
          // Ali potrebujemo logiko, da se prvo poisce na BE ali obstaja ta objekt in nato da se naredi razliko med konflikti?

          // ZAENKRAT TA DEL LOGIKE DELUJE TAKO, da se PREDPOSTAVLJA, da objekt, še ni bil dodan na BE, torej ne rabimo vzeti podatka iz BE.
          // MORAMO PA VSEENO poskrbeti, da ga posljemo na BE!!!!
          const entryAdded = await this.syncStorageService.addEntryToStoreObserv(predefinedStoreWriteAccess, objectID, preparedData).toPromise();
          // Shrani objekt na BE
          const storedObject = await this.apiService.storeObjectInBE(predefined_object_type, preparedData.record).toPromise();



          // There is missing logic to check BE object and to send to BE !!!!
        } catch (error) { this.throwException('This use-case is not yet considered and programmed - error while adding data to objectstore', error); }

      }
      catch (e) {
        this.throwException('Some unknown stuff errror', e);
        return;
      }
    }

    this.networkService.getNetworkStatus().then(
      (networkStatus) => {

      },
      (networkError) => {
        this.throwException('Network service error', networkError);
      }
    )
    return;
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
