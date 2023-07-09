import * as Comlink from "comlink";
import { console_log_with_style, CONSOLE_STYLE } from "../../utilities/console-style";

let someData = 32;

export class SecondWorker {
    constructor() {
        console_log_with_style(`CONSTRUCTOR of SECOND WORKER`, CONSOLE_STYLE.black_and_white!, null, 3);
    }
    executeSecondCommand(str:string) {
        console_log_with_style(`Second-worker-exposed: This will be data`, CONSOLE_STYLE.black_and_white!, null, 3);
    }
}

Comlink.expose(SecondWorker);