export enum RetryManagerPostCommandEnum {
    INITIALIZE_DB='INITIALIZE_DB',
    TERMINATE_THREAD='TERMINATE_THREAD',
    PRINT_MESSAGE='PRINT_MESSAGE',
    ADD_NEW_RETRY_ENTRY='ADD_NEW_RETRY_ENTRY',
    CLOSE_REEVALUATION_INTERVAL='CLOSE_REEVALUATION_INTERVAL',

}

export enum RetryPushNotificationStatusEnum {
    SENT='SENT',
    RECEIVED='RECEIVED',
}

export enum RetryManagerMessageCommandEnum {
    SYNC_ENTITY_TIMEOUT='SYNC_ENTITY_TIMEOUT',
    SYNC_ENTITY_NETWORK_ERROR='SYNC_ENTITY_NETWORK_ERROR',
}

export enum RetryWorkerResponseStatus {
    ERROR='ERROR',
    SUCCESS='SUCCESS',
}

export enum ServerRetryEntityStatus {
    in_progress='in-progress',
    stopped='stopped',
    finished='finished',
    canceled='canceled',
}

export enum ServerRetryResponseStatus {
    SUCCESS='SUCCESS',
    ERROR='ERROR',
    CONFLICT='CONFLICT',
}