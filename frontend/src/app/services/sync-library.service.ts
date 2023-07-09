import { Injectable } from '@angular/core';
import { SynchronizationLibrary } from '../packages/main';

@Injectable({
  providedIn: 'root'
})
export class SyncLibraryService {

  /**
   * This service is access point for entire library
   */
  // private syncLibrary: SynchronizationLibrary;
  constructor() {
    // Inititalize all database
    // Initialize necessary workers
    // etc.
    // all that should be done in main.ts

    // ZACASNO ODSTRANIL odvisnost od SyncLibraryService -> poklicemo syncLib kar direktno kjer rabimo
    // this.syncLibrary = new SynchronizationLibrary();
    // this.syncLibrary.finishSetup(); // This is ASYNC!

  }
  sendEntityRecord(objectName: string) {
    // this.syncLibrary.startSyncEntity(objectName)
  }

  startEntityObjectSync(entityName: string, objectUUID: string) {
    // this.syncLibrary.startSyncEntityObject(entityName, objectUUID);
  }



}
