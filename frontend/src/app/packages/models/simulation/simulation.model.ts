import { Type } from 'class-transformer';
import { SimulationStep } from './simulation-step.model';

export class Simulation {
    //@ts-ignore
    agentId: string;
    //@ts-ignore
    simulationName: string;
    @Type(() => SimulationStep)
    //@ts-ignore
    steps: SimulationStep[];
    //@ts-ignore
    simulationSize: number = 0;
  }