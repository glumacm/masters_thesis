/// <reference lib="webworker" />
// window = DedicatedWorkerGlobalScope;

import { console_log_with_style, CONSOLE_STYLE } from "../utilities/console-style";


addEventListener('message', async ({ data }) => {
    console_log_with_style('WEEEELLL  BOOOOYYYYYY', CONSOLE_STYLE.promise_success!, '');
});