import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MergeModeEnum } from './enums/MergeModeEnum';
import { AddOperation, Operation, ReplaceOperation } from 'fast-json-patch';
import * as fast_json_patch from 'fast-json-patch'
// import { ConflictField, RestrictedConflictManagerInterface } from '../ interfaces/conflict-manager.interface';
import { ConflictField, RestrictedConflictManagerInterface } from './interfaces/conflict-manager.interfaces';
import { DiffValuesByRulesResult } from './interfaces/conflict-manager.interfaces';
import { cloneDeep, isDate, isEmpty } from 'lodash';
import { ChamberSyncObjectStatus, SyncChamberRecordChangesStructure, SyncChamberRecordStructure, SyncStorageService } from './sync-storage.service';
import { ApiService } from './api.service';
import { DeferredPromise } from './utilities/deferred';
import { Observable } from 'rxjs';
import { SyncTempChamberRecordStructure } from './interfaces/sync-storage.interfaces';
import { CONSOLE_STYLE, CustomConsoleOutput } from './utilities/console-style';

export interface ConflictProcessParameters<T> {
  predefined_object_type: string,
  difference_from_BE_to_local_object: Operation[],
  objectFromBE: T, // some object from BE -> optionally I could add <T> ?
  local_updated_at: Date,
  objectID: string | number,
  predefinedStoreWriteAccess: IDBObjectStore | undefined,
  preparedRecord: SyncChamberRecordStructure,
  syncStorageService: SyncStorageService,
  apiService: ApiService,
  objectStatus?: ChamberSyncObjectStatus
};

@Injectable({
  providedIn: 'root'
})
export class ConflictManagerService {

  // ta podatek bo moral biti posredovan v constructor MODULA (typescript modula!!!) ko bomo imeli RELEASE ready verzijo
  private readonly PATH_TO_CONFIGURATION = '/assets/configurations/conflict-configuration.json';
  public readonly ROLLBACK_MERGE_RESOLUTION_MODE = MergeModeEnum.NEWER_CHANGES;
  public readonly REMOTE_OBJECT_UPDATED_FIELD: string = 'updatedAt';
  private consoleOutput: CustomConsoleOutput;

  constructor(
    protected httpClient: HttpClient
  ) {
    this.consoleOutput = new CustomConsoleOutput('CONFLICTMANAGER', CONSOLE_STYLE.sync_lib_main);
    this.consoleOutput.closeGroup();
  }

  getJsonConfiguration(filePath?: string): Promise<any> {
    return this.httpClient.get(filePath ?? this.PATH_TO_CONFIGURATION).toPromise();
  }


