import * as Comlink from "comlink";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";
import { SecondWorker } from "./second.worker";

let someData = 32;

// const WorkerClass = Comlink.wrap<typeof FirstWorker>(new Worker(new URL('packages/workers/object-oriented/first.worker', import.meta.url)));

//     const instance: Comlink.Remote<FirstWorker> = await new WorkerClass();

export class FirstWorker {
    Work2: any;
    instance: Comlink.Remote<SecondWorker> | undefined;
    constructor() {
        this.setupInitial();
        
        setInterval(() => {
            if (this.instance) {
                this.instance.executeSecondCommand('jole');
            }
        }, 1500);
    }

    executeFirstCommand(str:string) {
        console_log_with_style(`First-worker-exposed: This will be data`, CONSOLE_STYLE.black_and_white!, null, 3);
    }

    private async setupInitial() {
        this.Work2 = Comlink.wrap(new Worker(new URL('./second.worker', import.meta.url)));
        this.instance = await new this.Work2();
        this.instance!.executeSecondCommand('ba');
    }
}

Comlink.expose(FirstWorker);