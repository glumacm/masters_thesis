import 'reflect-metadata';
import { DoctrineEventActionEnum } from '../../enums/sync/doctrine-event-action.enum';
import { Transform, Type } from 'class-transformer';
import { convertDatabaseDatetimeStringToDate } from '../../utilities/date-utilities';
export class EventSourceStreamEvent {
    //@ts-ignore
    action: DoctrineEventActionEnum
    //@ts-ignore
    agentId: string;
    //@ts-ignore
    entityName: string;
    @Type(()=>ObjectDataWithLastModified)
    //@ts-ignore
    objectData: ObjectDataWithLastModified;
}

export class ObjectDataWithLastModified extends Object {
    // @Transform((value)=> convertDatabaseDatetimeStringToDate(value.value))
    @Type(()=>Date)
    //@ts-ignore
    lastModified: Date;
}