  diffValuesRestrictedByRules(
    diffValues: fast_json_patch.Operation[],
    rules: Array<ConflictField>,
    originalRemoteObject: any,
    defaultMergeResolution: MergeModeEnum = MergeModeEnum.NEWER_CHANGES,
    localObjectLastChanged: Date | null = null,
    localObject: any = undefined
  ): DiffValuesByRulesResult {

    // Prvo naredimo deepClone remote objekta, da ne bomo pokvarili referencnega objekta `remoteObject`
    const remoteObject = cloneDeep(originalRemoteObject);
    let remoteObjectUpdatedAt: any | null = null;
    if (remoteObject[this.REMOTE_OBJECT_UPDATED_FIELD] && remoteObject[this.REMOTE_OBJECT_UPDATED_FIELD] instanceof Date) {
      remoteObjectUpdatedAt = remoteObject[this.REMOTE_OBJECT_UPDATED_FIELD];
      delete remoteObject[this.REMOTE_OBJECT_UPDATED_FIELD];
    }
    const result = {
      record: undefined,
      conflicts: undefined
      // conflicts: []
    } as DiffValuesByRulesResult;

    /**
     * Tukaj shranimo vse fielde, ki potrebujejo konflict resolution s strani uporabnika, ostale pa MERGAMO po obstojecih pravilih. 
     * Lahko da bomo na koncu v konflikt tabelo dodali kar vse spremembe (vazno bo da le eno diff identificiramo kot 'user action needed').
     * 
     */
    const newDiffChanges: Operation[] = [];
    diffValues?.forEach((diffValue: fast_json_patch.Operation) => {

      /**
       * DEFINIRATI bo potrebno nad katerim objektom moramo narediti spremembo, da pride do konflikta (nad remote objektom, ali nad lokalnim).
       * Zaenkrat gledamo tako, da dobimo spremembe, ki jih moramo narediti, da iz REMTOE dobimo Local zadevo.
       * Ce pride do konfliktov vmes, jih pac nastavimo kot konflikte, ce jih ni, se morajo spremembe poznati na REMOTE podatkih. Preden pa delamo
       * manipulacijo nad REMOTE podatki, naredimo `deepClone`, zato da se ne sesuje originalna referenca na zajete BE podatke.
       */

      // PRETVORIMO PATH IZ DIFF V PRAVILNO OBLIKO
      const escapePathSplit = diffValue.path.split('/'); // We should get length of 0 or 2 (0-> path incorrect, 2 -> one field path name (e.g. '/example1' == ['', 'example1']))
      let escapePath: string | undefined = undefined;

      if (escapePathSplit?.length === 2) {
        // this is cool, otherwise remove
        escapePath = escapePathSplit[1];
      } else {
        // something is not ok (either path incorrect either path includeds nested values);
        throw new Error('Path in difference is not of!!!');
        alert('Check console');
      }

      const e1 = escapePath;

      const fieldExistsInRules = rules?.find(
        (conflictField) => conflictField.fieldName == e1
      );
      const mergeRule = fieldExistsInRules?.mergeResolution ?? defaultMergeResolution;
      switch (mergeRule) {
        case MergeModeEnum.NONE:
          // ne vem - zaenkrat isto kot NO-RESTRICTIONS
          fast_json_patch.applyPatch(remoteObject, [diffValue]);
          break;
        case MergeModeEnum.USER_INTERACTION_NEEDED:
          newDiffChanges.push(diffValue);
          break;
        case MergeModeEnum.NO_RESTRICTIONS:
          // popravi remote podatke z lokalnim podatkom
          fast_json_patch.applyPatch(remoteObject, [diffValue]);
          break;
        case MergeModeEnum.NEWER_CHANGES:
          // preveri kateri objekt je kasneje narejen/posodobljen (diff sprememba) ali objekt iz REMOTE-a

          let appliedPatch = null;
          if (
            remoteObjectUpdatedAt && (remoteObjectUpdatedAt instanceof Date)
          ) {
            if (localObjectLastChanged && (remoteObjectUpdatedAt <= localObjectLastChanged)) {
              appliedPatch = fast_json_patch.applyPatch(remoteObject, [diffValue]); // Zgleda da samo na en nacin naredimo patch v tem case-u --> torej zakaj toliko if-ov?
            }
          } else {
            appliedPatch = fast_json_patch.applyPatch(remoteObject, [diffValue]); // Zgleda da samo na en nacin naredimo patch v tem case-u --> torej zakaj toliko if-ov?
          }
          // TUKAJ JE ZADEVA MALCE SLABO PREMISLJENA - ce ne bodo nekateri pogoji izpolnjeni, se bo stvar samo nadaljevala brez procesiranja
          // ... torej se lahko potencialno nekaj izgubi (zacakla)
          break;
        case MergeModeEnum.DEFAULT:
          // kaj pa bi tukaj lahko naredili? - zaenkrat isto kot NO-RESTRICTIONS
          fast_json_patch.applyPatch(remoteObject, [diffValue]);
          break;
        default:
          throw new Error('This merge mode does not exist! Please consult with developer!');
          alert('Merge mode does not exist!!!');
      }
    });
    result.conflicts = newDiffChanges.length > 0 ? { conflictCreated: new Date(), conflicts: newDiffChanges } : undefined; // newDiffChanges.length > 0 ? [{ conflictCreated: new Date(), conflicts: newDiffChanges }] : [];
    result.record = remoteObject;
    return result;
  }


