import * as fast_json_patch from 'fast-json-patch';
import { AddOperation, BaseOperation, Operation, ReplaceOperation } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from '../interfaces/sync-storage.interfaces';
import { SyncConflictItem } from '../models/sync/sync-conflict-item.model';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../utilities/console-style';
import { ConflictService } from './conflict-service';
import { CONFIGURATION_CONSTANTS } from '../configuration';
/**
 * @description (before 09.04.2023) 
 * This service is not substitute for AutoMergeWrapper, but should be used as an extension because we have problems with workers.
 * Because if we want to use functions with AutoMergeWrapper in a worker, this would not work because worker cannot transfer
 * references to objects via Proxy (channel). Which means that if I want to convert JS object in Automerge.doc
 * this would not transfer entire Automerge.doc instance because of https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 *  
 * @description (on the day: 09.04.2023) 
 * Because I found out that AutoMerge.merge function does not apply with my process I will need to use custom logic for basic merge/conflict logic (at least support for basic operations)
 * 
 * Currently these are basic functions that I need:
 * - MERGE
 * - COMPARE
 * 
 * Previous logic already has some of this functionalities. 
 * I renamed the service to `SyncLibAutoMerge` because I want to indicate that this is some CUSTOM automerge-like service, which does not have to do
 * anything with AutoMerge!
 */
export class SyncLibAutoMerge {
    private conflictService: ConflictService;
    private consoleOutput: CustomConsoleOutput;
    constructor() {
        this.conflictService = new ConflictService();
        this.consoleOutput = new CustomConsoleOutput(`SyncLibMerge`, CONSOLE_STYLE.sync_lib_main);
        this.consoleOutput.closeGroup();
    }

    /**
     * This function will return what do we need to apply to `object1` to get to state like in `object2` - which operation to apply
     * @param object1 {any} `source` object -> object which needs transformation
     * @param object2 {any} `target` object -> object which has the desired/target state
     * @returns {Operation[]} Returns an array of operations which we need to apply to `object1` to get to state of `object2`
     */
    compareTwoObjects(object1: any, object2: any): Operation[] {
        // return fast_json_patch.compare(objectFromBE, parameters.preparedRecord.record);
        return fast_json_patch.compare(object1, object2).filter((value: Operation) => !value.path.startsWith('/lastModified'));
    }

    applyPatch(objectToMutate: any, patchOperations: Operation[]): any {
        return fast_json_patch.applyPatch(objectToMutate, patchOperations).newDocument;
    }

    filterSyncRelatedOperations(operation: Operation): boolean {
        return !(operation.path.startsWith(`/${CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD}`) || (operation.path.startsWith('/id') || (operation.path.startsWith(`/${CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER}`))))
    }

    async applyNewChangesToExistingSyncObject(objectUuid: string, objectDataWithChanges: any, preExisting: SyncChamberRecordStructure, objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync): Promise<SyncChamberRecordStructure> {
        // Corrections:
        // 1. calculate differences
        // 2. add differences
        const diffForReverse = this.compareTwoObjects(objectDataWithChanges, preExisting.record);
        const diff = this.compareTwoObjects(preExisting.record, objectDataWithChanges);
        const diffObject = {changes: [diffForReverse], changesDatetime: new Date(), changesAppliedOnBE: false} as SyncChamberRecordChangesStructure; //
        
        const newChanges = preExisting?.changes?.length > 0 ? [...preExisting.changes, diffObject] : [diffObject];
        const clonedExisting = cloneDeep(preExisting.record);

        // prepareSyncRecordChamberStructure -> assumption, that we send to the function only an array of new changes. The existing changes should be included in the parameter `existingInstance`
        let dataToReturn: SyncChamberRecordStructure = this.conflictService.prepareSyncRecordChamberStructure(
            objectUuid,
            this.applyPatch(clonedExisting, diff),
            diffForReverse,
            preExisting,
            objectStatus
        ) as SyncChamberRecordStructure;

        return dataToReturn;
    }

    applyConflictPatch(conflict: SyncConflictItem, beMergedData: any, localData: any, useRemote: boolean = true): any {
        let clonedBeData = cloneDeep(beMergedData);
        let clonedLocalData = cloneDeep(localData);
        let dataToReturn = clonedBeData;

        // Get data from correct object
        
        /**
         * TODO: -> currently this is not necessary
         * - logic that checks if we need DELETE operation
         * - logic that checks if we need REPLACE operation 
         * - logic that checks if we need ADD operation
         */

        // I assume that fields in `beMergedData` gets values from BE (but conflicted data is from FE)
        if (!useRemote) {
        
            // Operation -- is executed only if we get changes from local (not from BE). Otherwise we keep data as it is - data from BE. 
            const op: ReplaceOperation<any> = {op: 'replace', value: beMergedData?.[conflict.fieldName], path: `/${conflict.fieldName}`} as ReplaceOperation<any>;
            op.value = localData?.[conflict.fieldName];
            dataToReturn = this.applyPatch(clonedBeData, [op]);
        }
        
        return dataToReturn;
    }

    // Maybe I will not need to use this
    /**
     * This function will return correct name of operation: 'add'|'remove'|'copy'|'move'|'replace' ...
     * But after seeing some test data I presume that for now only `replace` will do just fine.
     *
     * Examples:
     * LOCAL                    REMOTE
     * {f1: 'f11'}   <==>       {f1: 'f1'}      -> replace
     * {f1: 'f11'}   <==>       {f1: null}      -> replace
     * {}            <==>       {f1: ''}        -> replace
     * 
     * @param conflict 
     * @param syncRecordData 
     * @param useRemote 
     * @returns 
     */
    identifyConflictPatchOperation(conflict: SyncConflictItem, syncRecordData: any, useRemote: boolean = true): string {
        if (useRemote) {
            // get data from BE object
        } else {
            // data from conflict
        }
        return 'replace';
    }
}