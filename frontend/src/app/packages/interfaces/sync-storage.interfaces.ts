export enum ChamberSyncObjectStatus {
  none = 'none',
  in_sync = 'in_sync',
  pending_sync = 'pending_sync',
  synced = 'synced',
  conflicted = 'conflicted',
  pending_retry = 'pending_retry',
}

export interface SyncChamberRecordStructure {
  record: any;
  changes: any[];
  objectStatus: ChamberSyncObjectStatus | undefined | string,
  localUUID: string,
  lastModified?: Date | null | undefined,
  lastRequestUuid?: string | null | undefined, // S tem bom vedel kateri UUID requesta se je poslal ob zadnjem poskusu synca.
  retries?: number | undefined | null,
  // objectStatus: syncChamberrecordObjectStatus
}

export interface SyncTempChamberRecordStructure {
  record: any;
  datetimeAdded: Date;
}

export interface SyncWorkerResponse {
  [key: string]: SyncWorkerResponseValue[]
}

export interface SyncWorkerResponseValue {
  entryKey: string;
  chamberRecord: SyncChamberRecordStructure
}

export interface SyncChamberRecordChangesStructure {
  changes: any[];
  changesDatetime: Date | null;
  changesAppliedOnBE: boolean;
}