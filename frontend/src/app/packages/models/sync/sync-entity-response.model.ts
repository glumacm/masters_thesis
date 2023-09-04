import 'reflect-metadata';
import { Type } from "class-transformer";
import { SyncEntityStatusEnum } from "../../enums/sync/sync-entity-status.enum";
import { SyncEntityResponseI } from "../../interfaces/sync/sync-entity-response.interface";
import { MergeProcessResult } from "./merge-process-result.model";

export class SyncEntityResponse implements SyncEntityResponseI {
    //@ts-ignore
    status: string;
    @Type(()=>MergeProcessResult)
    mergedData: MergeProcessResult | undefined;
    recordUuid: string | undefined;
    @Type(()=>Date)
    //@ts-ignore
    lastModified: Date;
    error: any;
}
