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
     * Ta funkcija ima po mojem veliko pomankljivosti
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

        // 18.06.2023 -> Zakomentiral to, ker bi rad implementiral opcijo, da bi conflict bil avtomatsko prepoznan na podlagi lastModified
        // record.lastModified = changesDatetime;
        record.lastModified = changesDatetime ? changesDatetime : new Date();

        // Do tukaj ne bi smelo priti logika, ki ima undefined `changes` !!!!
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

        // izracuj razlike
        const diff = fast_json_patch.compare(existingRecordStructure.record, dataToSend);  // obrnemo diff, da bomo lahko prisli iz trenutnega stanja ('record') v prejsnja stanja
        const revertedDiff = this.convertDiffValuesInOpposite(existingRecordStructure.record, cloneDeep(diff));
        return this.prepareSyncRecordChamberStructure(objectUuid, dataToSend, revertedDiff.length > 0 ? revertedDiff : undefined, existingRecordStructure, recordStatus);
    }
}