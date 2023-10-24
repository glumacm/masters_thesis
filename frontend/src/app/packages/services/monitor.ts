// /**
//  * Currently we use Sentry to send log activities
//  */

 import {init, captureEvent, captureException, captureMessage, BrowserTracing} from '@sentry/browser';
import { CONFIGURATION_CONSTANTS } from '../configuration';
 const initializeSentryIfNotInitialized = () => {
    return (target: any, memberName: string, propertyDescriptor: PropertyDescriptor) => {
    //   propertyDescriptor.enumerable = value;

        return {
            get() {
                /**
                 * @description
                 * This where the logic is triggere when I reference a function that uses the decorator.
                 * Tukaj se pozene logika, ko poklicem ALI!!! referenciram funkcijo, ki uporablja ta dekorator.
                 * Example:
                 * const dependencies = {
                 *  someFunctionToReference: someInstance.someFunctionToReference
                 * }
                 * As we see in the example, we did not call the function but only referenced it.
                 */
                
              const wrapperFn = (...args: any[]) => {
                /**
                 * @description
                 * This logic is executed when we actually call the function that uses the decorator
                 */
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
            dsn: CONFIGURATION_CONSTANTS.SENTRY_DNS,
            integrations: [new BrowserTracing()],
          
            // Set tracesSampleRate to 1.0 to capture 100%
            // of transactions for performance monitoring.
            // We recommend adjusting this value in production
            tracesSampleRate: 1.0,
          });
        SentryClient.sentryInitialized = true;
    }



    // Check again if it is necessary to comment out the decroator - from my mind I remember that I commented this out because it caused some error without any specific reason
    // @initializeSentryIfNotInitialized()
    captureMessage(message: string, captureContext?: any): void {
        captureMessage(message, captureContext);
    }
 }
