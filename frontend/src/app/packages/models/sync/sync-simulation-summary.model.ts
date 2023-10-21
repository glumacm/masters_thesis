import { Type } from "class-transformer";
import { SyncSimulationTime } from "./sync-simulation-time.model";

export class SyncSimulationSummary {
    //@ts-ignore
    public totalSyncCount: number;
    //@ts-ignore
    public totalCount: number;
    //@ts-ignore
    public totalSyncSuccesCount; number;
    //@ts-ignore
    public totalRetryCount: number;
    @Type(()=>SyncSimulationTime)
    //@ts-ignore
    public simulationTimes: SyncSimulationTime[];
    //@ts-ignore
    public totalTime: number;

}