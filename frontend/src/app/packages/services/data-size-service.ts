import sizeof from "object-sizeof";

export class DataSizeService {
    /**
     * This class should be used as placeholder for calculating data sizes of the objects.
     * This way we think we can implement dynamic solution which will be able to switch between
     * scenarios where we need to calculate objects and where we do not. Especially useful when
     * doing the performance analysis, so that this calculation does not take execution time for nothing.
     */
    static readonly BYTES_DIVIDER: number = 1;
    static readonly KILOBYTES_DIVIDER: number = Math.pow(10,3); // Will use 1000 division - will not be conserned with technical detail of 1024
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