import Dexie, { Table } from "dexie";
import { BehaviorSubject, of, ReplaySubject, Subject } from "rxjs";
import { CONFIGURATION_CONSTANTS, DATABASE_TABLES_MAPPER } from "../configuration";
import { IAppDB, AAppDB} from "../interfaces/database";
import { ChamberSyncObjectStatus } from "../interfaces/sync-storage.interfaces";
import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";
import { DeferredPromise } from "../utilities/deferred";

export class AppDB extends AAppDB {
     // SYNC_DB should be from now on referenced as CURRENT DB !!!
    public instanceChanged: Subject<AppDB> = new Subject<AppDB>();
    constructor(databaseName: string = 'sync', tables: { [key: string]: any } = DATABASE_TABLES_MAPPER) {
        console_log_with_style(`ENTER APPDB constructor! --- for table: ${databaseName}`, CONSOLE_STYLE.promise_success!, '');

        // if (!AppDB._db) {


        //     super('sync');


        //     this.version(2).stores({
        //         'SyncDB_object_name128': ''
        //     });
        //     this.newMethod();
        //     AppDB._db = this;

        // console_log_with_style(`ENTER APPDB constructor! --- for table: ${databaseName}`, CONSOLE_STYLE.promise_success!, '');


        super(databaseName);


        // this.version(2).stores(tables[databaseName]);
        // this.version(this.verno+1).stores(tables[databaseName]);
        // this.newMethod();
        // AppDB._db = this;

        // this.open();


        // }

    }


    /**
     * This function was especially created for unit-test cases, but it could also be used later on for something else, since this 
     * could be A-WAY-TO-GO in order to always have the latest DB version of some specific database.
     * Especially if we use same DB in different places with different constructors, therefore we must be able
     * to notify the code to update the instance.
     * @param db 
     * @param schemaChanges 
     * @param newVersion 
     * @returns 
     */
    async changeSchemaInstance(db: AppDB, schemaChanges?: any, newVersion?: number | null): Promise<AppDB> {
        console.log(`SOMEBODY IS CLOSING THIS : ${db.name}`);
        
        db.close();
        const newDb = new AppDB(db.name);
        // await newDb.finishSetup();
       
        newDb.on('blocked', ()=>false); // Silence console warning of blocked event.
        
        // Workaround: If DB is empty from tables, it needs to be recreated
        if (db.tables.length === 0) {
          await db.delete();
          if (schemaChanges) {
            // I think it not a problem if we set new version to 1 if we have 0 tables... this description is for use-case when we delete last table from database (not for use-case when we first create database and therefore first table)
            newDb.version(1).stores(schemaChanges);
          }
          await newDb.open();
          this.instanceChanged.next(newDb);
          return newDb;
        }
    
        // Extract current schema in dexie format:
        const currentSchema = db.tables.reduce((result: any,{name, schema}) => {
            result[name] = [
              schema.primKey.src,
            ...schema.indexes.map(idx => idx.src)
          ].join(',');
          return result;
        }, {});
        
        // Tell Dexie about current schema:
        newDb.version(db.verno).stores(currentSchema);
        // Tell Dexie about next schema:
        if (schemaChanges) {
            newDb.version(db.verno + 1).stores(schemaChanges);
        } else if(newVersion) {
            newDb.version(newVersion);
        }
        // Upgrade it:
        await newDb.open();
        this.instanceChanged.next(newDb);
        return newDb;    
    }

    async addEntryToTable(tableName: string, dataUuid: string, dataToInsert: any, dbVersion?: any, tableSchema?: any): Promise<AppDB> {
        let tableReference: AppDB = this;
        console.log('Turn up the lights');
        
        if (!this.tables.find((table: Table) => table.name === tableName)) {
            console.log('MUSIC');
            
            tableReference = await this.changeSchemaInstance(this, tableSchema, dbVersion);
        }

        console.log('SPECIAL FIREND');
        
        await tableReference.table(tableName).put(dataToInsert, dataUuid);
        return tableReference;
    }


