import { Injectable } from '@angular/core';
// import { Exception } from '@orbit/core';
import { BehaviorSubject, Observable, Subscriber } from 'rxjs';
import * as fast_json_patch from 'fast-json-patch';
import * as _ from 'lodash';
import { AddOperation, Operation, ReplaceOperation } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import { DeferredPromise } from './utilities/deferred';
import { SyncTempChamberRecordStructure } from './interfaces/sync-storage.interfaces';
import { console_log_with_style, CONSOLE_STYLE } from './utilities/console-style';

type syncChamberrecordObjectStatus = 'in-sync' | 'pending-sync' | undefined;
export interface SyncChamberRecordChangesStructure {
  changes: any[];
  changesDatetime: Date | null;
  changesAppliedOnBE: boolean;
}

export enum ChamberSyncObjectStatus {
  none='none',
  in_sync='in_sync',
  pending_sync='pending_sync',
  synced='synced',
  conflicted='conflicted',
}

export interface SyncChamberRecordStructure {
  record: any;
  changes: any[];
  objectStatus: ChamberSyncObjectStatus | undefined | string,
  localUUID?: string,
  lastModified?: Date | undefined;
  // objectStatus: syncChamberrecordObjectStatus
}

@Injectable({
  providedIn: 'root'
})
export class SyncStorageService {

  private syncDB: BehaviorSubject<IDBDatabase | undefined> = new BehaviorSubject<IDBDatabase | undefined>(undefined);
  private syncErrorsDB: BehaviorSubject<IDBDatabase | undefined> = new BehaviorSubject<IDBDatabase | undefined>(undefined);
  private syncTempDB: BehaviorSubject<IDBDatabase | undefined> = new BehaviorSubject<IDBDatabase | undefined>(undefined);
  // private databaseUtilityInstance: DatabaseUtility;

  public readonly SYNC_DATABASE_NAME = 'sync';
  public readonly SYNC_TEMP_DATABASE_NAME = 'sync_temp';
  public readonly SYNC_OBJECT_STORE_PREFIX = 'SyncDB_';
  public readonly SYNC_TEMP_OBJECT_STORE_PREFIX = 'SyncTempDB_'; // This SHOULD be use ONLY when we want to want to update something that is in-sync status!
  public readonly SYNC_ERROR_OBJECT_STORE_PREFIX = 'SyncErrorDB';
  public readonly SYNC_CONFLICT_OBJECT_STORE_PREFIX = 'SyncConflictDB_'; // after this we add object_name (each object_name is it's own STORE)

  constructor(
    // protected theStorageEntity: MemorySource
  ) {
    //@todo: define storage for errors, conflicts, sync

    // we call database utility class getInstance -> if it does not exist then it will create
    // this.databaseUtilityInstance = DatabaseUtility.getDatabaseInstance();

    /**
     * TA STVAR JE POZVROCALA PROBLEME KO SEM MORAL NAREDITI UPGRADE BAZE!!!!!
     * ZATO JE SMISELNO, DA SE BAZO VEDNO UPORABLJA KOT TRENUTNO INSTANCO IN SE NE DELI ISTE INSTANCE PREKO APLIKACIJE,
     * KER LAHKO PRIDE DO KAKSNEGA 'LEAK-A'.
     */
    
    // this.openDatabase(this.SYNC_DATABASE_NAME, undefined, (ev: Event) => {
    //   const target = ev.target as IDBRequest;
    //   this.setInitialTablesInSyncDB(target.result);
    // }).then((success) => this.syncDB.next(success));

  }

  closeDatabase(): Promise<boolean> {
    return new Promise((resolve,reject) => {
      if (this.syncDB.value) {
        this.syncDB.value.onerror = (error) => {
          console_log_with_style('sync storage service L:78 error', CONSOLE_STYLE.promise_error!, error);
          resolve(false);
        }
        this.syncDB.value.onclose = () => {
          resolve(true);
        }

        this.syncDB.value.close();
        this.syncDB.next(undefined);
        resolve(true);
        
      } else {
        resolve(false);
      }
    })
  }

