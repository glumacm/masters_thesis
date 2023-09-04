import Dexie from "dexie";

export interface WorkerCheckPendingSyncInput {
    message: string;
    objectStoreName: string;
    databaseName: string;
    transactionMode: IDBTransactionMode;
    databaseVersion?: number | undefined;
  
}

export enum SyncWorkerType {
    FIRST_EXAMPLE=0,
    ENTITY_SYNC=1,
    RETRY_MANAGER=2,
}

export interface SyncPendingObjectWorkerParameters {
    objectName: string;
    database: Dexie;
}