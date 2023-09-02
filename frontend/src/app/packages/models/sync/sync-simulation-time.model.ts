import { Type } from "class-transformer";
import { SyncSimulationEntityTime } from "./sync-simulation-entity-time.model";

export class SyncSimulationTime {
    @Type(()=> Date)
    //@ts-ignore
    public entityTimes: SyncSimulationEntityTime[];
    //@ts-ignore
    public totalTime: number;
}

/**
 * PRIMER
 * simulationTimes":[
{"entityTimes":{"f9c3b333-adf0-4ff0-a83d-f7d067fef112":
 * {"entityName":"testEntity","syncTime":502.80000001192093,
 * "objectsSize":0.436,"numberOfObjects":3,"type":"SUCCESS"}
 * }
 */