  /**
   * This functions should be used, when we will IMPLEMENT functionality, to approve pending MERGE CONFLICTS (when some fields need user's decision)
   * @param oldConflict Conflicts found before current state
   * @param newConflict Conflicts found during current state
   * @returns bool
   */
  compareTwoConflicts(oldConflict: DiffValuesByRulesResult, newConflict: DiffValuesByRulesResult): boolean { // return TRUE if conflicts have the same "context" or FALSE if conflicts "contextually" difer
    if (!oldConflict || !newConflict) {
      return false;
    }

    if (oldConflict.conflicts?.conflicts?.length !== newConflict.conflicts?.conflicts?.length) {
      return false;
    }

    if (newConflict.conflicts?.conflicts) {
      const newConflicts = newConflict.conflicts.conflicts;
      for (let i = 0; i < newConflicts.length; i++) {
        const currentConflictItem = newConflicts[i];
        const findMatchingConflictInOldConflicts = oldConflict.conflicts?.conflicts.find((item) => item.op == currentConflictItem.op && item.path == currentConflictItem.path);
        if (!findMatchingConflictInOldConflicts) {
          return false;
        }
      }
    }

    return true
  }

  async potentialFunctionInConflictServiceForConflictProcess(
    parameters: ConflictProcessParameters<any>,
  ): Promise<void> {
    // const objectFromBE = await parameters.apiService.getObjectFromBE(parameters.syncStorageService.SYNC_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'SOME_ID_OR_UUID').toPromise(); // get data from BE (lets mock it for now - WITH SUBSCRIBE!!!!)
    const objectFromBE = await parameters.apiService.getObjectFromBE(parameters.syncStorageService.SYNC_OBJECT_STORE_PREFIX + parameters.predefined_object_type, parameters.objectID).toPromise(); // get data from BE (lets mock it for now - WITH SUBSCRIBE!!!!)
    // const objectFromBE = {};
    /**
     * `difference_from_BE_to_local_object` vrne spremembe ki jih moramo narediti, da iz objectFromBE, dobimo preparedRecord.record. Torej kaj
     * moramo narediti, da se spremembe iz LOCAL poznajo na REMOTE.
     */
    const difference_from_BE_to_local_object = fast_json_patch.compare(objectFromBE, parameters.preparedRecord.record); // MORAO IZRACUNATI KAJ TO POMENI
    
    
    // potrebno bo definirati kaksna stopnja MERGE bomo imeli
    try {

      /**
       * I think that this logic should be seperated into a function, so that we can call this logic, when we ACCEPT/confirm some MERGE CONFLICTS (because we need to check again, if accepted stuff is OK!)
       */

      const fileData: RestrictedConflictManagerInterface = await this.getJsonConfiguration(); // CONFLICT RULES // CAN BE GENERIC
      const predefinedObjectConflictRules: { groups: Array<ConflictField> } = fileData?.conflict_field_groups?.[parameters.predefined_object_type]; // NEED to get `predefined_object_type` value into sub-function in order to use GENERIC function
      const defaultMergeResolution = fileData?.default_merge_resolution ?? this.ROLLBACK_MERGE_RESOLUTION_MODE; // CAN BE GENERIC

      // IMELI BOMO PROBLEM ZARADI strukture 'path' podatka... primer: '/fieldName2' -> '/' je nekaj kar nisem predvideval, da me bo zezalo
      // mislim da ni potrebe po IF-ELSE, ker lahko splosneje poklicem `diffValuesRestrictedByRules` in mi lahko oba primera kar noter resi
      // if (predefinedObjectConflictRules) {

      /**
       * spremembe, ki jih naredimo s patchem nad `objectFromBE` se bodo poznale na instanci od `objectFromBE`. Jaz bi raje naredil deep clone in naredil spremembe
       * zato naredimo deepClone, da bomo imeli remoteObject, `cist` ce bomo potrebovali kasneje referenco. Hmmm. To bi bilo se bolje, ce bi naredili kar v funckiji
       * in bi nato funkcija vrnila deepCloned object s spremebami + conflict changes
       **/


       let diffValuesByRulesResult = undefined;
       
      // IF OBJECT FROM BE UNEFINED || {} THEN MANUALLY CREATE default structure with data from `SyncChamberRecordStructure.record`      
      if (!objectFromBE || isEmpty(objectFromBE)) {
        diffValuesByRulesResult  = {
          record: parameters.preparedRecord.record,
          conflicts: undefined
          // conflicts: []
        } as DiffValuesByRulesResult;
      } else {
        
        diffValuesByRulesResult = this.diffValuesRestrictedByRules( // NEED to pass `conflictManagerService` as parameter to sub-function in order to be GENERIC
        difference_from_BE_to_local_object, // PASSED AS PARAMETER
        predefinedObjectConflictRules?.groups ?? [], // PASSED AS PARAMETER
        objectFromBE, // PASSED AS PARAMETER
        this.ROLLBACK_MERGE_RESOLUTION_MODE, // FOUND FROM FIRST PARAMETER (conflictManagerService)
        new Date(2023, 3, 4) // PASSED AS PARAMETER
      );
      }
      
      // diffValuesByRulesResult = this.diffValuesRestrictedByRules( // NEED to pass `conflictManagerService` as parameter to sub-function in order to be GENERIC
      //   difference_from_BE_to_local_object, // PASSED AS PARAMETER
      //   predefinedObjectConflictRules?.groups ?? [], // PASSED AS PARAMETER
      //   objectFromBE, // PASSED AS PARAMETER
      //   this.ROLLBACK_MERGE_RESOLUTION_MODE, // FOUND FROM FIRST PARAMETER (conflictManagerService)
      //   new Date(2023, 3, 4) // PASSED AS PARAMETER
      // );
      
      // CANNOT use `predefinedOBjectStore here, becuase `predefinedObjectStoreForConflictedChamber` overshadows this transaction and therefore it makes it INVALID!!!!!
      // let predefinedObjectStore = parameters.syncStorageService.retrieveObjectStoreIfExists(parameters.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'readwrite'); // PASS SERVICE AS PARAMETER

      if (diffValuesByRulesResult.conflicts) {

        // Dodaj podatke v CONFLICT IndexedDB, ker je prislo do konfliktov
        // NATO shranimo konflikte v bazo, glede na objectSTore in glede na ID objekta ( ID mora obstajati, ker durgace ne bi imeli konfliktov!!! (ne bi imeli cesa primerjati z BE)).
        // let predefinedObjectStore = this.syncStorageService.retrieveObjectStoreIfExists(this.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + predefined_object_type, 'readwrite');

        try { // Tukaj bo vedno povozilo obstojece podatke o konfliktu za posredovan objectStore in ID

          // WTF??? ---> SYNC_OBJECT_STORE_PREFIX
          const predefinedObjectStoreForConflictedChamber = parameters.syncStorageService.retrieveObjectStoreIfExists(parameters.syncStorageService.SYNC_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'readwrite');
          const preparedRecordClone = cloneDeep(parameters.preparedRecord);
          
          preparedRecordClone.objectStatus = ChamberSyncObjectStatus.conflicted;
          
          const updatedChamberRecord = await parameters.syncStorageService.addEntryToStoreObserv(predefinedObjectStoreForConflictedChamber!, parameters.objectID, preparedRecordClone, true).toPromise().then();
          // predefinedObjectStoreForConflictedChamber?.transaction.abort();

          await parameters.syncStorageService.transactionAsObservable(predefinedObjectStoreForConflictedChamber?.transaction!).toPromise();
          
          
          let predefinedObjectStore = parameters.syncStorageService.retrieveObjectStoreIfExists(parameters.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'readwrite'); // PASS SERVICE AS PARAMETER
          if (!predefinedObjectStore) { // in my opinion, this use case could not happen, since we already did the same operation before AND it was a SUCCESS!!!
            // Ce se nismo nikoli imeli konflikta za ta objekt, moramo ustvariti object store



            const outsidePromise = new DeferredPromise()
            const oup = new DeferredPromise();
            
            
            
            
            // parameters.syncStorageService.getSyncDB()?.close;
            try {
              
              await parameters.syncStorageService.openDatabase( // Ta zadeva bi morala poslati rezultat v `onupgradeneeded` funkciji
                parameters.syncStorageService.SYNC_DATABASE_NAME,
                parameters.syncStorageService.getSyncDB()?.version! + 1,
                async (ev: Event) => {
                  
                  const target = ev.target as IDBRequest;
                  const database = target.result as IDBDatabase;
                  database.createObjectStore(parameters.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + parameters.predefined_object_type);
                  parameters.syncStorageService.setSyncDB(database);
                  outsidePromise.resolve(database);
                  
                },
                outsidePromise,
              ).then();
              
      
              // Since we created changes in the database it seems that we need to re-open if we want to receive latest instance in the 'syncStorageService' .........
              parameters.syncStorageService.getSyncDB()?.close();
              await parameters.syncStorageService.openDatabase(parameters.syncStorageService.SYNC_DATABASE_NAME);
              
              predefinedObjectStore = parameters.syncStorageService.retrieveObjectStoreIfExists(parameters.syncStorageService.SYNC_CONFLICT_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'readwrite'); // objectStore Exists!
              
            }
            catch (exception) {
              
              this.throwException('Nismo prisli do konca');
              return;
            }



            // this.throwException('This use-case is not yet considered and programmed - OBJECT STORE DOES NOT EXIST, we need to implement logic, to create object store (open database with new version, etc.', null);
          }
          
          const result = await parameters.syncStorageService.addEntryToStoreObserv(predefinedObjectStore!, parameters.objectID, diffValuesByRulesResult).toPromise(); // OBJECT ID NEED's to be passed as parameter
          return;
        } catch (exception) { throw new Error('This use-case is not yet considered and programmed - SAVE conflicts problem / or save result(object) of merge rules calculation') }
      } else {
        // Prvo moramo izbrisati obstojeci podatek o konfliktih za omenjeni object_name + id/uuid
        // if (predefinedObjectStore) {
        //   // const deleteEntryFromStore = await this.syncStorageService.removeEntryFromStore(predefinedObjectStore, 'SOME_ID_OR_UUID').toPromise();

        //   const deleteEntryFromStore = await this.syncStorageService.removeEntryFromStore(predefinedObjectStore, 'SOME_ID_OR_UUID2').toPromise();
        //   if (!deleteEntryFromStore) {
        //     alert('Entry from object store for ID: ' + ' SOME_ID_OR_UUID ' + 'could not be deleted');
        //     this.throwException('Entry could not be delete for ID: SOME_ID_OR_UUID in object store.');
        //   }

        // } else { // WE must have object store for later operations (add, ...)
        //   this.throwException('This use-case is not yet considered and programmed - object store does not exist, when no conflict found');
        // }


        try { // DO konfliktov ni prislo in zato lahko podatke posljemo na BE


          // Shrani objekt na BE
          const storedObject = await parameters.apiService.storeObjectInBE(parameters.predefined_object_type, diffValuesByRulesResult.record).toPromise();


          // ZAKAJ BI TO RABIL??????????
          // if (!parameters.predefinedStoreWriteAccess) { throw new Error('Ne deluje zadnje shranjevanje, ko shranimo resolved objekt na BE in ga vrnemo na FE '); }

          // Po nacrtu (syncProcess.drawio), sem pripravil logiko, da se po shranjevanju na BE, shrani objekt ponovno na local storage na FE.
          
          const predefinedStoreWriteAccess2 = parameters.syncStorageService.retrieveObjectStoreIfExists(parameters.syncStorageService.SYNC_OBJECT_STORE_PREFIX + parameters.predefined_object_type, 'readwrite'); // objectStore Exists!
          /**
           * Trenutno dobim v `preparedRecord` stanje sprememb in objekta kot smo ga nazadnje shranili (pred konflikt resolutionom)
           * Vprasanje je: ali naj v changes dodamo tudi prehod iz "nazadnje shranjenega" v "konflikt resolution verzije"
           */
          // Primerjaj podatek iz BE in FE podatek
          const diff2: Operation[] = fast_json_patch.compare(parameters.preparedRecord.record, diffValuesByRulesResult.record); // `preparedRecord` needs to be passed as parameter
          const revertedDiff2 = parameters.syncStorageService.convertDiffValuesInOpposite(parameters.preparedRecord.record, cloneDeep(diff2));
          const latestDataChamberStructure = parameters.syncStorageService.prepareSyncRecordChamberStructure(storedObject, revertedDiff2?.length > 0 ? revertedDiff2 : undefined, parameters.preparedRecord, ChamberSyncObjectStatus.pending_sync);
          latestDataChamberStructure.objectStatus = parameters.objectStatus ? parameters.objectStatus : ChamberSyncObjectStatus.synced;// ChamberSyncObjectStatus.in_sync; // ChamberSyncObjectStatus.synced; Ta zadnji 'synced' mora biti na koncu uporabljen, ce je kaj drugega uporabljeno, pomeni, daje test-purpose
          const latestDataStored = await parameters.syncStorageService.addEntryToStoreObserv(predefinedStoreWriteAccess2!, parameters.objectID, latestDataChamberStructure).toPromise()
        } catch (exception) { this.throwException('This use-case is not yet considered and programmed - Problem with: (Store to BE, retrieve object store or add object to FE', exception); }
      }
    } catch (error) {
      this.throwException('This use-case is not yet considered and programmed - GET conflict configuration or OBJECT STORE not existent', error);
    }
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
            throw new Error('Something went wront');
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
  ): SyncChamberRecordStructure {

    // izracuj razlike
    const diff = fast_json_patch.compare(existingRecordStructure.record, dataToSend);  // obrnemo diff, da bomo lahko prisli iz trenutnega stanja ('record') v prejsnja stanja
    this.consoleOutput.output(`kissing their`, diff);
    const revertedDiff = this.convertDiffValuesInOpposite(existingRecordStructure.record, cloneDeep(diff));
    return this.prepareSyncRecordChamberStructure(dataToSend, revertedDiff.length > 0 ? revertedDiff : undefined, existingRecordStructure, recordStatus);
  }

