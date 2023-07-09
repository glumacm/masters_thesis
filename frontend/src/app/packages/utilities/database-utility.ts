import { Observable, of, Subscriber } from "rxjs";
import { catchError, mergeMap, switchMap } from "rxjs/operators";
import { SyncWorkerResponseValue } from "../interfaces/sync-storage.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";
import { DeferredPromise } from "../utilities/deferred";

export const SYNC_DB_PREFIX_STRING: string = 'SyncDB_';

export class DatabaseUtility {
    private databaseInstance: IDBDatabase | undefined;

    // static instance of the database
    private static instance: DatabaseUtility;

    constructor(private optionalDatabaseInstance?: IDBDatabase) {
        if (optionalDatabaseInstance) {
            this.databaseInstance = optionalDatabaseInstance;
        }
    }

    closeDatabase(): void {
        if (this.databaseInstance) {
            this.databaseInstance.close();
        }
    }

    getDatabase(): IDBDatabase | undefined {
        return this.databaseInstance;
    }

    createObjectStoreObservable(db: IDBDatabase, objectStoreName: string, storeOptions: any = { autoIncrement: true }): Observable<IDBObjectStore | undefined> {
        return new Observable(observer => {
            try {
                const objectStoreTransaction: IDBTransaction = db.createObjectStore(objectStoreName, storeOptions).transaction;
                objectStoreTransaction.oncomplete = (ev) => {
                    this.finishObservable(observer, objectStoreTransaction.objectStore);
                }
                objectStoreTransaction.onabort = objectStoreTransaction.onerror = (ev) => {
                    console.warn('DatabaseUtility - createObjectStoreObservable, onerror/onabour function called: ', ev);
                    this.finishObservable(observer, undefined);
                }
            } catch (exception) {
                console.warn('DatabaseUtility - createObjectStoreObservable, raised an error: ', exception);
                this.finishObservable(observer, undefined);
            }
        });

    }