  async openDatabase(databaseName: string, version: number | undefined = undefined, callbackForUpgrade?: (ev: Event) => void, deferredPromise?: DeferredPromise<any>): Promise<IDBDatabase> {  

    if (this.syncDB.value) {
      this.syncDB.value.close(); // close() will not trigger `close` event on indexedDB, so we cannot use that to wait for closed connection
    }
    

    let deferred = deferredPromise ? deferredPromise : new DeferredPromise<any>();    
      const database = window.indexedDB.open(databaseName, version);
      
      if (callbackForUpgrade) {
        database.onupgradeneeded = callbackForUpgrade;
      }

      database.onsuccess = (_: any) => {

        const connection = database.result;
        connection.onversionchange = (e:any) => {
          
          
          connection.close();
          // this.syncDB.next(undefined);
          // deferred.resolve(undefined);
        }
        // we need to notify `syncDB` variable about new value
        this.syncDB.next(database.result);
        deferred.resolve(database.result);
      };
      database.onerror = (_: any) => {
        
        deferred.reject(database.error);
      }

      // To se zgodi, ce ne zapremo obstojece instance baze, preden odpremo bazo z novo verzijo/ali isto verzijo!!!
      database.onblocked = (event:any) => {
        
        deferred.reject(new Error('Database blocked - Usually this is error because existing database connection was not closed, before you start database with newer version'));
      }
    return deferred.promise;
  }


  getSyncDBObservable(): Observable<IDBDatabase | undefined> {
    return this.syncDB.asObservable();
  }

  getErrorDBObservable(): Observable<IDBDatabase | undefined> {
    return this.syncErrorsDB.asObservable();
  }

  getTempDBObservable(): Observable<IDBDatabase | undefined> {
    return this.syncTempDB.asObservable();
  }

  getSyncDB(): IDBDatabase | undefined {
    return this.syncDB.value;
  }

  setSyncDB(database: IDBDatabase | undefined): void {
    this.syncDB.next(database);
  }

  openTransactionForStore(storeName: string, db: IDBDatabase, permission: IDBTransactionMode = 'readwrite'): IDBObjectStore {
    
    return db.transaction(storeName, permission).objectStore(storeName);
  };

  retrieveEntryFromStore(store: IDBObjectStore, key: any): IDBRequest<any> {
    return store.get(key);
  }

  calculateDifferencesAndPrepareSyncRecordChamberStructure(
    existingRecordStructure: SyncChamberRecordStructure,
    dataToSend: any,
    recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
  ): SyncChamberRecordStructure {

    // izracuj razlike
    const diff = fast_json_patch.compare(existingRecordStructure.record, dataToSend);  // obrnemo diff, da bomo lahko prisli iz trenutnega stanja ('record') v prejsnja stanja
    const revertedDiff = this.convertDiffValuesInOpposite(existingRecordStructure.record, cloneDeep(diff));
    return this.prepareSyncRecordChamberStructure(dataToSend, revertedDiff, existingRecordStructure, recordStatus);
  }

  // TA funkcija ima pomojem veliko pomanjkljivosti
  prepareSyncRecordChamberStructure(
    recordValue: any,
    changes: any,
    existingRecord: SyncChamberRecordStructure | undefined,
    recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // recordStatus: syncChamberrecordObjectStatus = 'pending-sync',
    changesDatetime: Date = new Date()
  ): SyncChamberRecordStructure {
    let record: SyncChamberRecordStructure | undefined = cloneDeep(existingRecord);

    if (!record) {
      record = this.createEmptyChamberRecord(undefined, undefined, recordStatus);
    }

    if (recordValue) {
      record.record = recordValue;
    }

    if (!record?.changes && changes) {
      record.changes = [];
    }

    if (changes) {
      
      const newChanges = {
        changes,
        changesDatetime: new Date(),
        changesAppliedOnBE: false
      } as SyncChamberRecordChangesStructure
      record.changes.push(newChanges);
    }

    return record;
  }

  prepareStructureForTempChamber(
    record: any,
  ): SyncTempChamberRecordStructure {
    return {
      record,
      datetimeAdded: new Date(),
    } as SyncTempChamberRecordStructure;
  }

