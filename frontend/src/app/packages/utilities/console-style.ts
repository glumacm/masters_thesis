import { CONFIGURATION_CONSTANTS } from "../configuration";

export const CONSOLE_STYLE: ConsoleStyles = {
    white_and_black: 'background-color: #FFFFFF; color: #000000',
    black_and_white: 'background-color: #000000; color: #FFFFFF',
    red_and_black: 'background-color: #ff0000; color: #000000',
    red_and_white: 'background-color: #ff0000; color: #FFFFFF',
    promise_success: 'background-color: #0047ff; color: #F1F227',
    promise_error: 'background-color: #d8255c; color: #E0FFFF',
    databaseUtilityLogic: 'background-color: #6e1fe0; color: #fde3a7',
    magenta_and_white: 'background-color: #CA6CF6; color: #ffffff',
    sync_entity_worker: 'background-color: #00F011; color: #000000',
    sync_lib_main: 'background-color: #0119F0; color: #000000',
    sync_lib_main_positive_vibe: 'background-color: #00FF06; color: #000000',
    sync_lib_retry_management: 'background-color: #FA00FA; color: #ffffff',
    sync_lib_retry_worker_thread: 'background-color: #5600FA; color: #ffffff',
}


interface ConsoleStyles {
    black_and_white?: string;
    white_and_black?: string;
    red_and_black?: string;
    red_and_white?: string;
    promise_success?: string;
    promise_error?: string;
    observable_success?: string;
    observable_error?: string;
    try_catch_success?: string;
    try_cattch_error?: string;
    databaseUtilityLogic?: string;
    databaseUtilityLogicNight?: string;
    magenta_and_white: string;
    sync_entity_worker: string;
    sync_lib_main: string;
    sync_lib_main_positive_vibe: string;
    sync_lib_retry_management: string;
    sync_lib_retry_worker_thread: string;
}


export function console_log_with_style(message: string, style: string, dataToPrint?: any, level: number = 1):  void {
    if (level > 2){
        const now = new Date();
        console.log(`%c %s %c${message}`, CONSOLE_STYLE.red_and_white!, now.toISOString(), style);
        if (dataToPrint) {
            console.log(`%c %O `, style, dataToPrint);
            
        }
    }
}

export class CustomConsoleOutput {
    readonly consoleStyle: string;
    readonly groupLabel: string;
    constructor(groupLabel: string, consoleStyle: string) {
        this.consoleStyle = consoleStyle;
        this.groupLabel = groupLabel
        if (CONFIGURATION_CONSTANTS.DEBUG_MODE) {
            console.group(groupLabel);
        }

    }

    output(message: string, data: any = null) {
        if (!CONFIGURATION_CONSTANTS.DEBUG_MODE) {
            return;
        }
        const now = new Date();
        console.log(`%c %s %s %c${message}`, CONSOLE_STYLE.red_and_white!,this.groupLabel, now.toISOString(), this.consoleStyle);
        if(data) {
            console.log(`%c %O `, this.consoleStyle, data);
        }
    }

    closeGroup() {
        console.groupEnd();
    }
    
}