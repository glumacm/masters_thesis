import { ResponseMessageType, SyncEntityWithCommandsWorkerCommandEnum, SynchronizationSyncStatus } from "../enums/sync-process.enum";

export interface SynchronizationPostData {
    class_name: string;
    object_data: any;
    id: any; 
    action: any;
    last_db_modified: Date;
}

export interface SynchronizationSyncEntityPostData {
    entityName: string;
    jobUuid: string;
    data: SynchronizationSyncEntityRecord[];
}

export interface SynchronizationSyncEntityRecord {
    localUUID: string;
    lastModified: Date | null;
    record: any;
}

export interface SynchronizationSyncEntityEncodedRecord extends SynchronizationSyncEntityRecord {
    record: Uint8Array;
}

export interface ResponseMessage
{
    code: number;
    message: string;
    type: ResponseMessageType,
    data: SynchronizationSyncResponse;
}

export interface SynchronizationSyncedObject {
    localUuid: string;
    lastModified: string;
}

export interface SynchronizationSyncResponse {
    syncStatus: SynchronizationSyncStatus, // should be passed as string from SynchronizationSyncStatus enum
    finishedSuccessfully: SynchronizationSyncedObject[],
}

export interface SyncEntityWorkerResponse {
    data: SynchronizationSyncResponse;
    code: number;
    status: SynchronizationSyncStatus;
}

export interface SyncEntityWithCommandsWorkerResponse {
    command: SyncEntityWithCommandsWorkerCommandEnum;
    data: any;
}