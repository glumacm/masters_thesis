export enum SynchronizationSyncStatus {
    COMPLETE='COMPLETE',
    PARTIAL='PARTIAL',
    FAILED_ALL='FAILED_ALL',
    ECONNABORTED='ECONNABORTED', // @deprecated this value in this enum should be DEPRECATED!
    ERR_BAD_RESPONSE='ERR_BAD_RESPONSE', // @deprecated this value in this enum should be DEPRECATED!
    ERR_NETWORK='ERR_NETWORK', // @deprecated this value in this enum should be DEPRECATED!
    NO_ACTION='NO_ACTION',
    CONCURRENCY_PROBLEM='CONCURRENCY_PROBLEM',
}

export enum SynchronizationExceptionCode {
    ENTITY_CLASS_NOT_FOUND='ENTITY_CLASS_NOT_FOUND',
    REPOSITORY_NOT_FOUND='REPOSITORY_NOT_FOUND',
    PROPERTY_NOT_FOUND='PROPERTY_NOT_FOUND',
    LAST_MODIFIED_DOES_NOT_MATCH='LAST_MODIFIED_DOES_NOT_MATCH',
}

export enum ResponseMessageType
{
    SUCCESS='SUCCESS',
    MISSING_REQUIRED_FIELDS='MISSING_REQUIRED_FIELDS',
    SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH='SYNCHRONIZATION_LAST_MODIFIED_FIELD_MISMATCH',
    UNKNOWN_ERROR='UNKNOWN_ERROR',
    REPOSITORY_NOT_FOUND='REPOSITORY_NOT_FOUND',
}

export enum SyncEntityWithCommandsWorkerCommandEnum {
    SYNC_ENTITY_TIMEOUT='SYNC_ENTITY_TIMEOUT',
    SYNC_ENTITY_NETWORK_ERROR='SYNC_ENTITY_NETWORK_ERROR',
}

export enum HttpErrorResponseEnum {
    ECONNABORTED='ECONNABORTED', // this status is received when axios breaks because of timeout (request waits too long for response from server)
    ERR_BAD_RESPONSE='ERR_BAD_RESPONSE', // this status happens when server logic throws unhandled exception/error (and therefore we do not receive expected response structure)
    ERR_NETWORK='ERR_NETWORK', // this status is received when request cannot reach server (server is OUT, server is not running, sever is not reachable ,etc.)
}