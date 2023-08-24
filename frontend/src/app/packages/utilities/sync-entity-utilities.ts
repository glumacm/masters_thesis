import { cloneDeep } from "lodash";
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from "../interfaces/sync-storage.interfaces";

export function createEmptySyncEntry(
    localUUID: string,
    changes: SyncChamberRecordChangesStructure[] | undefined,
    record: any,
    objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // objectStatus: syncChamberrecordObjectStatus = 'pending-sync'
): SyncChamberRecordStructure {
    return {
        localUUID: localUUID,
        changes: changes,
        // changes: changes ?? [],
        record: record ?? undefined,
        objectStatus,
        lastRequestUuid: undefined,
    } as SyncChamberRecordStructure;
}

export function prepareSyncEntryStructure(
    localUUID: string,
    recordValue: any,
    changes: any,
    existingRecord: SyncChamberRecordStructure | undefined,
    recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // recordStatus: syncChamberrecordObjectStatus = 'pending-sync',
    changesDatetime: Date = new Date()
): SyncChamberRecordStructure {
    let record: SyncChamberRecordStructure | undefined = cloneDeep(existingRecord);

    if (!record) {
        record = createEmptySyncEntry(localUUID, undefined, undefined, recordStatus);
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