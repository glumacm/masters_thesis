<?php

namespace App\Models;

class SyncSimulationSummaryResult
{
    public string $entity_name;
    public int $number_of_objects;
    public float $average_time;
    public float $total_time;
    public int $number_of_instances;
    public float $objects_total_size;
    public float $objects_average_size;
}
