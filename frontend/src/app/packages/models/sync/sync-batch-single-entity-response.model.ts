import { Type } from 'class-transformer';
import 'reflect-metadata';
import { SyncEntityResponse } from './sync-entity-response.model';
import { SyncBatchSingleEntityStatusEnum } from '../../enums/sync/sync-batch-single-entity-status.enum';

export class SyncBatchSingleEntityResponse{
    @Type(()=>SyncEntityResponse)
    //@ts-ignore
    syncRecords: SyncEntityResponse[];
    //@ts-ignore
    status: SyncBatchSingleEntityStatusEnum;
    @Type(()=>Date)
    //@ts-ignore
    createdAt: Date;
}