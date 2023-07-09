export enum SyncBatchSingleEntityStatusEnum {
    COMPLETE_SUCCESS = 'COMPLETE_SUCCESS',
    PARTIAL_SUCESS = 'PARTIAL_SUCESS',
    FATAL_ERROR = 'FATAL_ERROR', // Trenutno se ta napaka zgodi, ko ne obstaja entiteta v konfiguraciji -> torej le v enem primeru
    CONCURRENCY_PROBLEM = 'CONCURRENCY_PROBLEM',
}