import axios from "axios";
import * as Comlink from 'comlink';
import { of } from "rxjs";
import {v4 as uuidv4} from 'uuid';
import { CONFIGURATION_CONSTANTS, SYNC_LIB_BE_ENDPOINTS } from "../configuration";
import { SynchronizationSyncEntityPostData, SynchronizationSyncEntityRecord } from "../interfaces/sync-process.interfaces";
import { console_log_with_style, CONSOLE_STYLE, CustomConsoleOutput } from "../utilities/console-style";
import { RetryEntryI, SyncingEntryI } from "../workers/retry/utilities";


/*
{
    method: 'POST', // *GET, POST, PUT, DELETE, etc.
    mode: 'cors', // no-cors, *cors, same-origin
    cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
    credentials: 'same-origin', // include, *same-origin, omit
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'follow', // manual, *follow, error
    referrerPolicy: 'no-referrer', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    body: JSON.stringify(data) // body data type must match "Content-Type" header
  });
*/


export function sync_entity_records_batch(
  entityName: string,
  records: SynchronizationSyncEntityRecord[],
  requestUuid: string,
): Promise<any> {
  // Zaenkrat bom ustvaril avtomatsko uuid ob vstopu v funkcijo. Kasneje je potrebno videti, ali bo to potrebno poslati kot del argumentov
  const consoleOutput = new CustomConsoleOutput('sync_entity_records_batch', CONSOLE_STYLE.promise_success!);
  const jobUuid = requestUuid;
  const dataToSync = { entityName, jobUuid, data: records } as SynchronizationSyncEntityPostData;
  consoleOutput.output('STARTED EXECUTING `sync_entity_records_batch` function', {});
  consoleOutput.closeGroup();
  return axios.post(
    `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${CONFIGURATION_CONSTANTS.SYNC_ENTITY_PATH_NAME}`,
    dataToSync,
    {
      timeout: 1000, // Za testiranje scenarija, ko pride do timeouta
    }
  );
}

export function retry_refactored_re_evaluation(
  retryEntries:SyncingEntryI[],
  entityName: string,
): Promise<any> {
  return axios.post(
    `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${SYNC_LIB_BE_ENDPOINTS.RETRY_REFACTORED_API}/${entityName}`,
    {
      'reEvaluations': retryEntries
    }
  );
}

export function retry_re_evaluation(
  retryEntries: RetryEntryI[],
  entityName: string,
): Promise<any> {
  return axios.post(
    `${CONFIGURATION_CONSTANTS.SERVER_BASE_PATH}/${SYNC_LIB_BE_ENDPOINTS.RETRY_API}/${entityName}`,
    {
      'reEvaluations': retryEntries
    },
  );
}

class ExampleClassForComlinkProxy {
  constructor() {}
  exampleFunction() {
    console.log('Just not meant to be');
    return 'foo';
  }
}


export abstract class SayItAintSo {
  static readonly fooFunction = ()=> {
    return 'Example 2';
  }
}

export {ExampleClassForComlinkProxy}