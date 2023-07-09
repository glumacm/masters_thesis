import { Type } from 'class-transformer';
import 'reflect-metadata';

export class SyncConflictItem{
    fieldName: string | any;
    conflictId: string | any;
    value: any;
    @Type(()=>Date)
    //@ts-ignore
    datetime: Date;
}