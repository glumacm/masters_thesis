import sizeof from "object-sizeof";

export class DataSizeService {
    /**
     * Ta razred bi uporabljal kot PLACEHOLDER za racunanje objektov,
     * na tak nacin sklepam, da bi lahko implementiral dinamicno resitev, ki 
     * bi lahko preklapljala med nacinom, ki racuna velikost objektov ali ne...
     * predvsem uporabno v primeru, ko bi rad delal casovno analizo
     */
    static readonly BYTES_DIVIDER: number = 1;
    static readonly KILOBYTES_DIVIDER: number = Math.pow(10,3); // Uporabimo kar splosno delitev, ne bomo skrbeli za 1024
    static readonly MEGABYTES_DIVIDER: number = Math.pow(10,6);

    private currentSizeCount: number = 0;
    private addCalculatedToCurrentCount: boolean = false;

    constructor(addCalculatedToCurrentCount: boolean = true){
        this.addCalculatedToCurrentCount = addCalculatedToCurrentCount;
    }

    public addSizeCount(additionalCount: number): void {
        this.currentSizeCount += additionalCount;
    }

    public getCurrentSizeCount(dividerToUse: number = DataSizeService.BYTES_DIVIDER): number {
        return this.currentSizeCount / dividerToUse;
    }

    public calculateDataSize(data: any) {
        const sizeCount = sizeof(data);
        if (this.addCalculatedToCurrentCount) {
            this.currentSizeCount+=sizeCount;
        }
        return sizeCount;
    }
}