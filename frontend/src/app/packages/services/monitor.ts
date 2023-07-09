// /**
//  * Currently we use Sentry to send log activities
//  */

 import {init, captureEvent, captureException, captureMessage, BrowserTracing} from '@sentry/browser';
 const initializeSentryIfNotInitialized = () => {
    console.log('WHAT IS GOING HER5675657656757567E');
    
    return (target: any, memberName: string, propertyDescriptor: PropertyDescriptor) => {
    //   propertyDescriptor.enumerable = value;
        console.log(
            'AND WHTR IDS GOING HGERE'
        );
        return {
            get() {
                /**
                 * @description
                 * Tukaj se pozene logika, ko poklicem ALI!!! referenciram funkcijo, ki uporablja ta dekorator.
                 * Primer:
                 * const dependencies = {
                 *  someFunctionToReference: someInstance.someFunctionToReference
                 * }
                 * Kot vidimo v primeru, se ni poklicalo funkcije, ampak se samo referencira. 
                 */

                console.log('34298043287243872493342879348792879');
                
              const wrapperFn = (...args: any[]) => {
                /**
                 * @description
                 * Ta logika pa se izvede le ko dejansko poklicemo funkcijo, ki uporablja ta dekorator
                 */
                console.log('TUKAJ SE PA POZENE FUKNCIJA');
                if (!SentryClient.sentryInitialized) {
                    SentryClient.initializeSentry();
                }
                console.warn(`Method ${memberName} is deprecated with reason: but somewhere`);
                propertyDescriptor.value.apply(this, args)
              }
      
              Object.defineProperty(this, memberName, {
                  value: wrapperFn,
                  configurable: true,
                  writable: true
              });
              return wrapperFn;
            }
          }
        
    }
  }

 export class SentryClient {
    static sentryInitialized: boolean;

    constructor() {
        if (!SentryClient.sentryInitialized) {
            SentryClient.initializeSentry();
        }
    }

    static initializeSentry(): void {
        init({
            dsn: "https://5f37ad3e5884446991daea73d440d58a@o4504900918837248.ingest.sentry.io/4504900923097088",
            integrations: [new BrowserTracing()],
          
            // Set tracesSampleRate to 1.0 to capture 100%
            // of transactions for performance monitoring.
            // We recommend adjusting this value in production
            tracesSampleRate: 1.0,
          });
        SentryClient.sentryInitialized = true;
    }



    // Preveri se enkrat ali je res nujno da zakomentiram ta dekorator - nazadnje imam v glavi, da sem to naredil, ker je sprozalo napako brez razloga.
    // @initializeSentryIfNotInitialized()
    captureMessage(message: string, captureContext?: any): void {
        captureMessage(message, captureContext);
    }

    // captureEvent(event: Sentry.Event, hint?: Sentry.EventHint | undefined): void {
    //     Sentry.captureEvent(event, hint);
    // }

    // captureException(exception: any, captureContext?: any): void {
    //     Sentry.captureException(exception, captureContext);
    // }
 }



//  import { BrowserTracing } from "@sentry/tracing";

//  // TODO: Premisliti kako omogociti `injection` obstojece Sentry knjiznice, ki jo lahko developer potencialno ze ima inicializirano v svojem projektu.
//  export function initializeSentry(existingSentry?: any) {
//     Sentry.init({
//         dsn: "https://07e92cc0bf254d28b59f81fd0e5abb20@o1021850.ingest.sentry.io/4504445698048000",
//         integrations: [new BrowserTracing()],
      
//         // Set tracesSampleRate to 1.0 to capture 100%
//         // of transactions for performance monitoring.
//         // We recommend adjusting this value in production
//         tracesSampleRate: 1.0,
//       });
//  }

//  export function successData(message:string, eventId: string) {
//     const logData = {message, event_id: eventId} as LogData;
//     Sentry.captureEvent(logData);
//  }


//  interface LogData extends Sentry.Event {
//     /*
//     event_id?: string;
//     message?: string;
//     timestamp?: number;
//     start_timestamp?: number;
//     level?: Severity | SeverityLevel;
//     platform?: string;
//     logger?: string;
//     server_name?: string;
//     release?: string;
//     dist?: string;
//     environment?: string;
//     sdk?: SdkInfo;
//     request?: Request;
//     transaction?: string;
//     modules?: {
//         [key: string]: string;
//     };
//     fingerprint?: string[];
//     exception?: {
//         values?: Exception[];
//     };
//     breadcrumbs?: Breadcrumb[];
//     contexts?: Contexts;
//     tags?: {
//         [key: string]: Primitive;
//     };
//     extra?: Extras;
//     user?: User;
//     type?: EventType;
//     spans?: Span[];
//     */

//  }