    retrieveTransationForObjectTypeObs(predefined_object_type: string, access_type: IDBTransactionMode = 'readonly'): Observable<IDBObjectStore | undefined> {

        /** 
         * ##### Se en nacin kako narediti nekaj na daljsi nacin, ampak lahko pride uporabno pri drugih primerih
         * Ok, lahko bi bilo uporabno, da zmanjsamo "kompleksnost" kode in da zadevo resim z of() in .pipe
         */
        const fu = of({})
        return fu.pipe(
            mergeMap(() => {
                const exists = this.databaseInstance!.objectStoreNames.contains(predefined_object_type);
                if (exists)
                    return this.returnObjectStoreIfExists(predefined_object_type, access_type)
                return of(undefined);
            })
        );

        // return new Observable(observer => {
        //     const exists = this.databaseInstance!.objectStoreNames.contains(predefined_object_type);
        //     if (exists) {
        //         this.finishObservable(observer, this.returnObjectStoreIfExists(predefined_object_type, access_type));
        //     } else {
        //         this.finishObservable(observer, undefined);
        //     }
        // });
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
                this.finishObservable(observer, false);
            }
        });
    }

    private finishObservable(observer: Subscriber<any>, result: any): void {
        observer.next(result);
        observer.complete();
    }

    openDatabase(
        context: any,
        databaseName: string = 'sync',
        version: number | undefined = undefined,
        callbackForUpgrade?: (ev: Event) => void,
        deferredPromise?: DeferredPromise<any>,
    ): Promise<IDBDatabase | undefined> {
        // context = context as (typeof globalThis)


        this.closeDatabase();
        const deferred = deferredPromise ? deferredPromise : new DeferredPromise<any>();
        const databaseOpenRequest = context.indexedDB.open(databaseName, version);

        if (callbackForUpgrade) {
            databaseOpenRequest.onupgradeneeded = callbackForUpgrade;
        }

        databaseOpenRequest.onsuccess = (ev: any) => {
            this.databaseInstance = databaseOpenRequest.result;
            deferred.resolve(databaseOpenRequest.result);
        }
        databaseOpenRequest.onerror = (error: any) => {
            deferred.reject(undefined);
        }

        return deferred.promise;

        // return new Promise((resolve, reject) => {
        //     databaseOpenRequest.onsuccess = (ev: any) => {
        //         this.databaseInstance = databaseOpenRequest.result;
        //         resolve(databaseOpenRequest.result);
        //     }
        //     databaseOpenRequest.onerror = (error: any) => {
        //         reject(undefined);
        //     }
        // })


    }

    returnObjectStoreIfExists(objectStoreName: string, transactionMode: IDBTransactionMode = 'readwrite'): Observable<IDBObjectStore | undefined> {
        // db.transaction(storeName, permission).objectStore(storeName);
        // return this.databaseInstance?.transaction(objectStoreName, transactionMode).objectStore(objectStoreName); // This worked before 12.11.2022
        return of(this.databaseInstance?.transaction(objectStoreName, transactionMode).objectStore(objectStoreName));



        // const objectStore = this.databaseInstance?.transaction(objectStoreName, transactionMode).objectStore(objectStoreName);
        // return of({}).pipe(
        //     mergeMap(() => {
        //         const transaction = objectStore?.transaction
        //         if(!transaction) {
        //             return of(objectStore);
        //         } else {
        //             return this.transactionAsObservable(transaction).pipe(
        //                 catchError((err) => of(objectStore)),
        //                 mergeMap(()=> of(objectStore))
        //             )
        //             // transaction.oncomplete = transaction.onerror = transaction.onabort = (ev) => 
        //         }
        //         // return of(objectStore);
        //     })
        // )






        // return new Observable(observer => {
        //     const objectStoreResult = this.databaseInstance?.transaction(objectStoreName, transactionMode).objectStore(objectStoreName);
        //     if (objectStoreResult) {
        //         // objectStoreTransaction.oncomplete = (ev: any) => {
        //         //     const objectStoreResult = objectStoreTransaction
        //         //     // const objectStoreResult = ev.target.result;
        //         //     // this.finishObservable(observer, objectStoreTransaction.objectStore);
        //         //     this.finishObservable(observer, objectStoreResult);
        //         // }

        //         // objectStoreTransaction.onerror = objectStoreTransaction.onabort = (ev) => {
        //         //     this.finishObservable(observer, undefined);
        //         // }
        //     } else {
        //         this.finishObservable(observer, undefined)
        //     }
        // })
    }

    retrieveEntryFromStore(store: IDBObjectStore, key: any): IDBRequest<any> {
        return store.get(key);
    }




    // getAllKeyValueEntriesFromObjectStore(objectStore: IDBObjectStore | undefined): Promise<any[]> {
    getAllKeyValueEntriesFromObjectStore(objectStoreName: string): Promise<SyncWorkerResponseValue[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            if (this.databaseInstance) {

                /**
                 * 1. Get all keys -> DONE
                 * 2. Iterate over each key and retrieve entry for that key
                 * 3. map data -> [key, value]
                 */

                const foundPairs = [] as SyncWorkerResponseValue[];

                // Open cursor
                {
                    // declared variables in this section will not be visiblel outside this block !!!!

                     // Transaction
                     const transaction = this.databaseInstance.transaction(objectStoreName);
                     const transactionObservable = this.transactionAsObservable(transaction);
                     const objectStore = transaction.objectStore(objectStoreName);

                     const request = objectStore.openCursor();

                     request.onsuccess = (ev: any) => {
                        let cursor = ev.target.result;

                        if (cursor) {
                            let key = cursor.primaryKey;
                            let value = cursor.value;
                            console_log_with_style('Data for all keyvalues:', CONSOLE_STYLE.databaseUtilityLogic!, [key, value]);
                            foundPairs.push({entryKey: key, chamberRecord: value} as SyncWorkerResponseValue)
                            cursor.continue();
                        } else {
                            // no more items
                        }
                     }
                     console_log_with_style('WAiting for transaction to finish:', CONSOLE_STYLE.databaseUtilityLogic!);
                     await transactionObservable.toPromise();
                     console_log_with_style('Transaction finished!:', CONSOLE_STYLE.databaseUtilityLogic!);
                     resolve(foundPairs);
 
                }


                // // Section to retrieve all keys
                // {
                //     // Transaction
                //     const transaction = this.databaseInstance.transaction('retrieveDataForObjectStore'+objectStoreName);
                //     const transactionObservable = this.transactionAsObservable(transaction);
                //     const objectStore = transaction.objectStore(objectStoreName);

                //     // Request
                //     const objectStoreKeys = objectStore.getAllKeys();

                //     objectStoreKeys.onsuccess = (result) => {
                //         // requestt has finished
                //         console_log_with_style('Database utility all keys from object store', CONSOLE_STYLE.databaseUtilityLogic!, result);
                        
                //         // All keys
                //         const allKeys = objectStoreKeys.result;

                //         // Get
                //     }

                //     objectStoreKeys.onerror = (err) => {
                //         console.error(`DatabaseUtlity -> retrieve keys from object store ${objectStore.name} error.`, err);
                //         resolve([]);
                //     }

                //     // Wait for transaction to finish
                //     await transactionObservable.toPromise();
                // }

                // // Section to map each key and appropriate value to key
                // {
                //     // Transaction
                //     const transaction = this.databaseInstance.transaction('retrieveDataForObjectStore'+objectStoreName);
                //     const transactionObservable = this.transactionAsObservable(transaction);
                //     const objectStore = transaction.objectStore(objectStoreName);

                //     // Requests
                // }
                
                // }
            } else {
                resolve([]);
            }
        })
    }

    getAllEntriesFromObjectStore(objectStore: IDBObjectStore | undefined): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            if (objectStore) {
                const allEntries = objectStore.getAll();
                allEntries.onsuccess = (result) => {
                    resolve(allEntries.result)
                }

                allEntries.onerror = (err) => {
                    console.error(`DatabaseUtlity -> retrieve data from object store ${objectStore.name} error.`, err);
                    resolve([]);
                }
            } else {
                resolve([]);
            }
        })
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

    setDatabase(db: IDBDatabase): void {
        // this.databaseInstance?.close();
        this.databaseInstance = db;
    }

    static getDatabaseInstance(): DatabaseUtility {
        if (!DatabaseUtility.instance) {
            return new DatabaseUtility()
        }
        return DatabaseUtility.instance;
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

}