  // TA funkcija ima pomojem veliko pomanjkljivosti
  prepareSyncRecordChamberStructure(
    recordValue: any,
    changes: any,
    existingRecord: SyncChamberRecordStructure | undefined,
    recordStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // recordStatus: syncChamberrecordObjectStatus = 'pending-sync',
    changesDatetime: Date = new Date()
  ): SyncChamberRecordStructure {
    let record: SyncChamberRecordStructure | undefined = cloneDeep(existingRecord);

    if (!record) {
      record = this.createEmptyChamberRecord(undefined, undefined, recordStatus);
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

  prepareStructureForTempChamber(
    record: any,
  ): SyncTempChamberRecordStructure {
    return {
      record,
      datetimeAdded: new Date(),
    } as SyncTempChamberRecordStructure;
  }

  createEmptyChamberRecord(
    changes: SyncChamberRecordChangesStructure[] | undefined,
    record: any,
    objectStatus: ChamberSyncObjectStatus = ChamberSyncObjectStatus.pending_sync,
    // objectStatus: syncChamberrecordObjectStatus = 'pending-sync'
  ): SyncChamberRecordStructure {
    return {
      changes: changes,
      // changes: changes ?? [],
      record: record ?? undefined,
      objectStatus
    } as SyncChamberRecordStructure;
  }

  private throwException(message: string, exception: any = null): never {
    console.log(exception);
    throw new Error(message);
  }

}