    /**
     * 
     * @param db 
     * @param schemaChanges 
     * @param newVersion Must be converted value to plain number version (like the version number in native IndexedDB and not version number from DEXIE which is already multiplied by 10 !!!!)
     * @returns 
     */
    static async changeSchema(db: AppDB, schemaChanges?: any, newVersion?: number | null): Promise<AppDB> {
        db.close();
        const newDb = new AppDB(db.name);
        // await newDb.finishSetup();
       
        newDb.on('blocked', ()=>false); // Silence console warning of blocked event.
        
        // Workaround: If DB is empty from tables, it needs to be recreated
        if (db.tables.length === 0) {
          await db.delete();
          if (schemaChanges) {
            // I think it not a problem if we set new version to 1 if we have 0 tables... this description is for use-case when we delete last table from database (not for use-case when we first create database and therefore first table)
            newDb.version(1).stores(schemaChanges);
          }
          await newDb.open();
          return newDb;
        }
    
        // Extract current schema in dexie format:
        const currentSchema = db.tables.reduce((result: any,{name, schema}) => {
            result[name] = [
              schema.primKey.src,
            ...schema.indexes.map(idx => idx.src)
          ].join(',');
          return result;
        }, {});
        
        // Tell Dexie about current schema:
        newDb.version(db.verno).stores(currentSchema);
        // Tell Dexie about next schema:
        if (schemaChanges) {
            newDb.version(db.verno + 1).stores(schemaChanges);
        } else if(newVersion) {
            newDb.version(newVersion);
        }
        // Upgrade it:
        await newDb.open();
        return newDb;    
    }

    public async finishSetup() {
        const dbOpen = await this.open();
        return dbOpen;

    }

    protected async newMethod(): Promise<Dexie> {
        const d = await this.open();
        const defered = new DeferredPromise<Dexie>();
        defered.resolve(d);
        return defered.promise;
        
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

    public tableExists(tableName:string):boolean {
        return !!this.tables.find((table: Table) => table.name == tableName);
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

    public async updateItemFromTable(table: string, key: string, item: any): Promise<boolean> {
        const defered = new DeferredPromise<boolean>();
        try {
            const success = await this.table(table).update(key, item);
            const defered = new DeferredPromise<boolean>();
            defered.resolve(true);
            return defered.promise;
        }
        catch (exception) {
            console_log_with_style('ERROR WHILE UPDATING IN DEXIE....', CONSOLE_STYLE.promise_error!, exception);
            defered.resolve(false);
            return defered.promise;
        }
    }

    public async setStatusOnSyncItemsBasedOnStatus(table: string, currentStatus: ChamberSyncObjectStatus, newStatus: ChamberSyncObjectStatus, statusField: string = 'objectStatus'): Promise<boolean> {

        let success = true;
        console_log_with_style('START ITEMS UPDATE IN TRANSACTION....', CONSOLE_STYLE.promise_error!, {});
        // const allItemsFoundByConditionInTable = await this.table(table).filter((tableItem) => tableItem.objectStatus == currentStatus);
        const allItemsFoundByConditionInTable = await this.table(table).filter((tableItem) => tableItem[statusField] == currentStatus);
        const countFoundItems = await allItemsFoundByConditionInTable.count();
        try {
            let index = 0;
            const numberOfSuccessfullyModifiedItems = await allItemsFoundByConditionInTable.modify(
                (obj) => {
                    console_log_with_style('INSIDE EACH ITEM....', CONSOLE_STYLE.promise_error!, obj);
                    // obj.objectStatus = newStatus;
                    obj[statusField] = newStatus;
                    
                    
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
        const deferedPromise = new DeferredPromise<boolean>();
        deferedPromise.resolve(success);
        return deferedPromise.promise;

    }


    public async setStatusOnSyncItemsBasedOnStatusGeneric(table: string, currentStatus: any, newStatus: any, statusField: string = 'objectStatus'): Promise<boolean> {

        let success = true;
        console_log_with_style('START ITEMS UPDATE IN TRANSACTION....', CONSOLE_STYLE.promise_error!, {});
        // const allItemsFoundByConditionInTable = await this.table(table).filter((tableItem) => tableItem.objectStatus == currentStatus);
        const allItemsFoundByConditionInTable = await this.table(table).filter((tableItem) => tableItem[statusField] == currentStatus);
        const countFoundItems = await allItemsFoundByConditionInTable.count();
        try {
            let index = 0;
            const numberOfSuccessfullyModifiedItems = await allItemsFoundByConditionInTable.modify(
                (obj) => {
                    console_log_with_style('INSIDE EACH ITEM....', CONSOLE_STYLE.promise_error!, obj);
                    // obj.objectStatus = newStatus;
                    obj[statusField] = newStatus;
                    
                    
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
        const deferedPromise = new DeferredPromise<boolean>();
        deferedPromise.resolve(success);
        return deferedPromise.promise;

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