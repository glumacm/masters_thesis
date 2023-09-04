import { AxiosError } from 'axios';
import * as Comlink from 'comlink';
import { Table } from 'dexie';
import { Subscription } from 'rxjs';
import { CONFIGURATION_CONSTANTS } from '../../configuration';
import { RetryWorkerResponseStatus, ServerRetryResponseStatus } from '../../enums/retry.enum';
import { RetryWorkerResponseI, ServerRetryResponseI } from '../../interfaces/retry-sync.interfaces';
import { ChamberSyncObjectStatus, SyncChamberRecordStructure } from '../../interfaces/sync-storage.interfaces';
import { ConflictService } from '../../services/conflict-service';
import { AppDB } from '../../services/db';
import { retry_refactored_re_evaluation, retry_re_evaluation } from '../../services/network-calls';
import { CONSOLE_STYLE, CustomConsoleOutput } from '../../utilities/console-style';
import { RetryEntryI, SyncingEntryI, TempEntryI } from '../retry/utilities';
export class RetryWorker {

    private conflictService: ConflictService;

    private consoleOutput: CustomConsoleOutput;
    private syncingDB: AppDB | undefined;


    private tempDB: AppDB | undefined;
    private syncDB: AppDB | undefined;
    private tempDBChangeSubscription: Subscription | undefined;
    private syncDBChangeSubscription: Subscription | undefined;

    constructor() {
        this.consoleOutput = new CustomConsoleOutput('RetryWorker', CONSOLE_STYLE.magenta_and_white);
        this.consoleOutput.closeGroup();
        this.syncingDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNCING_REFACTORED_DATABASE_NAME);

