// Convetion: trailing slash is left out from the api name --> need to test if this can produce problems somewhere.

import { EventSourcePolicyEnum } from "./enums/sync/event-source-policy-enum";

// WARNING: When combining base path with other api names, do not forget to add trailing slash to base path!
export const CONFIGURATION_CONSTANTS = {
    SERVER_BASE_PATH: 'https://localhost/api',
    GET_OBJECT_PATH_NAME: 'get-object',
    // SYNC_ENTITY_PATH_NAME: 'sync-entity',
    SYNC_ENTITY_PATH_NAME: 'refactored/sync-merging',  //@remarks ime api-ja je misleading. Ta API je namenjen za sync. Torej, posljemo podatke, se zmergajo na BE in vrnemo nek odgovor nazaj.
    BATCH_SINGLE_ENTITY_SYNC_PATH_NAME: 'refactored/batch-single-entity-sync-merging',  //@remarks ime api-ja je misleading. Ta API je namenjen za sync. Torej, posljemo podatke, se zmergajo na BE in vrnemo nek odgovor nazaj.
    SYNC_REQUEST_STATUS_PATH_NAME: 'refactored/sync_requests_status',
    BROWSER_SYNC_DATABASE_NAME: 'sync',
    BROWSER_SYNCING_DATABASE_NAME: 'syncing',
    BROWSER_SYNC_CONFLICT_DATABASE_NAME: 'sync_conflict',
    BROWSER_SYNCING_REFACTORED_DATABASE_NAME: 'syncing_refactored',
    BROWSER_SYNC_TEMP_DATABASE_NAME: 'sync_temp',
    BROWSER_RETRY_SYNC_DATABASE_NAME:'sync_retry',  // Used to store all requests that should be repeated (either TIMEOUT , either BE entitiy was updated before our sync)
    // IDEA is to have one database instance always open in retry thread and other instances are opened 'as-we-go'. So version change should not happen. There should be only: 
    BROWSER_RETRY_MANAGER_DATABASE_NAME: 'sync_retry_manager', // This database should have one store/collection/table and should be used as PUSH NOTIFICATION from MAIN THREAD to retry-manager thread (running indefinetely)
    BROWSER_RETRY_MANAGER_TABLE_NAME: 'RequestToRepeatFailed',
    SYNC_DB_PREFIX_STRING: 'SyncDB_',
    SYNC_TEMP_DB_PREFIX_STRING: 'SyncTempDB_',
    SYNC_RETRY_DB_PREFIX_STRING: 'SyncRetryDB_',
    UNIQUE_IDENTIFIER: 'uuid',
    LAST_MODIFIED_FIELD: 'lastModified',
    EVENT_SOURCE_URL: 'https://localhost/.well-known/mercure',
    EVENT_SOURCE_SYNC_TOPIC: 'https://example.com/entities',
    DEFAULT_DELETE_ON_MERCURE_EVENT: true,
    DELETE_ON_MERCURE_EVENT_CONFIG: {
        'TestEntity': false
    } as any,
    ALLOW_MERCURE_PUSH_SERVICE_SYNC: true,  // use `false` when running tests -> for now
    SHORT_ENTITIY_NAME_TO_OBJECT_NAME: {
        'TestEntity': 'testEntity',
        'TheTest': 'theTtest',
    } as any,
    ALLOW_INTERVAL_SYNC: false, // true,
    AUTOMATIC_SYNC_INTERVAL: 7500, // in miliseconds
    DEBUG_MODE: true, // boolean
    ALLOW_RETRY_PROCESS: true,
    SIMULATION_COUNT_OBJECT_SIZES: true,
}


export const SYNC_LIB_BE_ENDPOINTS = {
    RETRY_API: 'retry-re-evaluation',
    RETRY_REFACTORED_API: 'refactored-retry-re-evaluation',
}

export const OBJECT_NAME_TO_PATH_MAPPER = {
    'object_name128deprecated': 'Something',
    'object_name128': 'App\\Entity\\TheTest',
    'example_table': 'App\\Entity\\TheTest',
    'testing_table': 'App\\Entity\\TheTest',
    'testEntity': 'App\\Entity\\TestEntity',
    // 'object_name128': 'App\\Entity\\TheWorst',
}

export const SHORT_ENTITIY_NAME_TO_OBJECT_NAME: any = {
    'TestEntity': 'testEntity',
    'TheTest': 'theTest',
}


// @deprecated This mapper will become deprecated and it will be substituted with DATABASE_TABLES_SCHEMA_MAPPER, which introduces @breaking-change
export const DATABASE_TABLES_MAPPER: { [key: string]: any } = {
    'sync' : { 
        'SyncDB_object_name128': '' ,
        'example_table': '&localUUID,objectStatus,changes,record,lastModified,lastRequestUuid,retries',
    },
    'syncing' : { 'example_table': '&localUUID,objectStatus,changes,record,lastModified' },
    'sync_conflict' : { 'example_table': '&objectUuid,conflicts,changes,record,lastModified' },  // Sklepam, da `changes` ne bo potreben
    'sync_temp': { 'SyncTempDB_object_name128': '' },
    'sync_retry': { 'SyncRetryDB_object_name128': '&objectUuid,requestUuid,status,retries,createdDatetime' },
    // 'sync_retry': { 'SyncRetryDB_object_name128': '&requestUuid,status,retries,createdDatetime' },
    'sync_retry_manager': {'RequestToRepeatFailed': '&requestUuid,status,createdDatetime'}, // status == sent|received (sent == code that wants to notify retry manager, received= retry manager listener on database)
};

export const DATABASE_TABLES_MAPPER_NEW: { [key:string]: any} = {
    sync : { 
        'SyncDB_object_name128': '' ,
        example_table: '&localUUID,objectStatus,changes,record,lastModified',
    },
    syncing : { 'example_table': '&localUUID,objectStatus,changes,record,lastModified' },
}

// TODO: This mapper logic will need to be loaded from configuration, where we declare objects that will be used in the sync process
export const DATABASE_TABLES_SCHEMA_MAPPER: { [key: string] : string} = {
    'sync_retry': '&objectUuid,requestUuid,status,retries,createdDatetime',
    'syncing_refactored': '&objectUuid,requestUuid,status,retries,data,createdDatetime', // status == 'in_progres' | 'pending_retry' | 'finished'
    // 'sync': '&localUUID,changes,lastModified,record,status', // I think this should be deprecated
    'sync': '&localUUID,changes,lastModified,record,objectStatus,lastRequestUuid,retries',
    'sync_temp': '&localUUID,changes,lastModified,record,objectStatus,lastRequestUuid',
    'sync_conflict': '&objectUuid,conflicts,changes,record,lastModified',
}

export const RETRY_DEFAULT_CONFIGURATION = 10;
export const RETRY_TABLES_CONFIGURATION : { [key: string]: number} = { // should represent how many retries should we try before disabling retry for specific entity
    'example_table': 5,
}

export const ALLOW_MERCURE_PUSH_SERVICE_SYNC = true;
export const BASE_TOPIC_NAME = 'entities'
export const MERCURE_SYNC_ENTITIES = ['AreAlive1', 'AreAlive2']; // IDEA: Inside this structure, I would keep data to which entities to subscribe? Currently I use one generic topic for all entities!!!
export const DEFAULT_MERCURE_SYNC_POLICY: EventSourcePolicyEnum = EventSourcePolicyEnum.SYNC_ALL;