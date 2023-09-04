import * as Automerge from '@automerge/automerge';
import { Op } from '@automerge/automerge-wasm';
import { cloneDeep } from 'lodash';
import { CustomChangeI } from '../interfaces/automerge-wrapper.interfaces';
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../interfaces/sync-storage.interfaces';
import { ConflictService } from '../services/conflict-service';
import { console_log_with_style, CONSOLE_STYLE } from './console-style';

export type AutoMergeDoc = Automerge.Doc<any>;

export function cloneSyncObject(object: SyncChamberRecordStructure): SyncChamberRecordStructure {
    const newObject = cloneDeep(object);
    newObject.record = Automerge.load(Automerge.save(object.record)); // We need to set Document (because cloneDeep does not correctly clone the data)
    return newObject;
}

export function cloneSyncObjectWithEncoded(object: SyncChamberRecordStructure): SyncChamberRecordStructure {
    const newObject = cloneDeep(object);
    newObject.record = Automerge.load(object.record); // We need to set Document (because cloneDeep does not correctly clone the data)
    return newObject;
}

export function convertAutomergeDocToObject(doc: Automerge.Doc<any>): any {
    return Automerge.toJS(doc);
}

export function convertUint8ArrayToObject(encodedData: Uint8Array): Automerge.Doc<any> {
    const convertedData = Automerge.load(encodedData);
    console.log('TO JE UTIILTY automerge');
    console.log(convertedData);
    
    
    return Automerge.load(encodedData);
}

export function convertAutomergeDocToUint8Array(doc: Automerge.Doc<any>): Uint8Array {
    return Automerge.save(Automerge.clone(doc));
}

/**
 * 
 * @param targetDoc In AutoMerge world, this data represent a document in which we will merge both documents - in merge we add as REMOTE parameter even though this is data from LOCAL
 * @param initDoc In AutoMerge world, this data represent a document in which we will merge both documents - in merge we add as LOCAL parameter even though this is data from REMOTE
 * @returns 
 */
export function mergeTwoAutoMergeDocs(targetDoc: Automerge.Doc<any>, initDoc: Automerge.Doc<any>): Automerge.Doc<any> {
    // const targeDocClone = Automerge.clone(targetDoc);
    // const initDocClone = Automerge.clone(initDoc);
    const targeDocClone = changeDocWithNewObject(initialiseDocument(), Automerge.toJS(Automerge.clone(targetDoc)));
    const initDocClone = changeDocWithNewObject(initialiseDocument(), Automerge.toJS(Automerge.clone(initDoc)));

    return Automerge.merge(initDocClone, targeDocClone); // In my use-case Local (first argument) == object from BE, Remove (second argument) == object from FE -> Because for me  it is important that object which will be stored on FE shows the latest data we received from BE.
}

export function convertObjectToAutomergeDoc(object: any): Automerge.Doc<any> {
    const doc = Automerge.init();
    return changeDocWithNewObject(doc, object);
}

export function changeDocWithNewObject(doc: Automerge.Doc<any>, objectWithChanges: any): Automerge.Doc<any> {
    return Automerge.change(doc, (docItem) => {
        const oldStateKeys = Object.keys(docItem);
        const newStateKeys = Object.keys(objectWithChanges);
        Object.assign(docItem, objectWithChanges);

        // Remove properties that do not exist in new state
        const keysAfterChange = Object.keys(docItem);
        for (let key of oldStateKeys) {
            if (!newStateKeys.includes(key)) {
                delete docItem[key];
            }
        }
    })
}

export function getDataFromEncodedRecord(encodedData: Uint8Array): any {
    return convertAutomergeDocToObject(convertUint8ArrayToObject(encodedData));
}

export function initialiseDocument(): Automerge.Doc<any> {
    return Automerge.init();
}

export function getLastChangesFromDocumentDecoded(doc: Automerge.Doc<any>): any[] | undefined {
    const lastChanges = getLastChangesFromDocument(doc);
    if (!lastChanges) {
        return undefined;
    }
    const decodedChanges = decodeChange(lastChanges).ops;
    return decodedChanges?.length > 0 ? decodedChanges : undefined;
}

export function getLastChangesFromDocument(doc: Automerge.Doc<any>): Uint8Array | undefined {
    return Automerge.getLastLocalChange(doc);
}

export function decodeChange(changes: Uint8Array): Automerge.DecodedChange {
    return Automerge.decodeChange(changes);
}
//applyNewChangesToExistingSyncObject
export function applyNewChangesToExistingSyncObject(){}
// export function getChangesBetweenObjectAndExistingDoc(objectUuid: string, objectDataWithChanges: any, preExisting: SyncChamberRecordStructure): SyncChamberRecordStructure {
export function getChangesBetweenObjectAndExistingDoc(objectUuid: string, latestState: Automerge.Doc<any>, previousState: Automerge.Doc<any>): SyncChamberRecordStructure {
    const conflictService = new ConflictService();
    let dataToReturn: SyncChamberRecordStructure = conflictService.prepareSyncRecordChamberStructure(
        objectUuid,
        // changeDocWithNewObject(initialiseDocument(), objectDataWithChanges),
        latestState,
        [],
        undefined,
        ChamberSyncObjectStatus.pending_sync
    ) as SyncChamberRecordStructure;
    // check differences
    // const documentWithNewChanges = changeDocWithNewObject(preExisting.record, objectDataWithChanges);
    // const documentWithNewChanges = changeDocWithNewObject(previousState, latestState);
    // const latestObjectStateToDoc = changeDocWithNewObject(initialiseDocument(), objectDataWithChanges);
    const documentWithNewChanges = changeDocWithNewObject(latestState, Automerge.toJS(previousState));

    if (!dataToReturn.changes) {
        dataToReturn.changes = [];
    }

    const latestChanges = getLastChangesFromDocumentDecoded(documentWithNewChanges);
    const changesToAppend = convertAutomergeChangeToCustomChange(latestChanges);

    if (changesToAppend?.length > 0) {
        // Only if we recognise new changes , change also lastModified
        dataToReturn.lastModified = new Date();
        dataToReturn.changes.push(conflictService.prepareRecordChangesStructure(
            changesToAppend,
            new Date(),
            false,
        ));
    }

    return dataToReturn;
}

export function  convertAutomergeChangeToCustomChange(autoMergeChanges: Op[] | undefined) {
    const customChanges: CustomChangeI[] = [];
    if (!autoMergeChanges) {
        return [];
    }
    for (let amChange of autoMergeChanges) {
        customChanges.push(
            {
                op: amChange.action == 'set' ? 'replace' : 'remove',
                path: `/${amChange.key}`,
                value: amChange.value,
            } as CustomChangeI
        );
    }

    return customChanges;
}