  createEmptyChamberRecord(
    changes: SyncChamberRecordChangesStructure[] | undefined,
    record: any,
    objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // objectStatus: syncChamberrecordObjectStatus = 'pending-sync'
  ): SyncChamberRecordStructure {
    return {
      changes: changes,
      // changes: changes ?? [],
      record: record ?? undefined,
      objectStatus
    } as SyncChamberRecordStructure;
  }

  retrieveEntryFromStoreObservable(objectStore: IDBObjectStore, key: any): Observable<SyncChamberRecordStructure | undefined> {

    const observableRequest = new Observable((observer: Subscriber<any>) => {
      const objectStoreRequest: IDBRequest = objectStore.get(key);
      objectStoreRequest.onsuccess = (ev: Event) => {
        const target: IDBRequest = ev.target as IDBRequest; //target.result vsebuje nas rezultat
        this.finishObservable(observer, target.result);
      }

      objectStoreRequest.onerror = (ev: Event) => {
        const target: IDBRequest = ev.target as IDBRequest;
        // we do not care about error. If objectStoreReturnsError it is the same as if entry does not exist
        // S 'promise' sem dejansko vrnil napako. Zato dajmo trenutno uporabiti napako da bomo med razvojem identificrali razlicne napake...
        // ... nasplosno pa tukaj nas ne bi smelo skrbeti za napake
        this.finishObservable(observer, undefined);
      }
    });
    return observableRequest;
  }

  retrieveTransationForObjectType(predefined_object_type: string, access_type: IDBTransactionMode = 'readonly'): IDBTransaction | undefined {
    
    return this.syncDB.value?.transaction(predefined_object_type, access_type);
  }

  retrieveTransationForObjectTypeObs(predefined_object_type: string, access_type: IDBTransactionMode = 'readonly'): Observable<IDBObjectStore | undefined> {
    
    return new Observable(observer => {
      const exists = this.syncDB.value!.objectStoreNames.contains(predefined_object_type);
      if (exists) {
        
        this.finishObservable(observer, this.retrieveObjectStoreIfExists(predefined_object_type, access_type));
      } else {
        this.finishObservable(observer, undefined);
      }
      // try {
      //   const transaction = this.syncDB.value!.transaction(predefined_object_type, access_type);
      //   transaction.onerror = (err) => {
      //     this.finishObservable(observer,undefined);
      //   }
      //   const objectStore = transaction.objectStore(predefined_object_type);
      //   observer.next(objectStore);
      // }catch(exception) {
      //   this.finishObservable(observer, undefined);

      // }
      
    });
  }

  retrieveObjectStoreIfExists(predefined_object_type: string, access_type: IDBTransactionMode = 'readonly'): IDBObjectStore | undefined {
    /**
     * Predpostavke:
     * 1. APP_INITIALIZER se je ze izvedel
     * 2. naceloma bi bilo dobro vedeti zakaj pride do napake, ampak v tej funkciji nas samo zanima ali
     * obstaja 'objectStore' ali ne. Ce dobimo napako pac pomeni, da ne obstaja
     * 3. Zakomentiral bom del kode preko katere vidimo kako loviti napako
     */
    // var readonlyTransationToPredefinedObject = undefined;
    // try {
    //   readonlyTransationToPredefinedObject = this.openTransactionForStore(predefined_object_type, this.getSyncDB()!, 'readonly');
    // } catch (exception) {
    //   const ex = exception as DOMException;
    //   if (ex.code === DOMException.NOT_FOUND_ERR) {
    //     // object store not found
    //     console.error('###findExistingObjectStore - not found exception');
    //   } else {
    //     // some other error
    //   }

    // } finally {
    //   return readonlyTransationToPredefinedObject;
    // }

    try {
      
      return this.openTransactionForStore(predefined_object_type, this.syncDB.value!, access_type);
    } catch (exception) {
      
      return undefined;
    }
  }

  addEntryToStore(store: IDBObjectStore, key: any, value: any): IDBRequest<any> {
    return store.add(value, key);
  }

