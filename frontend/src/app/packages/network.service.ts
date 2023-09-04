import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { NetworkStatusEnum } from './interfaces/network-status.interfaces';
import { skipWhile, switchMap } from 'rxjs/operators';

// enum NetworkStatusEnum {
//   OFFLINE = 0,
//   ONLINE = 1
// };

@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  // private readonly PUBLIC_ADDRESS_TO_PING = 'https://dns.google';
  public status: BehaviorSubject<NetworkStatusEnum>;
  public networkChange$: Observable<NetworkStatusEnum>;
  private readonly PUBLIC_ADDRESS_TO_PING = 'https://dns.google';
  private firstExecution: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

  constructor(
    private httpClient: HttpClient
  ) {
    this.status = new BehaviorSubject<NetworkStatusEnum>(navigator.onLine ? NetworkStatusEnum.ONLINE : NetworkStatusEnum.OFFLINE);

    this.networkChange$ = this.status.asObservable().pipe(
      skipWhile((_) => this.firstExecution.value), // Dokler bo this.firstExecution.value === true se ta stream ne bo 'zagnal'!!!
      switchMap(()=> this.status),
    );
    

    // add listeners for change of onLine method
    window.addEventListener('online', this.online.bind(this));
    window.addEventListener('offline', this.offline.bind(this));
  }

  /**
   * Ker request iz browserja privede do CORS problemov, bomo probali to zadevo resiti preko 
   * BE, ko ga bom ustvaril in tako dobili odgovor o povezavi preko odgovora iz BE (BE bo poslal request na zeljeno destinacijo)
   * 
   * @returns boolean
   */
  getNetworkStatus(): Promise<boolean> {

    return new Promise((resolve, reject) => {
      resolve(false);
      return;
      if (navigator.onLine) {
        // imamo naceloma linijo, sedaj pa moramo se poslati en hiter ping
        resolve(true);
        // this.httpClient.get(this.PUBLIC_ADDRESS_TO_PING, { observe: 'response'}).toPromise().then(
        //   (requestFinished) => {
        //     resolve(true);
        //   },
        //   (requestError) => {
        //     console.error('There was an error', requestError);
        //     reject(requestError);
        //   }
        // )
      } else {
        resolve(false);
      }
    })
  }

  // mogoce bom to raje uporabil, ker se mi zdi nekako boljsa razlaga... ne deluje pa tako 'clean' kot trenutna uporaba
  private networkChange(): void {
    if (navigator.onLine) {
      this.status.next(NetworkStatusEnum.ONLINE);
    } else {
      this.status.next(NetworkStatusEnum.OFFLINE);
    }
  }

  private online(): void {
    
    if (this.firstExecution.value) {
      this.firstExecution.next(false);
    }
    this.status.next(NetworkStatusEnum.ONLINE);
  }

  private offline(): void {
    if (this.firstExecution) {
      this.firstExecution.next(false);
    }
    this.status.next(NetworkStatusEnum.OFFLINE);
  }
}
