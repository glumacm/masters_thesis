<?php

namespace App\Models;

/**
 * simulationTimes":[
{"entityTimes":{"f9c3b333-adf0-4ff0-a83d-f7d067fef112":
 * {"entityName":"testEntity","syncTime":502.80000001192093,
 * "objectsSize":0.436,"numberOfObjects":3,"type":"SUCCESS"}
 * }
 */


class SyncSimulationTime
{
    /**
     * @var SyncSimulationEntityTime[]|null
     */
    public array $entity_times;
    public float $total_time;

    /**
     * @return SyncSimulationEntityTime[]|null
     */
    public function getEntityTimes(): ?array
    {
        return $this->entity_times;
    }

    /**
     * @param SyncSimulationEntityTime[]|null $entity_times
     */
    public function setEntityTimes(?array $entity_times): void
    {
        $this->entity_times = $entity_times;
    }

    /**
     * @return float
     */
    public function getTotalTime(): float
    {
        return $this->total_time;
    }

    /**
     * @param float $total_time
     */
    public function setTotalTime(float $total_time): void
    {
        $this->total_time = $total_time;
    }


}