        // SERVICES
        this.conflictService = new ConflictService();
    }


    /**
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
                        * Glavne funkcije za izvedbo retry procesa
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     */

    /**
     * funkcija za inicializacijo vsega povezanega z bazami v retry-workerju
     */
    public async finishDbSetup() {
        await this.syncingDB?.finishSetup();
        await this.finishTempDBSetup();
    }


    /**
     * Funkcija za izvedbo retry procesa - posljemo zahtevo na BE ali se nek podatek se vedno sinhronizira ali ne.
     * @param retryEntries - vsi ustrezni zapisi iz `syncing` baze 
     * @param entityName - ime tabele od kjer dobimo zapise `retryEntries` znotraj `syncing` baze
     * @returns 
     */
    public async startRefactoredRetryProcess(retryEntries: SyncingEntryI[], entityName: string) {
        /**
         * Kratek opis:
         * Funkcija preko BE zahteve izve katerim zapisom v `syncing` bazi je potrebno povecati `retry` vrednost, 
         * oziroma katere zapise lahko pobrisemo iz `syncing` baze.
         * 
         * Dolgi opis:
         * 1. na BE posljemo retry zapise, ki smo jih dobili iz `syncing` baze
         * 2. preden dokoncno dobimo podatek odgovor iz tocke 1, ustvarimo mapping iz id requesta(object uuid-ja) v celoten retry entry objekt.
         * 3. pocakamo na odgovor iz BE.
         * 4. izvedemo logiko glede na odgovor.
         * 4.1 Odgovor vrne nek uspesen odgovor
         * 4.1.1 Poiscemo vse syncing retry podatke, od katerih UUID je enak UUID-jem, ki smo jih dobili kot odgovor iz BE
         * in jim povecamo RETRY za +1.
         * 4.1.2 Za vsak uuid, iz odgovora BE-ja se sprehodimo cez mapper iz tocke 2. in odstranimo ven podatke, ki so vezani na vsak uuid
         * [NOT YET SURE] 4.1.3.0 TEMP logika, ki mora preveriti ali obstaja kaksen podatke v TEMP za omenjeni UUID in nato narediti merge iz TEMP v SYNC in nastavi objectStatus na `pending_sync`. 
         * 4.1.3 Za vse preostale podatke v mapperju iz tocke 2. popravimo polje `objectStatus` v bazi `sync`.
         * 4.1.4 Za vse podatke, ki ustrezajo UUID-jem iz preostalih podatkov mapperja iz tocke 2, se jih pobrise iz `syncing` baze.
         * 4.1.5 Retry management thread-u vrnemo vse zapise (UUID-je), ki jih je BE nasel da so se v `izvajanju`.
         * 4.2 Ce pride do napake pri zahtevi na BE, se vrne prilagojen odgovor (za retry management thread).
         */
        try {
            // call BE
            // return specific data
            /**
             * First we send reEvaluations to BE
             * @var responseData if BE still has some in-progress data that is linked to data in reEvaluations, 
             * we will get array of those items in the response.
             */
            this.consoleOutput.output(`REtry process entries sent: `, retryEntries);
            // return undefined;

            const responseData = retry_refactored_re_evaluation(retryEntries, entityName);
            const mapRequestIdToRetryEntry: { [key: string]: SyncingEntryI } = retryEntries.reduce<{ [key: string]: SyncingEntryI }>(
                (previousValue, currentValue: SyncingEntryI, currentIndex) => {
                    previousValue[currentValue.requestUuid] = currentValue;
                    return previousValue;
                },
                {}
            );
            const returnObject = {
                status: 'SUCCESS',
                data: null,
                error: null
            };

            const response = await responseData;


            this.consoleOutput.output(`This is response from BE: `, response);
            this.consoleOutput.output(`this is mapped data:L `, mapRequestIdToRetryEntry);
            // if (response && response.status >= 200 && response.status < 300 ) {
            if (response?.data) {
                // response.data ==> array of UUIDs !!! That represent item in syncingDB (if uuid present in response.data, then this job is still syncing!)
                const serverResponse = response.data as ServerRetryResponseI;
                const dataNeedsUpdate = (serverResponse.status == ServerRetryResponseStatus.SUCCESS) && serverResponse.data && serverResponse?.data?.length > 0;
                this.consoleOutput.output(`This is success response for refactored retry process: `, response.data);
                if (dataNeedsUpdate) {
                    // Vprasanje: Ali ta logika lahko deluje za vse primere? Ker meni deluje, ta v primeru, da imamo retry-je iz razlicnih tabel, potem ta zadeva ne bo delovala.
                    // Odgovor: Deluje, ker ta logika se poklice za vsako tabelo posebej!
                    const increateRetries = this.syncingDB!.table(entityName).where('requestUuid').anyOf(response.data).modify((syncingItem: SyncingEntryI) => {
                        syncingItem.retries = syncingItem.retries + 1;
                        this.consoleOutput.output(`mr mojo rising:  `, syncingItem);
                    });

                    for (let objectUuid of response.data) {
                        if (mapRequestIdToRetryEntry[objectUuid]) {
                            delete mapRequestIdToRetryEntry[objectUuid];
                        }
                    }

                    await increateRetries;

                }
                const remainingObjectUuids = Object.keys(mapRequestIdToRetryEntry);
                this.consoleOutput.output(`This is data that will be updated: `, remainingObjectUuids);
                if (remainingObjectUuids.length > 0) {
                    this.consoleOutput.output(`with no one to share`, mapRequestIdToRetryEntry);

                    {// Ta block kode mora biti kasneje dodan za kodo, ki popravi `sync` entry-je v `synced`
                        // TODO: Logika za TEMP
                        // REFACTOR: Zamenjaj logiko z eno splosno funkcijo za manipulacijo z bazo
                        const tempEntries = (await this.getTempDB()).table(entityName).where('localUUID').anyOf(remainingObjectUuids);

                        tempEntries.each((item: TempEntryI) => {
                            this.processTempEntryAfterSyncDone(item, entityName, item.localUUID);
                        });

                    }

                    // TODO: Manjka logika, da se nastavi status v `sync` tabeli v synced
                    // Predpostavljamo, da tabela ze obstaja, ker drugace ne bi mogli priti do takega use-casea, da bi imeli RETRY proces.
                    return;
                    await (await this.getSyncDB()).table(entityName).where('localUUID').anyOf(remainingObjectUuids).modify(
                        (item) => {
                            item.objectStatus = ChamberSyncObjectStatus.synced
                        }
                    );
                    // TODO: manjka logika, da se TEMP podatke nastavi in se to poslje na BE
                    // @Vprasanje: Ali lahko nastane problem v primeru, ko dobimo iz BE konflikte in hkrati imamo na FE v TEMP tudi podatke za objekt, ki je v konfliktu?


                    const deleteProcessedRequests = this.syncingDB!.table(entityName).where('requestUuid').anyOf(remainingObjectUuids).delete();
                    await deleteProcessedRequests;
                }

                returnObject.data = response.data; // show retry management which data is still to be processed
            }
            return returnObject;
        } catch (e: any | AxiosError) {

            if (e instanceof AxiosError) {
                this.consoleOutput.output(`what are you saing? `, e);
                return this.prepareResponseFromAxiosError(e);

            } else {
                return {
                    status: 'ERROR',
                    error: e,
                    errorType: 'any',
                }
            }
        }
    }


    /**
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     *                              Pomozne funkcije
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     * ********************************************************************************
     */


    /**
     * Funkcija bi morala vzeti iz TEMP ujemajoce podatke (na podlagi UUID) in zdruziti te podatke s podatki v SYNC.
     * @param tempEntry 
     * @param entityName 
     * @param objectUuid 
     * @returns 
     */
    private async processTempEntryAfterSyncDone(tempEntry: TempEntryI, entityName: string, objectUuid: string) {
        /**
         * @remarks
         * This function should do the following:
         * 1. Get object from `sync` db
         * 2. apply each change to object in `sync`
         * 3. remove entry from TEMP
         * 
         */

        // 1.
        const syncEntry: SyncChamberRecordStructure = await this.doesEntryExistInDB(await this.getSyncDB(), entityName, tempEntry.localUUID);

        if (!syncEntry) {
            return;
        }
        // mislim da bo potrebno shraniti zadeve s pomocjo automerga
    }

    private prepareResponseFromAxiosError(error: AxiosError): { error: string, errorType: string, stack: string | undefined, code: string | undefined } {
        const errorData = {} as { error: string, errorType: string, stack: string | undefined, code: string | undefined };
        errorData.error = error.message;
        errorData.code = error.code;
        errorData.errorType = 'AxiosError';
        errorData.stack = error.stack;
        return errorData;
    }



    public closeDb() {
        this.syncingDB?.close();
    }



    /**
     * @remarks
     * Ta funkcija mora biti genericna in dostopna iz nekega splosnega file-a (preko importa).
     */
    public async applyChangeToObject(): Promise<void> {

    }

    public async doesTableExistInDB(database: AppDB, tableName: string): Promise<boolean> {
        return !!database.tables.find((table: Table) => table.name == tableName);
    }

    public async doesEntryExistInDB(database: AppDB, tableName: string, objectUuid: string): Promise<any> {
        return database.table(tableName).get(objectUuid); // return <Item> | undefined
    }

    public async startRetryProcess(retryEntries: RetryEntryI[], entityName: string) {
        try {
            this.consoleOutput.output(`this words`);
            const responseData = retry_re_evaluation(retryEntries, entityName);

            // do mapper 

            const mapRequestIdToRetryEntry: { [key: string]: RetryEntryI } = retryEntries.reduce<{ [key: string]: RetryEntryI }>(
                (previousValue, currentValue: RetryEntryI, currentIndex) => {
                    previousValue[currentValue.requestUuid] = currentValue
                    return previousValue;
                },
                {}
            );

            const response = await responseData;




            this.consoleOutput.output(` - startRetryPRocess - success `, response);

            if (response && response.status >= 200 && response.status < 300) {
                const returnedEntries = response.data;
                const returnedEntriesKeys = returnedEntries ? response.data.keys() : [];
                const itemsToDelete = [];
                const itemsToUpdate = [];
                for (let key of Object.keys(mapRequestIdToRetryEntry)) {
                    // 
                    if (!returnedEntries[key]) {
                        itemsToDelete.push(key); // add request uuid to delete array
                    } else {
                        mapRequestIdToRetryEntry[key].retries = mapRequestIdToRetryEntry[key].retries + 1;
                        itemsToUpdate.push(key);
                    }
                }
                return { status: RetryWorkerResponseStatus.SUCCESS, data: [] } as RetryWorkerResponseI;
            }
            return {
                status: RetryWorkerResponseStatus.ERROR,
                data: undefined,
                error: new Error('Error in startRetryProcess: non-identified scenario'),
            } as RetryWorkerResponseI
        } catch (e) {
            const error = e as AxiosError;
            // @TODO: ERR_BAD_REQUEST, ERR_BAD_RESPONSE, ERR_NETWORK, ECONNABORTED
            this.consoleOutput.output(` - startRetryProcess - error `, e);
            return {
                status: RetryWorkerResponseStatus.ERROR,
                error: e,
            } as RetryWorkerResponseI;
        }

    }

    /**
     * 
     * DATABASE related functions
     */



    async getTempDB(): Promise<AppDB> {
        if (!this.tempDB?.isOpen()) {
            // open database
            await this.finishTempDBSetup();
        }
        return this.tempDB!;
    }

    async getSyncDB(): Promise<AppDB> {
        if (!this.syncDB?.isOpen()) {
            // open database
            await this.finishSyncDBSetup();
        }
        return this.syncDB!;
    }

    async finishSyncDBSetup() {
        this.syncDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_DATABASE_NAME);
        await this.syncDB.finishSetup();
        this.syncDBChangeSubscription = this.syncChangeSubscription(this.syncDB);
    }

    async finishTempDBSetup() {
        this.tempDB = new AppDB(CONFIGURATION_CONSTANTS.BROWSER_SYNC_TEMP_DATABASE_NAME);
        await this.tempDB.finishSetup();
        this.tempDBChangeSubscription = this.tempChangeSubscription(this.tempDB);
    }

    syncChangeSubscription(newDB: AppDB): Subscription {
        this.syncDBChangeSubscription?.unsubscribe();

        this.syncDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.syncDB = newDB;
                    this.syncChangeSubscription(newDB!);
                }
            }
        )
        return this.syncDBChangeSubscription;
    }

    tempChangeSubscription(newDB: AppDB): Subscription {
        this.tempDBChangeSubscription?.unsubscribe();

        this.tempDBChangeSubscription = newDB.instanceChanged.subscribe(
            {
                next: (newDB) => {
                    this.tempDB = newDB;
                    this.tempChangeSubscription(newDB!);
                }
            }
        )
        return this.tempDBChangeSubscription;
    }


}

Comlink.expose(RetryWorker);



