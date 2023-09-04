import { Subject } from "rxjs";
import { SyncLibraryNotification } from "./models/event/sync-library-notification.model";

export class SynchronizationLibraryBase {
    public static eventsSubject: Subject<SyncLibraryNotification>;
}