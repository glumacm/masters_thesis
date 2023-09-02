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


/**
 * {"totalSyncCount":436,"totalCount":436,"totalSyncSuccessCount":0,"totalRetryCount":0,"simulationTimes":[
{"entityTimes":{"f9c3b333-adf0-4ff0-a83d-f7d067fef112":
 * {"entityName":"testEntity","syncTime":502.80000001192093,
 * "objectsSize":0.436,"numberOfObjects":3,"type":"SUCCESS"}
 * },"totalTime":517.0999999940395}]}
 */

// class SyncSimulationSummary
// {
//     public int $total_sync_count;
//     public int $total_count;
//     public int $total_sync_success_count;
//     public int $total_retry_count;
//     public mixed $simulation_times;
//     public int $total_time;
// }