  removeEntryFromStore(store: IDBObjectStore, key: any): Observable<boolean> {
    return new Observable((observer) => {
      const request = store.delete(key);
      request.onsuccess = (ev: Event) => {
        this.finishObservable(observer, true);
      };
      request.onerror = (ev: Event) => {
        this.finishObservable(observer, false);
      }
    }); 
  }

  addEntryToStoreObserv(store: IDBObjectStore, key: any, value: any, editMode: boolean = false): Observable<boolean> {
    const observableRequest = new Observable((observer: Subscriber<any>) => {
      const request: IDBRequest = store.put(value, key);
      request.onsuccess = (ev: Event) => {
        
        this.finishObservable(observer, true);
      }
      request.onerror = (ev: Event) => {
        
        observer.error(ev);
      }
    });

    return observableRequest;

  }

  retrieveEntryFromStoreObserv(store: IDBObjectStore, key: any): Observable<any> {

    const observableRequest = new Observable((observer: Subscriber<any>) => {
      const request = store.get(key);
      request.onsuccess = (ev: Event) => {
        const target = ev.target as IDBRequest;
        this.finishObservable(observer, target.result);
      }

      request.onerror = (ev: Event) => {
        this.finishObservable(observer, undefined);
      }
    });

    return observableRequest;
  }

  createObjectStore(db: IDBDatabase, objectStoreName: string, storeOptions: any = { autoIncrement: true }): IDBObjectStore {
    return db.createObjectStore(objectStoreName, storeOptions);
  }

  convertDiffValuesInOpposite(currentValue: any, diff: Operation[]) {
    const oppositeDiff: Operation[] = [];
    diff?.forEach(
      (diffValue) => {

        // path: '', op: '',  value: ''
        const obj = diffValue;
        switch (diffValue?.op) {
          case 'replace':
            // ker diffValue.path vsebuje obliko '/<imePolja>' je potrebno uporabiti 'getValueByPointer' da knjiznica pretvori 'path' v pravo obliko
            (obj as ReplaceOperation<any>).value = fast_json_patch.getValueByPointer(currentValue, diffValue.path);
            break;
          case 'add':
            obj.op = 'remove';
            break;
          case 'remove':
            obj.op = 'add';
            (obj as AddOperation<any>).value = fast_json_patch.getValueByPointer(currentValue, diffValue.path);
            break;
          default:

            // vrnemo napako, ker ce pride tukaj do napake pomeni, da je nek problem s knjiznico oz "prekompleksno" strukturo objekta
            throw new Error('Something went wront');
        }
        oppositeDiff.push(obj);
      }
    );

    return oppositeDiff;
  }

  transactionAsObservable(transaction: IDBTransaction): Observable<any> {
    
    return new Observable(observer => {
      transaction.oncomplete = (_) => {
        this.finishObservable(observer, true);
      }
      transaction.onerror = (error) => {
        observer.error(error);
      }
      transaction.onabort = (_) => {
        this.finishObservable(observer,false);
      }
    });
  }

  pickFieldsFromObject(obj: any, targetedObject: any): Pick<any, any> {
    type targetObject = { name: string; fields: string[]}; // Taksen tip mora imeti targetedObject
    return _.pick(obj, targetedObject['fields']);
  }

  private finishObservable(observer: Subscriber<any>, result: any): void {
    observer.next(result);
    observer.complete();
  }

  private setInitialTablesInSyncDB(db: IDBDatabase): void {
    // To se mora pognati, ko se naredi nova verzija baze, ali ko se prvic naredi baza (preko .open funkcije)
    db.createObjectStore(this.SYNC_OBJECT_STORE_PREFIX, { autoIncrement: true }); // Sync records
    db.createObjectStore(this.SYNC_ERROR_OBJECT_STORE_PREFIX, { autoIncrement: true }); // Error entries
    db.createObjectStore(this.SYNC_TEMP_OBJECT_STORE_PREFIX, { autoIncrement: true }); // Temp entries
  }

  private setInitialTablesInErrorsDB(db: IDBDatabase): void {
    db.createObjectStore('ErrorDB', { autoIncrement: true });
  }

  private setInitialTablesInTempDB(db: IDBDatabase): void {
    db.createObjectStore('TempDB', { autoIncrement: true });
  }
}
