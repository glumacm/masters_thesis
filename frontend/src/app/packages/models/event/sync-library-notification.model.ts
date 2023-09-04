import { Type } from "class-transformer";
import 'reflect-metadata';
import { SyncLibraryNotificationEnum } from "../../enums/event/sync-library-notification-type.enum";
import { SyncLibraryNotificationI } from "../../interfaces/event/sync-library-notification.interface";

export class SyncLibraryNotification implements SyncLibraryNotificationI {
    //@ts-ignore
    type: SyncLibraryNotificationEnum;
    @Type(()=>Date)
    //@ts-ignore
    createdAt: Date;
    data?: any;
    message?: string | undefined;
    error?: any;

}