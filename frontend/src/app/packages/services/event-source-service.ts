import { Subject, Subscription } from "rxjs";
import { CONSOLE_STYLE, CustomConsoleOutput } from "../utilities/console-style";
import * as classTransformer from 'class-transformer';
import { EventSourceStreamEvent } from "../models/sync/event-source-stream-event.model";
import { EventSourcePolicyEnum } from "../enums/sync/event-source-policy-enum";
import { DEFAULT_MERCURE_SYNC_POLICY, MERCURE_SYNC_ENTITIES } from "../configuration";

export class EventSourceService {

    private consoleOutput: CustomConsoleOutput;
    //@ts-ignore
    private eventSource: EventSource;
    private eventSourceUrl: string;
    private topics: string[];
    
    
    public eventSourceStream: Subject<EventSourceStreamEvent>;

    /**
     * This "service" cannot be `singular` because otherwise I have problem with Web worker logic.
     * That is why I will need to implement this as an ordinary service, that does not hold any state.
     * 
     * IMPORTANT: When I add this to some worker I need to add logic that will close the event source!!!
     * At the end it makes sense that I have event source initiated in the SyncWorker (because there I will control everything related to synchronisation and network!!)
     * 
     * One more IMPORTANT info:
     * I will send from BE specific structure:
     * {
     * entityName: '',
     * data: {...}
     * }
     * This way I will be able to filter out the data
     */
    constructor(
        eventSourceUrl: string,
        topics: string[], 
    ){
        this.consoleOutput = new CustomConsoleOutput('EventSourceService', CONSOLE_STYLE.sync_lib_main_positive_vibe);
        this.eventSourceStream = new Subject();
        this.eventSourceUrl = eventSourceUrl;
        this.topics = topics;
        // BOILERPLATE SOURCE CODE
        // const url = new URL('https://localhost/.well-known/mercure');
        // url.searchParams.append('topic', 'https://example.com/books/{id}');
        // url.searchParams.append('topic', 'https://example.com/users/dunglas');
        // // The URL class is a convenient way to generate URLs such as https://localhost/.well-known/mercure?topic=https://example.com/books/{id}&topic=https://example.com/users/dunglas
    
        // const eventSource = new EventSource(url);
        // this.openEventSource(eventSourceUrl, topics);
    
        // // The callback will be called every time an update is published
        // eventSource.onmessage = e => this.consoleOutput.output('Work hard ',JSON.parse(e.data)); // do something with the payload

        
    }

    // public openEventSource(eventSourceUrl: string, topics: string[]) {
    public openEventSource() {
        this.consoleOutput.output(`We open event source`);
        const url = new URL(this.eventSourceUrl);
        this.topics.forEach((topic) => url.searchParams.append('topic', topic));
        this.eventSource = new EventSource(url);
        this.eventSource.onmessage = e => this.eventSourceUpdateCallback(e);
        this.eventSource.onerror = error => this.eventSourceUpdateError(error);
    }

    /**
     * 
     * @param event: MessageEvent - event.data bo vedno vseboval JSON string!!!
     */
    public eventSourceUpdateCallback(event: MessageEvent) {
        if (event?.data) {
            this.eventSourceStream.next(classTransformer.plainToInstance(EventSourceStreamEvent, JSON.parse(event.data)));
        }
        // this.consoleOutput.output('Work hard ',JSON.parse(event.data))
    }

    public eventSourceUpdateError(error: Event) {
        this.consoleOutput.output('Error: ', error);
        throw new Error('Event source returned an error  ');
    }

    public closeEventSource(): void {
        this.eventSource?.close();
    }

    public static eventAllowedBasedOnConfiguration(event: EventSourceStreamEvent, agentId: string): boolean {
        if (event.agentId === agentId) {
            return false;
        }
        if (DEFAULT_MERCURE_SYNC_POLICY === EventSourcePolicyEnum.SYNC_ALL) {
            return true;
        }

        if (DEFAULT_MERCURE_SYNC_POLICY === EventSourcePolicyEnum.PARTIAL_SYNC) {
            return !!MERCURE_SYNC_ENTITIES.find((entityString) => entityString === event.entityName); // true if found, false if not
        }

        return false;
    }


}