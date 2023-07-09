import { AxiosError } from "axios";
import { Observable } from "rxjs";
import { RetryManagerMessageCommandEnum, RetryManagerPostCommandEnum, RetryWorkerResponseStatus, ServerRetryResponseStatus } from "../enums/retry.enum";
import { AAppDB } from "./database";

export interface RetryManagementWorkerData {
    objectName: string;
    retryDbInstance: AAppDB;
    requestUuid: string;
    data: any;
}

export enum RetryPushNotificationStatusEnum {
    SENT='SENT',
    RECEIVED='RECEIVED',
}

export interface RetryManagerWorkerInputParameters {
    communicationObservable: Observable<string>;
}

export interface RetryManagerWorkerPostDataI {
    command: RetryManagerPostCommandEnum;
    data: any;
}

export interface RetryManagerWorkerMessageDataI {
    command: RetryManagerMessageCommandEnum;
    data: any;
}

export interface RetryWorkerResponseI {
    status: RetryWorkerResponseStatus;
    error?: AxiosError | Error;
    data?: ServerRetryEntity[] | undefined;
}

export interface ServerRetryEntity {
    jobUuid: string;
    status: string;
    retries: number;
    createdDatetime: Date;
    entityName: string;
}

export interface ServerRetryResponseI {
    status: ServerRetryResponseStatus;
    data: undefined | null | string[];
    error: any;
}