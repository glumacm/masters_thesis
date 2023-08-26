import { BehaviorSubject, Observable } from "rxjs";
import { skipWhile, switchMap } from "rxjs/operators";
import { NetworkStatusEnum } from "../interfaces/network-status.interfaces";
import { CONSOLE_STYLE, CustomConsoleOutput } from "../utilities/console-style";

export class NetworkStatus {
    private static _instance: NetworkStatus;
    // private readonly PUBLIC_ADDRESS_TO_PING = 'https://dns.google';
    private status: BehaviorSubject<NetworkStatusEnum>;
    private networkChange$: Observable<NetworkStatusEnum>;
    private readonly PUBLIC_ADDRESS_TO_PING = 'https://dns.google';
    private firstExecution: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);
    private customOutput: CustomConsoleOutput;


    private constructor(preExistingExecutionCondition: boolean = false) {
        this.customOutput = new CustomConsoleOutput('NetworkStatus', CONSOLE_STYLE.sync_lib_main_positive_vibe);
        this.customOutput.closeGroup();
        if (preExistingExecutionCondition) {
            this.customOutput.output(`Who data`, preExistingExecutionCondition)
            this.firstExecution.next(false);
        }

        // NetworkStatus._instance = this;
        this.status = new BehaviorSubject<NetworkStatusEnum>(navigator.onLine ? NetworkStatusEnum.ONLINE : NetworkStatusEnum.OFFLINE);
        this.networkChange$ = this.status.asObservable().pipe(
            skipWhile((_) => this.firstExecution.value), // Until this.firstExecution.value === true this stream is not executed!!!
            switchMap(() => this.status),
        );
    }

    public static getFirstExecution(): BehaviorSubject<boolean> | undefined {
        return this._instance?.firstExecution;
    }
    public static getInstance(preExistingExecutionCondition: boolean = false): NetworkStatus {
        if (!this._instance) {
            this._instance = new this(preExistingExecutionCondition);
            window.addEventListener('online', NetworkStatus.online.bind(this));
            window.addEventListener('offline', NetworkStatus.offline.bind(this));
        }

        return this._instance;

    }

    public getNetworkChange(): Observable<NetworkStatusEnum> {
        return this.networkChange$;
    }


    private static online(): void {
        
        if (this._instance.firstExecution.value) {
            this._instance.firstExecution.next(false);
        }
        this._instance.status.next(NetworkStatusEnum.ONLINE);
    }

    private static offline(): void {

        if (this._instance.firstExecution) {
            this._instance.firstExecution.next(false);
        }
        this._instance.status.next(NetworkStatusEnum.OFFLINE);
    }

    public static getStatus(): boolean {
        return navigator.onLine;
    }
}