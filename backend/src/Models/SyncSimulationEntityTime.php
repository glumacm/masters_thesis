<?php

namespace App\Models;

/**
 * {"entityTimes":{"f9c3b333-adf0-4ff0-a83d-f7d067fef112":
 * {"entityName":"testEntity","syncTime":502.80000001192093,
 * "objectsSize":0.436,"numberOfObjects":3,"type":"SUCCESS"}
 * }
 */


class SyncSimulationEntityTime
{
    /**
     * @var string
     */
    public string $request_uuid;
    public string $entity_name;
    public float $sync_time;
    public float $objects_size;
    public int $number_of_objects;
    public string $type;

    /**
     * @return string
     */
    public function getRequestUuid(): string
    {
        return $this->request_uuid;
    }

    /**
     * @param string $requst_uuid
     */
    public function setRequestUuid(string $requst_uuid): void
    {
        $this->request_uuid = $requst_uuid;
    }

    /**
     * @return string
     */
    public function getEntityName(): string
    {
        return $this->entity_name;
    }

    /**
     * @param string $entity_name
     */
    public function setEntityName(string $entity_name): void
    {
        $this->entity_name = $entity_name;
    }

    /**
     * @return float
     */
    public function getSyncTime(): float
    {
        return $this->sync_time;
    }

    /**
     * @param float $sync_time
     */
    public function setSyncTime(float $sync_time): void
    {
        $this->sync_time = $sync_time;
    }

    /**
     * @return float
     */
    public function getObjectsSize(): float
    {
        return $this->objects_size;
    }

    /**
     * @param float $objects_size
     */
    public function setObjectsSize(float $objects_size): void
    {
        $this->objects_size = $objects_size;
    }

    /**
     * @return int
     */
    public function getNumberOfObjects(): int
    {
        return $this->number_of_objects;
    }

    /**
     * @param int $number_of_objects
     */
    public function setNumberOfObjects(int $number_of_objects): void
    {
        $this->number_of_objects = $number_of_objects;
    }

    /**
     * @return string
     */
    public function getType(): string
    {
        return $this->type;
    }

    /**
     * @param string $type
     */
    public function setType(string $type): void
    {
        $this->type = $type;
    }


}
