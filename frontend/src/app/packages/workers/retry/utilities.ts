import { RetryWorkerResponseStatus } from "../../enums/retry.enum";
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from "../../interfaces/sync-storage.interfaces";

export function createRetryEntry(objectUuid: string, requestUuid: string, retries: number = 0) {
    return {
        objectUuid,
        requestUuid,
        retries,
        createdDatetime: new Date(),
    } as RetryEntryI;
}

export function createSyncingEntry(objectUuid: string, requestUuid: string, retries: number = 0, status = SyncingObjectStatus.in_sync, createdDatetime: Date = new Date(), data: undefined | SyncChamberRecordStructure = undefined) {
    return {
        objectUuid,
        requestUuid,
        retries,
        status,
        data: data,
        createdDatetime
    } as SyncingEntryI
}

export interface SyncEntryI {
    //'&localUUID,changes,lastModified,record,objectStatus',
    localUUID: string;
    changes: any[];
    lastModified: Date | null | undefined;
    record: any;
    objectStatus: ChamberSyncObjectStatus;
}

export interface TempEntryI extends SyncEntryI {}

export interface RetryEntryI {
    objectUuid: string;
    requestUuid: string;
    retries: number;
    createdDatetime: Date;
}

export interface SyncingEntryI {
    // objectUuid,requestUuid,status,retries,data,createdDatetime
    objectUuid: string;
    requestUuid: string;
    status: SyncingObjectStatus;
    retries: number;
    data: SyncChamberRecordStructure | undefined;
    createdDatetime: Date | undefined;
}

export enum SyncingObjectStatus  {
    none = 'none',
    in_sync = 'in_sync',
    pending_sync = 'pending_sync',
    synced = 'synced',
    conflicted = 'conflicted',
    pending_retry = 'pending_retry',
  }