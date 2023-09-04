export class StopwatchService {
    private intermediateTimes: number[] = [];
    private startTime = 0;
    private endTime = 0;

    constructor(startAtInitialisation: boolean = false) {
        if (startAtInitialisation) {
            this.startTime = performance.now();
        }
    }

    start() {
        this.startTime = performance.now(); // performance.now --> cas v milisekundah
    }

    stop() {
        this.endTime = performance.now();
    }

    createIntermediateTime() {
        this.intermediateTimes.push(performance.now());
    }

    showTime() {
        return this.endTime-this.startTime;
    }

    showIntermediateTimes() {
        return this.intermediateTimes.map((performanceTime: number) => performanceTime - this.startTime);
    }
}