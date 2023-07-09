import { Observable, Subject } from "rxjs";

export class CommunicationUIWorker {
    static channel: Subject<string>;

    static feedChannel(newValue:string){  
        CommunicationUIWorker.channel.next(newValue);
    }

    static createChannel() {
        if (!CommunicationUIWorker.channel) {
            CommunicationUIWorker.channel = new Subject<string>();
        }
    }
}