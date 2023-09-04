export enum SyncBatchSingleEntityStatusEnum {
    COMPLETE_SUCCESS = 'COMPLETE_SUCCESS',
    PARTIAL_SUCESS = 'PARTIAL_SUCESS',
    COMPLETE_FAIL = 'COMPLETE_FAIL',
    FATAL_ERROR = 'FATAL_ERROR', // Currently an error is thrown when entity does not exist in the configuration -> so only in one scenario
    CONCURRENCY_PROBLEM = 'CONCURRENCY_PROBLEM',
}