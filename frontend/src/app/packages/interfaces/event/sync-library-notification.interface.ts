import { SyncLibraryNotificationEnum } from "../../enums/event/sync-library-notification-type.enum";

export interface SyncLibraryNotificationI {
    type: SyncLibraryNotificationEnum;
    createdAt: Date;
    data?: any;
    message?: string;
    error?: any;

}