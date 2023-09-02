<?php

namespace App\Models;

/**
 * {"totalSyncCount":436,"totalCount":436,"totalSyncSuccessCount":0,"totalRetryCount":0,"simulationTimes":[
{"entityTimes":{"f9c3b333-adf0-4ff0-a83d-f7d067fef112":
 * {"entityName":"testEntity","syncTime":502.80000001192093,
 * "objectsSize":0.436,"numberOfObjects":3,"type":"SUCCESS"}
 * },"totalTime":517.0999999940395}]}
 */

class SyncSimulationSummary
{
    public int $total_sync_count;
    public int $total_count;
    public int $total_sync_success_count;
    public int $total_retry_count;
    /**
     * @var SyncSimulationTime[]|null
     */
    public array $simulation_times;

    /**
     * @return int
     */
    public function getTotalSyncCount(): int
    {
        return $this->total_sync_count;
    }

    /**
     * @param int $total_sync_count
     */
    public function setTotalSyncCount(int $total_sync_count): void
    {
        $this->total_sync_count = $total_sync_count;
    }

    /**
     * @return int
     */
    public function getTotalCount(): int
    {
        return $this->total_count;
    }

    /**
     * @param int $total_count
     */
    public function setTotalCount(int $total_count): void
    {
        $this->total_count = $total_count;
    }

    /**
     * @return int
     */
    public function getTotalSyncSuccessCount(): int
    {
        return $this->total_sync_success_count;
    }

    /**
     * @param int $total_sync_success_count
     */
    public function setTotalSyncSuccessCount(int $total_sync_success_count): void
    {
        $this->total_sync_success_count = $total_sync_success_count;
    }

    /**
     * @return int
     */
    public function getTotalRetryCount(): int
    {
        return $this->total_retry_count;
    }

    /**
     * @param int $total_retry_count
     */
    public function setTotalRetryCount(int $total_retry_count): void
    {
        $this->total_retry_count = $total_retry_count;
    }

    /**
     * @return mixed
     */
    public function getSimulationTimes(): mixed
    {
        return $this->simulation_times;
    }

    /**
     * @param mixed $simulation_times
     */
    public function setSimulationTimes(mixed $simulation_times): void
    {
        $this->simulation_times = $simulation_times;
    }


}
