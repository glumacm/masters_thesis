import Dexie, { PromiseExtended } from "dexie";
import { ChamberSyncObjectStatus } from "./sync-storage.interfaces";

export interface IAppDB extends Dexie {
    newMethod(): PromiseExtended<Dexie>;
    getDB(): this;
    setDB(): void;
    getItemByLocalUuid(table: string, localUuid: string): Promise<any>;
    getKeyByLocalUuid(table: string, localUuid: string): Promise<any>;
    updateItemFromTable(table: string, key: string, item: any): Promise<boolean>;
    setStatusOnSyncItemsBasedOnStatus(table: string, currentStatus: ChamberSyncObjectStatus, newStatus: ChamberSyncObjectStatus): Promise<boolean>;
    getKeysFromLocalUuids(table: string, localUuids: string[]): Promise<any>;
    
}

export abstract class AAppDB extends Dexie {
    protected abstract newMethod(): Promise<Dexie>;
    abstract getDB(): any;
    abstract setDB(newDatabase: any): void;
    abstract getItemByLocalUuid(table: string, localUuid: string): Promise<any>;
    abstract getKeyByLocalUuid(table: string, localUuid: string): Promise<any>;
    abstract updateItemFromTable(table: string, key: string, item: any): Promise<boolean>;
    abstract setStatusOnSyncItemsBasedOnStatus(table: string, currentStatus: ChamberSyncObjectStatus, newStatus: ChamberSyncObjectStatus): Promise<boolean>;
    abstract getKeysFromLocalUuids(table: string, localUuids: string[]): Promise<any>;
    
}