import { AddOperation, Operation, ReplaceOperation } from "fast-json-patch";
import * as fast_json_patch from 'fast-json-patch';
import {v4 as uuidv4} from 'uuid';
import { cloneDeep } from "lodash";
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from "../interfaces/sync-storage.interfaces";
import { CONSOLE_STYLE, CustomConsoleOutput } from "../utilities/console-style";
import { CustomChangeI } from "../interfaces/automerge-wrapper.interfaces";
import { CONFIGURATION_CONSTANTS } from "../configuration";

export class ConflictService {
    consoleOutput: CustomConsoleOutput;

    constructor() {
        this.consoleOutput = new CustomConsoleOutput(`ConflictService`, CONSOLE_STYLE.magenta_and_white);
        this.consoleOutput.closeGroup();
    }

    createEmptyChamberRecord(
        objectUuid: string,
        changes: SyncChamberRecordChangesStructure[] | undefined,
        record: any,
        objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
        // objectStatus: syncChamberrecordObjectStatus = 'pending-sync'
    ): SyncChamberRecordStructure {
        return {
            localUUID: objectUuid,
            changes: changes,
            // changes: changes ?? [],
            record: record ?? undefined,
            objectStatus,
            lastModified: new Date(),
        } as SyncChamberRecordStructure;
    }

    /**
     * I think that this function has a lot of missing parts
     * @param objectUuid 
     * @param recordValue 
     * @param changes 
     * @param existingRecord 
     * @param recordStatus 
     * @param changesDatetime 
     * @returns 
     */
    prepareSyncRecordChamberStructure(
        objectUuid: string,
        recordValue: any,
        changes: any,
        existingRecord: SyncChamberRecordStructure | undefined,
        recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
        // recordStatus: syncChamberrecordObjectStatus = 'pending-sync',
        changesDatetime = undefined, // Date = new Date(),
    ): SyncChamberRecordStructure {
        let record: SyncChamberRecordStructure | undefined = existingRecord ? cloneDeep(existingRecord) : this.createEmptyChamberRecord(objectUuid, [], undefined, recordStatus);

        if (!record.changes) {
            record.changes = []
        }
        if (recordStatus) {
            record.objectStatus = recordStatus;
        }

        if (recordValue) {
            record.record = recordValue;
            if(!recordValue[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD]) {
                record.record[CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD] = new Date();
            }
        }

        // 18.06.2023 -> Commented below line because I want to implement an option to automatically recognise a conflict based on lastModified
        // record.lastModified = changesDatetime;
        record.lastModified = changesDatetime ? changesDatetime : new Date();

        // Logic that does not have `changes` should not be able to get to this point!
        if (changes && changes.length > 0) {
            record.changes.push(this.prepareRecordChangesStructure(changes, new Date(), false));
        }

        return record;
    }

    prepareRecordChangesStructure(
        changes: CustomChangeI[] | undefined,
        changesDatetime: Date,
        changesAppliedOnBE: boolean

    ): SyncChamberRecordChangesStructure {
        return {
            changes: (changes ? changes : []),
            changesDatetime,
            changesAppliedOnBE,
        } as SyncChamberRecordChangesStructure
    }
    convertDiffValuesInOpposite(currentValue: any, diff: Operation[]) {
        const oppositeDiff: Operation[] = [];
        diff?.forEach(
            (diffValue) => {

                // path: '', op: '',  value: ''
                const obj = diffValue;
                switch (diffValue?.op) {
                    case 'replace':
                        // because diffValue.path returns value like '/<fieldName>' we need to use 'getValueByPointer' so that we convert `path` to correct value
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

                        // We throw an error, because if we get an error here it means that there is something wrong with our library or that the object structure is to complex
                        throw new Error('Something went wrong');
                }
                oppositeDiff.push(obj);
            }
        );

        return oppositeDiff;
    }

    calculateDifferencesAndPrepareSyncRecordChamberStructure(
        existingRecordStructure: SyncChamberRecordStructure,
        dataToSend: any,
        recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
        objectUuid: string = uuidv4(),
    ): SyncChamberRecordStructure {

        // calculate differences
        const diff = fast_json_patch.compare(existingRecordStructure.record, dataToSend);  // reverse diff so that we get from current ('record') state to previous state obrnemo diff
        const revertedDiff = this.convertDiffValuesInOpposite(existingRecordStructure.record, cloneDeep(diff));
        return this.prepareSyncRecordChamberStructure(objectUuid, dataToSend, revertedDiff.length > 0 ? revertedDiff : undefined, existingRecordStructure, recordStatus);
    }
}