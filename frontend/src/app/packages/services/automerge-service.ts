import * as fast_json_patch from 'fast-json-patch';
import { AddOperation, BaseOperation, Operation, ReplaceOperation } from 'fast-json-patch';
import { cloneDeep } from 'lodash';
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure } from '../interfaces/sync-storage.interfaces';
import { SyncConflictItem } from '../models/sync/sync-conflict-item.model';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../utilities/console-style';
import { ConflictService } from './conflict-service';
import { CONFIGURATION_CONSTANTS } from '../configuration';
/**
 * @description (pred 09.04.2023) Ta "service" NI nadomestilo za AutoMergeWrapper, ampak je kot neko dopolnilo, ker imamo omejitve z Workerji.
 * Namrec, ce bi hotel neke funkcije uporabiti preko AutoMergeWrapperja v workerju, mi to ne bi delovalo pravilno, ker
 * worker, ne more prenesti instanc razredov preko Proxy-ja. Kar pomeni, da v primeru, ko hocem pretvoriti JS objekt v Automerge.doc,
 * mi to ne bo pravilno preneslo celotno Automerge.doc instanco, ampak le "oskrunjen" objekt, ki hrani le property-je in ne ostalih zadev
 * vezanih na Automerge.doc instanco!
 *  
 * @description (dne: 09.04.2023) Ker sem ugotovil, da me AutoMerge - UBIJE - s funkcijo .merge , bom moral pripraviti spet vso logiko s svojo custom
 * knjiznico (vsaj za podporo osnovnih operacij).
 * 
 * Trenutna identifikacija potrebnih operacij:
 * - MERGE
 * - COMPARE
 * 
 * Prejsnja logika ima ze nekaj funkcij prepripravljenih. 
 * Service sem poimenoval `SyncLibAutoMerge`, ker zelim ponazoriti, da je to nek CUSTOM automerge-like service, ki nima prav dosti veze z AutoMerge.
 */
export class SyncLibAutoMerge {
    private conflictService: ConflictService;
    private consoleOutput: CustomConsoleOutput;
    constructor() {
        this.conflictService = new ConflictService();
        this.consoleOutput = new CustomConsoleOutput(`SyncLibMerge`, CONSOLE_STYLE.sync_lib_main);
    }

    /**
     * Ta funkcija bo vrnila odgovor kaj moramo narediti, da iz `object1` dobimo `object2` - kaksne operacije moramo narediti, da iz `object1`, dobimo `object2`
     * @param object1 {any} `source` object -> objekt iz katerega izhajamo
     * @param object2 {any} `target` object -> objekt ki predstavlja trenutni/koncni objekt
     * @returns {Operation[]} Vrne tabelo operacij, ki jih moramo narediti, da `object1` pretvorimo v `object2`.
     */
    compareTwoObjects(object1: any, object2: any): Operation[] {
        // return fast_json_patch.compare(objectFromBE, parameters.preparedRecord.record);
        return fast_json_patch.compare(object1, object2);
    }

    applyPatch(objectToMutate: any, patchOperations: Operation[]): any {
        return fast_json_patch.applyPatch(objectToMutate, patchOperations).newDocument;
    }

    filterSyncRelatedOperations(operation: Operation): boolean {
        return !(operation.path.startsWith(`/${CONFIGURATION_CONSTANTS.LAST_MODIFIED_FIELD}`) || (operation.path.startsWith('/id') || (operation.path.startsWith(`/${CONFIGURATION_CONSTANTS.UNIQUE_IDENTIFIER}`))))
    }

    async applyNewChangesToExistingSyncObject(objectUuid: string, objectDataWithChanges: any, preExisting: SyncChamberRecordStructure, objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync): Promise<SyncChamberRecordStructure> {
        // Popravki:
        // 1. izracunaj razlike
        // 2. dodaj spremembe
        const diffForReverse = this.compareTwoObjects(objectDataWithChanges, preExisting.record);
        const diff = this.compareTwoObjects(preExisting.record, objectDataWithChanges);
        const diffObject = {changes: [diffForReverse], changesDatetime: new Date(), changesAppliedOnBE: false} as SyncChamberRecordChangesStructure; //
        
        const newChanges = preExisting?.changes?.length > 0 ? [...preExisting.changes, diffObject] : [diffObject];
        const clonedExisting = cloneDeep(preExisting.record);

        // prepareSyncRecordChamberStructure -> predpostsavlja, da v funkcijo posljem samo tabelo novih sprememb in tudi obstojece spremembe preko `existinInstance`....
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

        // Izlusciti iz pravega objekta podatek
        
        /**
         * TODO: -> zaenkrat je to nepotrebno!!
         * - logika ki preveri ali rabimo operacijo DELETE
         * - logika ki preveri ali rabimo operacijo REPLACE
         * - logika ki preveri ali rabimo operacijo ADD
         */

        // Sklepam, da beMergedData dobi v fieldih vrednost iz BE (konflitni podatki pa so podatki iz FE-ja)
        if (!useRemote) {
            // Operation -- se izvede samo ce gre za sprejem lokalnih sprememb (NON-REMOTE). V nasprotnem primeru ohranimo podatek kot je - podatek iz BE.
            const op: ReplaceOperation<any> = {op: 'replace', value: beMergedData?.[conflict.fieldName], path: `/${conflict.fieldName}`} as ReplaceOperation<any>;
            op.value = localData?.[conflict.fieldName];
            dataToReturn = this.applyPatch(clonedBeData, [op]);
        }
        
        return dataToReturn;
    }

    // Mogoce sploh ne bo potrebno tega uporabljati
    /**
     * Ta funkcija bi morala vrniti pravilno vrsto operacije: 'add'|'remove'|'copy'|'move'|'replace' ...
     * Ampak glede na to, da po permutacijah ki se lahko zgodijo, sklepam, da bo `replace` dovolj za sedaj.
     * 
     * Primeri:
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
            // moramo sprejeti podatek iz REMOTE objekta
        } else {
            // podatek iz konflikta
        }
        return 'replace';
    }
}