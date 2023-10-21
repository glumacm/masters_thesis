import { Type } from "class-transformer";
import { SyncSimulationEntityTime } from "./sync-simulation-entity-time.model";

export class SyncSimulationTime {
    @Type(()=> Date)
    //@ts-ignore
    public entityTimes: SyncSimulationEntityTime[];
    //@ts-ignore
    public totalTime: number;
}