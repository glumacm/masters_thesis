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

/*

export interface Dexie extends Database {
	readonly name: string;
	readonly tables: Table[];
	readonly verno: number;
	readonly vip: Dexie;
	readonly _allTables: {
		[name: string]: Table<any, IndexableType>;
	};
	readonly core: DBCore;
	_createTransaction: (this: Dexie, mode: IDBTransactionMode, storeNames: ArrayLike<string>, dbschema: DbSchema, parentTransaction?: Transaction | null) => Transaction;
	_dbSchema: DbSchema;
	version(versionNumber: number): Version;
	on: DbEvents;
	open(): PromiseExtended<Dexie>;
	table<T = any, TKey = IndexableType>(tableName: string): Table<T, TKey>;
	transaction<U>(mode: TransactionMode, table: Table, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: string, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: Table, table2: Table, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: string, table2: string, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: Table, table2: Table, table3: Table, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: string, table2: string, table3: string, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: Table, table2: Table, table3: Table, table4: Table, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: string, table2: string, table3: string, table4: string, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: Table, table2: Table, table3: Table, table4: Table, table5: Table, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, table: string, table2: string, table3: string, table4: string, table5: string, scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, tables: Table[], scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	transaction<U>(mode: TransactionMode, tables: string[], scope: (trans: Transaction) => PromiseLike<U> | U): PromiseExtended<U>;
	close(): void;
	delete(): PromiseExtended<void>;
	isOpen(): boolean;
	hasBeenClosed(): boolean;
	hasFailed(): boolean;
	dynamicallyOpened(): boolean;
	backendDB(): IDBDatabase;
	use(middleware: Middleware<DBCore>): this;
	// Add more supported stacks here... : use(middleware: Middleware<HookStack>): this;
	unuse({ stack, create }: Middleware<{
		stack: keyof DexieStacks;
	}>): this;
	unuse({ stack, name }: {
		stack: keyof DexieStacks;
		name: string;
	}): this;
	// Make it possible to touch physical class constructors where they reside - as properties on db instance.
	// For example, checking if (x instanceof db.Table). Can't do (x instanceof Dexie.Table because it's just a virtual interface)
	Table: {
		prototype: Table;
	};
	WhereClause: {
		prototype: WhereClause;
	};
	Version: {
		prototype: Version;
	};
	Transaction: {
		prototype: Transaction;
	};
	Collection: {
		prototype: Collection;
	};
}

*/