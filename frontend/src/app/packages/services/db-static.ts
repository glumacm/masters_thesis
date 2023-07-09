import Dexie, { DBCoreRangeType, PromiseExtended } from "dexie";
import { of } from "rxjs";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../configuration";
import { IAppDB, AAppDB} from "../interfaces/database";
import { ChamberSyncObjectStatus } from "../interfaces/sync-storage.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";

export class AppDB extends AAppDB {
    // static _db: AppDB;
    // constructor(databaseName: string = 'sync', tables: { [key: string]: any } = { 'sync': { 'SyncDB_object_name128': '' } }) {
    private constructor(databaseName: string = 'sync', tables: { [key: string]: any } = DATABASE_TABLES_MAPPER) {
        console_log_with_style(`ENTER APPDB constructor! --- for table: ${databaseName}`, CONSOLE_STYLE.promise_success!, '');

        super(databaseName);


        this.version(2).stores(tables[databaseName]);
        // this.version(this.verno+1).stores(tables[databaseName]);
        this.newMethod();
        // AppDB._db = this;

        this.open();


        // }

    }

    public async finishSetup() {
        await this.open();
    }

    protected async newMethod() {
        const d = await this.open();
        return of(d).toPromise();
    }

    public getDB(): AppDB {
        // if (!AppDB._db)
            // AppDB._db = this;
        // return AppDB._db;
        return this;
    }

    public setDB(newDatabase: AppDB): void {
        // this.db = null;
        // AppDB._db = newDatabase;
    }

    public async getItemByLocalUuid(table: string, localUuid: string): Promise<any> {
        const itemAsArray = this.table(table).filter((obj) => obj.localUUID == localUuid).toArray();
        const ar = await itemAsArray;
        return ar?.length > 0 ? of(ar[0]).toPromise() : of().toPromise();
    }

    public async getKeyByLocalUuid(table: string, localUuid: string): Promise<any> {
        const itemAsArray = await this.table(table).filter((obj) => obj.localUUID == localUuid).keys();
        return of(itemAsArray[0]).toPromise();
    }

    public async updateItemFromTable(table: string, key: string, item: any) {
        try {
            const success = await this.table(table).update(key, item);
            return of(true).toPromise();
        }
        catch (exception) {
            console_log_with_style('ERROR WHILE UPDATING IN DEXIE....', CONSOLE_STYLE.promise_error!, exception);
            return of(false).toPromise();
        }
    }

    public async setStatusOnSyncItemsBasedOnStatus(table: string, currentStatus: ChamberSyncObjectStatus, newStatus: ChamberSyncObjectStatus): Promise<boolean> {

        let success = true;
        console_log_with_style('START ITEMS UPDATE IN TRANSACTION....', CONSOLE_STYLE.promise_error!, {});
        const allItemsFoundByConditionInTable = await this.table(table).filter((tableItem) => tableItem.objectStatus == currentStatus);
        const countFoundItems = await allItemsFoundByConditionInTable.count();
        try {
            let index = 0;
            const numberOfSuccessfullyModifiedItems = await allItemsFoundByConditionInTable.modify(
                (obj) => {
                    console_log_with_style('INSIDE EACH ITEM....', CONSOLE_STYLE.promise_error!, obj);
                    obj.objectStatus = newStatus;
                    // if (index > 0){
                    //     throw new Error("WHAT IS GOING ON");
                    // }
                    // console_log_with_style('ONCE WENT THROUGH....', CONSOLE_STYLE.promise_error!, obj);
                    // index++;
                }
            );
        }
        catch (exception) {
            success = false;
        }
        // console_log_with_style(`COMPARE COUNT FOR FIRST QUERY: ${countFoundItems}    THEN WE HAVE UPDATE: ${numberOfSuccessfullyModifiedItems}`, CONSOLE_STYLE.promise_error!, '');
        return of(success).toPromise();

    }

    public async getKeysFromLocalUuids(table: string, localUuids: string[]): Promise<any> {
        const allItemsFoundByUuids = await this.table(table).filter((tableItem) => {
            return localUuids.includes(tableItem.localUUID);
        });
        allItemsFoundByUuids.eachKey(
            (key) => {
                console_log_with_style(`CHECK THIS OUT: ${key}`, CONSOLE_STYLE.red_and_black!, allItemsFoundByUuids);
            }
        )
    }
}

// export const db = new AppDB();